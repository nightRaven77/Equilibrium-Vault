from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.savings import (
    SavingGoalCreate,
    SavingGoalUpdate,
    SavingGoalResponse,
    SavingGoalSummaryResponse,
    SavingTransactionCreate,
    SavingTransactionResponse
)
from app.schemas.enums import SavingGoalStatus, SavingTransactionType

router = APIRouter(prefix="/savings", tags=["savings"])


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_goal_or_404(supabase: Client, id: UUID) -> dict:
    """Retorna la meta o lanza 404. Confirma que pertenece al usuario autenticado por RLS."""
    resp = supabase.table("saving_goals").select("*").eq("id", str(id)).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
    return resp.data[0]


def _get_current_balance(supabase: Client, id: UUID) -> float:
    """Lee el balance actual. Intenta la vista primero, luego calcula desde transacciones."""
    # Intento 1: vista de resumen (más rápido)
    try:
        resp = supabase.table("v_saving_goals_summary").select("current_balance").eq("id", str(id)).execute()
        if resp.data and resp.data[0].get("current_balance") is not None:
            return float(resp.data[0]["current_balance"])
    except Exception:
        pass

    # Intento 2: cálculo directo desde saving_transactions (fallback)
    tx_resp = supabase.table("saving_transactions").select("amount, type").eq("saving_goal_id", str(id)).execute()
    balance = 0.0
    for tx in tx_resp.data:
        amount = float(tx.get("amount", 0))
        if tx.get("type") in ("deposit", "interest"):
            balance += amount
        elif tx.get("type") == "withdrawal":
            balance -= amount
    return balance


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SavingGoalSummaryResponse])
def get_savings(supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene las metas de ahorro del usuario consultando la vista de resumen."""
    response = supabase.table("v_saving_goals_summary").select("*").execute()
    return response.data


@router.post("/", response_model=SavingGoalResponse, status_code=status.HTTP_201_CREATED)
def create_saving_goal(
    goal: SavingGoalCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Crea una nueva meta de ahorro validando nombre duplicado."""
    user = supabase.auth.get_user().user
    
    # 1. Validar nombre duplicado (mismo usuario, mismo nombre, meta activa)
    existing = supabase.table("saving_goals").select("id").eq(
        "user_id", str(user.id)
    ).eq("name", goal.name).in_("status", ["active", "paused"]).execute()
    
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail={"code": "DUPLICATE_GOAL", "message": f"Ya tienes una meta de ahorro activa llamada '{goal.name}'."}
        )

    data = goal.model_dump(mode="json", exclude_unset=True)
    data["user_id"] = str(user.id)

    response = supabase.table("saving_goals").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Error creando la meta de ahorro")

    return response.data[0]


