import base64
import json
import urllib.request
import urllib.error
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, File, UploadFile
from supabase import Client
from datetime import date

from app.core.config import settings
from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.personal import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    MonthlySummaryRead,
    InstallmentPlanResponse,
    ReceiptOCRResponse,
)
from app.services.personal_service import PersonalTransactionService

router = APIRouter(prefix="/personal", tags=["personal"])

def get_personal_service(supabase: Client = Depends(get_current_user_supplier)):
    return PersonalTransactionService(supabase)


@router.get("/", response_model=List[TransactionResponse])
def get_personal_transactions(
    response: Response,
    exclude_children: bool = Query(
        default=True, 
        description="Si es True, excluye las cuotas hijas de MSI para evitar duplicar gastos con la transacción madre"
    ),
    limit: Optional[int] = Query(default=None, ge=1, le=500, description="Límite de transacciones a retornar"),
    offset: Optional[int] = Query(default=None, ge=0, description="Desplazamiento para paginación"),
    start_date: Optional[date] = Query(default=None, description="Fecha inicial (inclusive)"),
    end_date: Optional[date] = Query(default=None, description="Fecha final (inclusive)"),
    type: Optional[str] = Query(default=None, description="Filtrar por tipo (income, expense, transfer)"),
    category_id: Optional[UUID] = Query(default=None, description="Filtrar por ID de categoría"),
    payment_method: Optional[str] = Query(default=None, description="Filtrar por método de pago"),
    credit_card_id: Optional[UUID] = Query(default=None, description="Filtrar por tarjeta de crédito"),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Lista las transacciones personales del usuario autenticado con soporte de filtrado server-side y paginación.
    Por defecto excluye las cuotas hijas de MSI para evitar doble conteo.
    Se incluye la cabecera HTTP 'X-Total-Count' con el total de registros coincidentes.
    """
    query = supabase.table("personal_transactions").select("*, categories(name, icon, color)", count="exact")
    if exclude_children:
        query = query.is_("parent_transaction_id", "null")
    if start_date:
        query = query.gte("transaction_date", str(start_date))
    if end_date:
        query = query.lte("transaction_date", str(end_date))
    if type:
        query = query.eq("type", type)
    if category_id:
        query = query.eq("category_id", str(category_id))
    if payment_method:
        query = query.eq("payment_method", payment_method)
    if credit_card_id:
        query = query.eq("credit_card_id", str(credit_card_id))

    query = query.order("transaction_date", desc=True)

    if limit is not None:
        start_idx = offset or 0
        end_idx = start_idx + limit - 1
        query = query.range(start_idx, end_idx)

    res = query.execute()

    if res.count is not None:
        response.headers["X-Total-Count"] = str(res.count)

    return res.data


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_personal_transaction(
    transaction: TransactionCreate, 
    service: PersonalTransactionService = Depends(get_personal_service),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una nueva transacción personal. Soporta MSI si is_installment=True.
    """
    user = supabase.auth.get_user().user
    
    if transaction.is_installment:
        return await service.create_with_installments(transaction, user.id)
    
    # Flujo normal
    data = transaction.model_dump(mode="json", exclude_unset=True)
    data["user_id"] = str(user.id)
    response = supabase.table("personal_transactions").insert(data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Error creando la transaccion")
        
    return response.data[0]


@router.get("/summary", response_model=List[MonthlySummaryRead])
def get_monthly_summary(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene un resumen mensual basado en la vista v_monthly_summary.
    Aplica RLS de igual manera.
    """
    response = supabase.table("v_monthly_summary").select("*").execute()
    return response.data


@router.get("/{id}", response_model=TransactionResponse)
def get_transaction(
    id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Obtiene el detalle de una transacción por ID.
    """
    response = supabase.table("personal_transactions").select("*").eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return response.data[0]


@router.patch("/{id}", response_model=TransactionResponse)
def update_transaction(
    id: UUID, 
    transaction: TransactionUpdate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Actualiza detalles específicos de una transacción individual.
    """
    data = transaction.model_dump(mode="json", exclude_unset=True)
    if not data:
         raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
         
    response = supabase.table("personal_transactions").update(data).eq("id", str(id)).execute()
    
    if not response.data:
         raise HTTPException(status_code=404, detail="Transacción no encontrada o sin permisos")
         
    return response.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Elimina una transacción. Si es una compra madre de MSI, elimina en cascada
    sus cuotas hijas y el plan de amortización asociado.
    """
    # 1. Verificar si la transacción tiene un plan de MSI vinculado (transacción madre)
    plan_resp = supabase.table("installment_plans").select("id").eq("original_tx_id", str(id)).execute()
    if plan_resp.data:
        plan_id = plan_resp.data[0]["id"]
        # Eliminar plan
        supabase.table("installment_plans").delete().eq("id", plan_id).execute()
        # Eliminar todas las cuotas hijas asociadas a esta madre
        supabase.table("personal_transactions").delete().eq("parent_transaction_id", str(id)).execute()

    # 2. Eliminar la transacción
    response = supabase.table("personal_transactions").delete().eq("id", str(id)).execute()
    
    if not response.data:
         # PostgREST retorna la data eliminada si tuvo éxito (en el cliente python)
         raise HTTPException(status_code=404, detail="Transacción no encontrada o sin permisos para eliminar")
    return None


@router.get("/installments", response_model=List[InstallmentPlanResponse])
def get_installment_plans(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene todos los planes de MSI activos del usuario.
    """
    response = supabase.table("installment_plans").select("*").execute()
    plans = []
    for plan in response.data:
        # Calcular pagados/pendientes contando hijas asignadas a un statement
        hijas = supabase.table("personal_transactions") \
            .select("id", count="exact") \
            .eq("parent_transaction_id", plan["original_tx_id"]) \
            .execute()
        
        plan["paid_count"] = hijas.count if hijas.count else 0
        plan["pending_count"] = plan["total_months"] - plan["paid_count"]
        plans.append(plan)
    return plans


@router.patch("/installments/{id}/cancel", response_model=InstallmentPlanResponse)
def cancel_installment_plan(
    id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Cancela un plan de MSI y elimina las parcialidades futuras.
    """
    # 1. Marcar plan como cancelado
    response = supabase.table("installment_plans").update({"status": "cancelled"}).eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    plan = response.data[0]
    
    # 2. Eliminar transacciones hijas cuya fecha sea mayor a hoy
    today = date.today()
    supabase.table("personal_transactions") \
        .delete() \
        .eq("parent_transaction_id", plan["original_tx_id"]) \
        .gt("transaction_date", str(today)) \
        .execute()
        
    return plan


@router.post("/ocr-receipt", response_model=ReceiptOCRResponse)
async def process_receipt_ocr(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Procesa una imagen de recibo, voucher o factura usando IA (Google Gemini Vision).
    Extrae comercio, monto total, fecha, sugiere categoría y redacta notas del gasto.
    Mapea automáticamente la categoría sugerida con las categorías existentes del usuario.
    """
    valid_mimes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
    content_type = file.content_type or "image/jpeg"
    if content_type not in valid_mimes and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no soportado ({content_type}). Usa JPEG, PNG o WebP."
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío.")
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen excede el límite de 10MB.")

    base64_data = base64.b64encode(file_bytes).decode("utf-8")
    
    ocr_result = {
        "merchant_name": None,
        "amount": None,
        "transaction_date": None,
        "suggested_category": None,
        "notes": None,
        "confidence": 0.0,
        "raw_response": None,
    }

    if settings.GEMINI_API_KEY:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        prompt = (
            "Eres un asistente financiero experto en lectura de tickets y facturas en México y Latinoamérica. "
            "Analiza detalladamente la imagen adjunta y extrae la información en un único JSON válido con estos campos exactos:\n"
            "- merchant_name: (string) nombre de la tienda, comercio o emisor.\n"
            "- amount: (número decimal) monto total a pagar (busca Total, Total M.N., Total MXN o el importe final pagado).\n"
            "- transaction_date: (string en formato YYYY-MM-DD) fecha de emisión de la compra, o null si no se identifica.\n"
            "- suggested_category: (string) una categoría común en español (ej. Supermercado, Restaurante, Servicios, Transporte, Salud, Ropa, Entretenimiento, Hogar, Gasolina, Otros).\n"
            "- notes: (string) breve descripción o resumen de los artículos adquiridos.\n"
            "- confidence: (float entre 0.0 y 1.0) confianza global de la extracción.\n"
            "Responde estrictamente con el JSON sin bloques markdown."
        )
        req_body = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": content_type if content_type != "application/pdf" else "image/png",
                                "data": base64_data
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
        }
        try:
            req_data = json.dumps(req_body).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                candidates = resp_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        raw_text = parts[0].get("text", "")
                        ocr_result["raw_response"] = raw_text
                        try:
                            parsed = json.loads(raw_text)
                            ocr_result.update(parsed)
                        except Exception:
                            ocr_result["notes"] = raw_text[:200]
        except Exception as e:
            ocr_result["notes"] = f"Aviso de Gemini Vision: {str(e)}"
            ocr_result["confidence"] = 0.0
    else:
        ocr_result["merchant_name"] = "Ticket Escaneado (Demo)"
        ocr_result["amount"] = 150.00
        ocr_result["transaction_date"] = str(date.today())
        ocr_result["suggested_category"] = "Supermercado"
        ocr_result["notes"] = "Modo Demo: Para escaneo con IA real de Gemini Vision, agrega GEMINI_API_KEY en tu archivo .env."
        ocr_result["confidence"] = 0.5

    # Intentar emparejar suggested_category con categorías del usuario en Supabase
    matched_cat_id = None
    if ocr_result.get("suggested_category"):
        sugg = str(ocr_result["suggested_category"]).lower()
        cats_resp = supabase.table("categories").select("id, name").execute()
        cats = cats_resp.data or []
        for c in cats:
            c_name = str(c.get("name", "")).lower()
            if c_name in sugg or sugg in c_name:
                matched_cat_id = UUID(c["id"])
                break
        if not matched_cat_id and cats:
            matched_cat_id = UUID(cats[0]["id"])

    parsed_date = None
    if ocr_result.get("transaction_date"):
        try:
            parsed_date = date.fromisoformat(str(ocr_result["transaction_date"]))
        except Exception:
            parsed_date = date.today()
    else:
        parsed_date = date.today()

    parsed_amount = None
    if ocr_result.get("amount") is not None:
        try:
            parsed_amount = Decimal(str(ocr_result["amount"]))
        except Exception:
            parsed_amount = None

    return ReceiptOCRResponse(
        merchant_name=ocr_result.get("merchant_name"),
        amount=parsed_amount,
        transaction_date=parsed_date,
        suggested_category=ocr_result.get("suggested_category"),
        category_id=matched_cat_id,
        notes=ocr_result.get("notes"),
        confidence=float(ocr_result.get("confidence") or 0.8),
        raw_response=ocr_result.get("raw_response"),
    )

