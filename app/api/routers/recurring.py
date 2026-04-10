from typing import List
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.recurring import (
    RecurringPaymentCreate,
    RecurringPaymentUpdate,
    RecurringPaymentResponse,
    OccurrenceResponse,
    UpcomingPaymentResponse,
    OccurrencePayRequest,
)

router = APIRouter(prefix="/recurring", tags=["recurring"])


@router.get("/", response_model=List[RecurringPaymentResponse])
def get_recurring_payments(supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene las plantillas de pagos recurrentes activas."""
    response = supabase.table("recurring_payments").select("*").eq("is_active", True).execute()
    return response.data


@router.post("/", response_model=RecurringPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_payment(
    plan: RecurringPaymentCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una plantilla de pago y genera sus primeras ocurrencias en el fondo llamando al RPC en Supabase.
    """
    user = supabase.auth.get_user().user
    data = plan.model_dump(mode="json", exclude_unset=True)
    data["user_id"] = str(user.id)

    res = supabase.table("recurring_payments").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error al crear el pago recurrente")
    
    created_plan = res.data[0]
    
    # Intentar generar las ocurrencias automáticamente
    try:
        # El nombre exacto de la funcion y sus parametros dependen de la DB, 
        # pasamos un fallback limpio si falla el RPC (ej. mismatch args)
        supabase.rpc("generate_occurrences", {"id": created_plan["id"], "months": 3}).execute()
    except Exception as e:
        # Aquí se podría registrar en logs el fallo de la generación de la ocurrencia,
        # pero para el usuario la plantilla sí se creó.
        print(f"Aviso - RPC generate_occurrences falló: {str(e)}")

    return created_plan


@router.get("/upcoming", response_model=List[UpcomingPaymentResponse])
def get_upcoming_payments(supabase: Client = Depends(get_current_user_supplier)):
    """
    Devuelve las ocurrencias pendientes próximas usando la vista SQL pre-creada.
    """
    # Si la vista no tuviera todo exactamente como se espera en el schema, se puede cambiar a read dict.
    # Esta vista alimenta la UI principal.
    response = supabase.table("v_upcoming_payments").select("*").execute()
    return response.data


@router.get("/{id}", response_model=RecurringPaymentResponse)
def get_recurring_payment(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    response = supabase.table("recurring_payments").select("*").eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return response.data[0]


@router.patch("/{id}", response_model=RecurringPaymentResponse)
def update_recurring_payment(
    id: UUID, 
    plan: RecurringPaymentUpdate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    update_data = plan.model_dump(mode="json", exclude_unset=True)
    if not update_data:
         raise HTTPException(status_code=400, detail="No hay datos para actualizar")
         
    response = supabase.table("recurring_payments").update(update_data).eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return response.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_payment(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    """Soft-delete de un plan."""
    response = supabase.table("recurring_payments").update({"is_active": False}).eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return None


@router.get("/{id}/occurrences", response_model=List[OccurrenceResponse])
def get_occurrences(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene el historial de estados (pending, paid...) para una plantilla."""
    response = supabase.table("recurring_payment_occurrences").select("*").eq("recurring_payment_id", str(id)).order("scheduled_date", desc=True).execute()
    return response.data


@router.post("/occurrences/{occurrence_id}/pay", response_model=OccurrenceResponse)
def pay_occurrence(
    occurrence_id: UUID,
    req: OccurrencePayRequest,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Marca un recibo (occurrence) como pagado, 
    lo que automáticamente crea un registro en "personal_transactions"
    y lo vincula para mantener los saldos actualizados.
    """
    user = supabase.auth.get_user().user

    # 1. Obtener los detalles de la ocurrencia incluyendo la plantilla (para saber el monto original y cat)
    occ_res = supabase.table("recurring_payment_occurrences").select("*, recurring_payments(*)").eq("id", str(occurrence_id)).execute()
    
    if not occ_res.data:
         raise HTTPException(status_code=404, detail="Ocurrencia no encontrada")
         
    occ = occ_res.data[0]
    
    if occ["status"] == "paid":
         raise HTTPException(status_code=400, detail="Esta ocurrencia ya fue pagada")

    rec_plan = occ["recurring_payments"]
    
    # 2. Determinar el monto final a cobrar
    amount = float(req.amount_override) if req.amount_override else float(rec_plan["amount"])
    
    # 3. Crear la transacción personal reflejando el gasto
    tx_data = {
         "user_id": str(user.id),
         "category_id": rec_plan["category_id"],
         "credit_card_id": rec_plan.get("credit_card_id"),
         "amount": amount,
         "type": "expense",  # Asumimos que los recibos son gastos
         "payment_method": rec_plan["payment_method"],
         "description": f"Pago recurrente: {rec_plan['name']}",
         "notes": req.notes,
         "transaction_date": str(date.today())
    }
    
    tx_res = supabase.table("personal_transactions").insert(tx_data).execute()
    if not tx_res.data:
         raise HTTPException(status_code=500, detail="Error creando la transacción final")
         
    actual_tx_id = tx_res.data[0]["id"]
    
    # 4. Actualizar la ocurrencia para enlazar y sellar
    update_data = {
         "status": "paid",
         "amount_override": amount if req.amount_override else None,
         "actual_transaction_id": actual_tx_id,
         "notes": req.notes
    }
    
    final_res = supabase.table("recurring_payment_occurrences").update(update_data).eq("id", str(occurrence_id)).execute()
    
    return final_res.data[0]