@router.get("/{id}", response_model=SavingGoalResponse)
def get_saving_goal(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Detalle de una meta específica."""
    return _get_goal_or_404(supabase, id)


@router.patch("/{id}", response_model=SavingGoalResponse)
def update_saving_goal(
    id: UUID,
    goal: SavingGoalUpdate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Modifica una meta de ahorro."""
    data = goal.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")

    current = _get_goal_or_404(supabase, id)

    # 1. No se puede modificar una meta cancelada
    if current["status"] == SavingGoalStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail={"code": "GOAL_CANCELLED", "message": "No puedes modificar una meta de ahorro cancelada."}
        )

    # 2. Validar nombre duplicado si se está cambiando el nombre
    if "name" in data and data["name"] != current["name"]:
        existing = supabase.table("saving_goals").select("id").eq(
            "user_id", current["user_id"]
        ).eq("name", data["name"]).in_("status", ["active", "paused"]).execute()
        if existing.data:
            raise HTTPException(
                status_code=400,
                detail={"code": "DUPLICATE_GOAL", "message": f"Ya tienes una meta de ahorro activa llamada '{data['name']}'."}
            )

    # 3. Validar que no se baje el target por debajo del balance actual
    if "target_amount" in data:
        balance = _get_current_balance(supabase, id)
        if float(data["target_amount"]) < balance:
            raise HTTPException(
                status_code=400,
                detail={"code": "TARGET_TOO_LOW", "message": f"El nuevo objetivo (${float(data['target_amount']):,.2f}) no puede ser menor a tu balance actual (${balance:,.2f})."}
            )

    response = supabase.table("saving_goals").update(data).eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")

    return response.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_saving_goal(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Cancela (soft-delete) una meta de ahorro. No se puede cancelar si tiene balance pendiente."""
    current = _get_goal_or_404(supabase, id)

    if current["status"] == SavingGoalStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail={"code": "ALREADY_CANCELLED", "message": "Esta meta ya está cancelada."}
        )

    # Proteger metas con balance: exigir retiro previo
    balance = _get_current_balance(supabase, id)
    if balance > 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "HAS_BALANCE", "message": f"Esta meta tiene un balance de ${balance:,.2f}. Retira los fondos antes de cancelarla."}
        )

    supabase.table("saving_goals").update({"status": "cancelled"}).eq("id", str(id)).execute()
    return None


@router.get("/{id}/transactions", response_model=List[SavingTransactionResponse])
def get_saving_transactions(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Obtiene todos los movimientos de una meta."""
    _get_goal_or_404(supabase, id)  # Verifica existencia y propiedad
    response = supabase.table("saving_transactions").select("*").eq(
        "saving_goal_id", str(id)
    ).order("transaction_date", desc=True).execute()
    return response.data


@router.post("/{id}/transactions", response_model=SavingTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_saving_transaction(
    id: UUID,
    transaction: SavingTransactionCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Registra un depósito o retiro hacia la meta de ahorro."""
    current = _get_goal_or_404(supabase, id)

    # 1. Bloquear operaciones en metas terminadas
    if current["status"] in (SavingGoalStatus.completed, SavingGoalStatus.cancelled):
        raise HTTPException(
            status_code=400,
            detail={"code": "GOAL_CLOSED", "message": f"No puedes registrar movimientos en una meta '{current['status']}'."}
        )

    # 2. Validar que un retiro no deje el balance negativo
    if transaction.type == SavingTransactionType.withdrawal:
        balance = _get_current_balance(supabase, id)
        if float(transaction.amount) > balance:
            raise HTTPException(
                status_code=400,
                detail={"code": "INSUFFICIENT_BALANCE", "message": f"El retiro (${float(transaction.amount):,.2f}) supera tu balance disponible (${balance:,.2f})."}
            )

    data = transaction.model_dump(mode="json", exclude_unset=True)
    data["saving_goal_id"] = str(id)

    # La BD tiene chk_amount_sign: withdrawals deben guardarse con amount negativo
    if transaction.type == SavingTransactionType.withdrawal:
        data["amount"] = -abs(float(data["amount"]))

    response = supabase.table("saving_transactions").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Error registrando la transacción de ahorro")

    return response.data[0]


@router.post("/{id}/interest")
def apply_interest(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """Materializa el interés sobre el balance actual vía Stored Procedure de Supabase."""
    current = _get_goal_or_404(supabase, id)

    # Solo aplicar interés a metas activas con tasa > 0
    if current["status"] != SavingGoalStatus.active:
        raise HTTPException(
            status_code=400,
            detail={"code": "GOAL_NOT_ACTIVE", "message": "Solo se pueden aplicar intereses a metas activas."}
        )

    if float(current.get("annual_rate_pct", 0)) == 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "NO_RATE", "message": "Esta meta no tiene tasa de interés configurada."}
        )

    try:
        response = supabase.rpc('apply_periodic_interest', {'goal_id': str(id)}).execute()
        return {"status": "success", "message": "Intereses aplicados correctamente", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error aplicando interés: {str(e)}")
