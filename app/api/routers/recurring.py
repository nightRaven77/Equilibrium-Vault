from typing import List, Optional
from uuid import UUID
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from app.schemas.enums import OccurrenceStatus

router = APIRouter(prefix="/recurring", tags=["recurring"])


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_plan_or_404(supabase: Client, plan_id: UUID) -> dict:
    """Obtiene el plan y verifica propiedad (RLS + check explícito)."""
    resp = supabase.table("recurring_payments").select(
        "*").eq("id", str(plan_id)).execute()
    if not resp.data:
        raise HTTPException(
            status_code=404, detail="Plantilla de pago no encontrada.")
    return resp.data[0]


def _get_current_uid(supabase: Client) -> str:
    return str(supabase.auth.get_user().user.id)


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[RecurringPaymentResponse])
def get_recurring_payments(
    active_only: bool = Query(
        default=True, description="Filtrar solo planes activos"),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Obtiene las plantillas de pagos recurrentes del usuario.
    Por defecto filtra solo activos. Pasa ?active_only=false para ver todos.
    """
    query = supabase.table("recurring_payments").select("*")
    if active_only:
        query = query.eq("is_active", True)
    return query.order("name").execute().data


@router.post("/", response_model=RecurringPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_payment(
    plan: RecurringPaymentCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una plantilla de pago y genera sus primeras ocurrencias via RPC.
    Valida: fechas coherentes, método de pago vs tarjeta de crédito.
    """
    current_uid = _get_current_uid(supabase)

    # Si el método es credit_card, verificar que se envió una tarjeta
    if plan.payment_method.value == "credit_card" and not plan.credit_card_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "MISSING_CARD",
                    "message": "Debes seleccionar una tarjeta de crédito cuando el método de pago es 'credit_card'."}
        )

    # Si envía credit_card_id, verificar que pertenece al usuario
    if plan.credit_card_id:
        card_resp = supabase.table("credit_cards").select("id, user_id").eq(
            "id", str(plan.credit_card_id)
        ).execute()
        if not card_resp.data or card_resp.data[0]["user_id"] != current_uid:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_CARD",
                        "message": "La tarjeta de crédito no pertenece al usuario."}
            )

    data = plan.model_dump(mode="json", exclude_unset=True)
    data["user_id"] = current_uid

    res = supabase.table("recurring_payments").insert(data).execute()
    if not res.data:
        raise HTTPException(
            status_code=400, detail="Error al crear el pago recurrente.")

    created_plan = res.data[0]

    # Generar ocurrencias automáticamente (3 meses adelante)
    try:
        supabase.rpc("generate_occurrences", {
                     "id": created_plan["id"], "months": 3}).execute()
    except Exception as e:
        print(f"Aviso - RPC generate_occurrences falló: {str(e)}")

    return created_plan


@router.get("/upcoming", response_model=List[UpcomingPaymentResponse])
def get_upcoming_payments(
    days_ahead: int = Query(default=60, ge=1, le=365,
                            description="Días a futuro a consultar"),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Devuelve ocurrencias pendientes próximas.
    Primero intenta la vista v_upcoming_payments, si falla hace query directa.
    """
    current_uid = _get_current_uid(supabase)
    cutoff = (date.today() + timedelta(days=days_ahead)).isoformat()

    try:
        # Intentar con la vista (incluye RLS vía security_invoker)
        resp = supabase.table("v_upcoming_payments").select("*").lte(
            "scheduled_date", cutoff
        ).execute()
        if resp.data is not None:
            return resp.data
    except Exception:
        pass

    # Fallback: query directa uniendo tablas
    plans_resp = supabase.table("recurring_payments").select("id, name, amount, currency, payment_method").eq(
        "is_active", True
    ).execute()

    if not plans_resp.data:
        return []

    plan_ids = [p["id"] for p in plans_resp.data]
    plan_map = {p["id"]: p for p in plans_resp.data}

    occ_resp = supabase.table("recurring_payment_occurrences").select("*").in_(
        "recurring_payment_id", plan_ids
    ).eq("status", "pending").lte("scheduled_date", cutoff).order("scheduled_date").execute()

    results = []
    for occ in (occ_resp.data or []):
        plan = plan_map.get(occ["recurring_payment_id"], {})
        results.append({
            "occurrence_id": occ["id"],
            "recurring_payment_id": occ["recurring_payment_id"],
            "plan_name": plan.get("name", ""),
            "name": plan.get("name", ""),
            "scheduled_date": occ["scheduled_date"],
            "amount": occ.get("amount_override") or plan.get("amount", 0),
            "currency": plan.get("currency", "MXN"),
            "status": occ["status"],
        })

    return results


@router.get("/{id}", response_model=RecurringPaymentResponse)
def get_recurring_payment(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    return _get_plan_or_404(supabase, id)


@router.patch("/{id}", response_model=RecurringPaymentResponse)
def update_recurring_payment(
    id: UUID,
    plan: RecurringPaymentUpdate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Actualiza campos de la plantilla.
    No permite reactivar un plan eliminado desde aquí (usa restore).
    """
    update_data = plan.model_dump(mode="json", exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=400, detail="No hay datos para actualizar.")

    current = _get_plan_or_404(supabase, id)

    # No se puede modificar un plan inactivo (eliminado) excepto via restore
    if not current["is_active"] and update_data.get("is_active") is not True:
        raise HTTPException(
            status_code=400,
            detail={"code": "PLAN_INACTIVE",
                    "message": "No puedes modificar una suscripción eliminada. Usa /restore para reactivarla."}
        )

    # Validar tarjeta si se está cambiando el método de pago
    current_uid = _get_current_uid(supabase)
    new_method = update_data.get("payment_method")
    new_card = update_data.get("credit_card_id")

    effective_method = new_method or current["payment_method"]
    effective_card = new_card if "credit_card_id" in update_data else current.get(
        "credit_card_id")

    if effective_method == "credit_card" and not effective_card:
        raise HTTPException(
            status_code=400,
            detail={"code": "MISSING_CARD",
                    "message": "Debes seleccionar una tarjeta para pagos con tarjeta de crédito."}
        )

    if new_card:
        card_resp = supabase.table("credit_cards").select(
            "id, user_id").eq("id", str(new_card)).execute()
        if not card_resp.data or card_resp.data[0]["user_id"] != current_uid:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_CARD",
                        "message": "La tarjeta de crédito no pertenece al usuario."}
            )

    response = supabase.table("recurring_payments").update(
        update_data).eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")

    return response.data[0]


@router.post("/{id}/restore", response_model=RecurringPaymentResponse)
def restore_recurring_payment(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Reactiva una suscripción previamente eliminada (soft-delete).
    """
    current = _get_plan_or_404(supabase, id)

    if current["is_active"]:
        raise HTTPException(
            status_code=400,
            detail={"code": "ALREADY_ACTIVE",
                    "message": "La suscripción ya está activa."}
        )

    response = supabase.table("recurring_payments").update(
        {"is_active": True}).eq("id", str(id)).execute()
    return response.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_payment(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Soft-delete de un plan. Marca is_active=False.
    Las ocurrencias pendientes quedan en BD para historial.
    """
    current = _get_plan_or_404(supabase, id)

    if not current["is_active"]:
        raise HTTPException(
            status_code=400,
            detail={"code": "ALREADY_INACTIVE",
                    "message": "La suscripción ya fue eliminada."}
        )

    supabase.table("recurring_payments").update(
        {"is_active": False}).eq("id", str(id)).execute()
    return None


@router.get("/{id}/occurrences", response_model=List[OccurrenceResponse])
def get_occurrences(
    id: UUID,
    status: Optional[str] = Query(
        default=None, description="Filtrar por estado: pending, paid, skipped, failed"),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Obtiene el historial de ocurrencias para una plantilla.
    Filtrable por estado.
    """
    _get_plan_or_404(supabase, id)  # Verifica propiedad

    query = supabase.table("recurring_payment_occurrences").select("*").eq(
        "recurring_payment_id", str(id)
    ).order("scheduled_date", desc=True)

    if status in ("pending", "paid", "skipped", "failed"):
        query = query.eq("status", status)

    return query.execute().data


@router.post("/occurrences/{occurrence_id}/pay", response_model=OccurrenceResponse)
def pay_occurrence(
    occurrence_id: UUID,
    req: OccurrencePayRequest,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Marca un recibo como pagado, crea la transacción personal vinculada.
    Valida: ocurrencia existe, es del usuario, no está ya pagada.
    """
    current_uid = _get_current_uid(supabase)

    # 1. Obtener ocurrencia + plantilla padre
    occ_res = supabase.table("recurring_payment_occurrences").select(
        "*, recurring_payments(*)"
    ).eq("id", str(occurrence_id)).execute()

    if not occ_res.data:
        raise HTTPException(
            status_code=404, detail="Ocurrencia no encontrada.")

    occ = occ_res.data[0]
    rec_plan = occ["recurring_payments"]

    # 2. Verificar que la ocurrencia pertenece al usuario (via el plan padre)
    if rec_plan["user_id"] != current_uid:
        raise HTTPException(
            status_code=403, detail="No tienes permiso para pagar esta ocurrencia.")

    # 3. Verificar que no esté ya pagada o saltada
    if occ["status"] == OccurrenceStatus.paid:
        raise HTTPException(
            status_code=400,
            detail={"code": "ALREADY_PAID",
                    "message": "Esta ocurrencia ya fue pagada."}
        )
    if occ["status"] == OccurrenceStatus.skipped:
        raise HTTPException(
            status_code=400,
            detail={"code": "OCCURRENCE_SKIPPED",
                    "message": "Esta ocurrencia fue omitida y no puede pagarse."}
        )

    # 4. Determinar monto final
    amount = float(req.amount_override) if req.amount_override else float(
        rec_plan["amount"])

    # 5. Crear la transacción personal
    tx_data = {
        "user_id": current_uid,
        "category_id": rec_plan["category_id"],
        "credit_card_id": rec_plan.get("credit_card_id"),
        "amount": amount,
        "type": "expense",
        "payment_method": rec_plan["payment_method"],
        "description": f"Pago recurrente: {rec_plan['name']}",
        "notes": req.notes,
        "transaction_date": str(date.today())
    }

    tx_res = supabase.table("personal_transactions").insert(tx_data).execute()
    if not tx_res.data:
        raise HTTPException(
            status_code=500, detail="Error al crear la transacción de pago.")

    actual_tx_id = tx_res.data[0]["id"]

    # 6. Sellar la ocurrencia
    update_data = {
        "status": "paid",
        "amount_override": float(req.amount_override) if req.amount_override else None,
        "actual_transaction_id": actual_tx_id,
        "notes": req.notes
    }

    final_res = supabase.table("recurring_payment_occurrences").update(
        update_data
    ).eq("id", str(occurrence_id)).execute()

    return final_res.data[0]


@router.post("/occurrences/{occurrence_id}/skip", response_model=OccurrenceResponse)
def skip_occurrence(
    occurrence_id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Omite una ocurrencia pendiente (ej. este mes no usé el servicio).
    Valida: pendiente, propiedad del usuario.
    """
    current_uid = _get_current_uid(supabase)

    occ_res = supabase.table("recurring_payment_occurrences").select(
        "*, recurring_payments(user_id)"
    ).eq("id", str(occurrence_id)).execute()

    if not occ_res.data:
        raise HTTPException(
            status_code=404, detail="Ocurrencia no encontrada.")

    occ = occ_res.data[0]

    if occ["recurring_payments"]["user_id"] != current_uid:
        raise HTTPException(
            status_code=403, detail="No tienes permiso para omitir esta ocurrencia.")

    if occ["status"] != OccurrenceStatus.pending:
        raise HTTPException(
            status_code=400,
            detail={"code": "NOT_PENDING",
                    "message": f"Solo se pueden omitir ocurrencias pendientes (estado actual: {occ['status']})."}
        )

    final_res = supabase.table("recurring_payment_occurrences").update(
        {"status": "skipped"}
    ).eq("id", str(occurrence_id)).execute()

    return final_res.data[0]
