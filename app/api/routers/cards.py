import calendar
from datetime import date, timedelta
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.cards import (
    CreditCardCreate,
    CreditCardUpdate,
    CreditCardResponse,
    CardStatementResponse,
)

router = APIRouter(prefix="/cards", tags=["cards"])

def calculate_next_cutoff_python(cutoff_day: int, from_date: date) -> date:
    """Fallback si RLS o el RPC falla."""
    target_month = from_date.month
    target_year = from_date.year
    if from_date.day > cutoff_day:
        target_month += 1
        if target_month > 12:
            target_month = 1
            target_year += 1
    _, last_day_of_month = calendar.monthrange(target_year, target_month)
    actual_day = min(cutoff_day, last_day_of_month)
    return date(target_year, target_month, actual_day)


@router.get("/", response_model=List[CreditCardResponse])
def get_credit_cards(supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene las tarjetas de crédito activas del usuario autenticado."""
    response = supabase.table("credit_cards").select("*").eq("is_active", True).execute()
    return response.data


@router.post("/", response_model=CreditCardResponse, status_code=status.HTTP_201_CREATED)
def create_credit_card(
    card: CreditCardCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una tarjeta de crédito y su primer estado de cuenta (statement) abierto.
    """
    user = supabase.auth.get_user().user
    card_data = card.model_dump(mode="json", exclude_unset=True)
    card_data["user_id"] = str(user.id)

    # 1. Insertamos la tarjeta
    card_res = supabase.table("credit_cards").insert(card_data).execute()
    if not card_res.data:
        raise HTTPException(status_code=400, detail="No se pudo crear la tarjeta")
    created_card = card_res.data[0]
    
    # 2. Generar el estado de cuenta
    today = date.today()
    cutoff_date_str = None
    try:
        # Intentamos con RPC 
        rpc_res = supabase.rpc(
            "next_cutoff_date", 
            {"day": card.cutoff_day, "from_date": str(today)}
        ).execute()
        if rpc_res.data:
             cutoff_date_str = rpc_res.data
    except Exception:
        pass
        
    if not cutoff_date_str:
        # Fallback de Python
        cutoff_date = calculate_next_cutoff_python(card.cutoff_day, today)
    else:
        # Si vino del RPC es string, lo pasamos a date para sumar días
        cutoff_date = date.fromisoformat(str(cutoff_date_str).split("T")[0])
        
    payment_due_date = cutoff_date + timedelta(days=card.payment_due_days)

    statement_data = {
        "credit_card_id": created_card["id"],
        "cutoff_date": str(cutoff_date),
        "payment_due_date": str(payment_due_date),
        "total_balance": 0.00,
        "minimum_payment": 0.00,
        "status": "open"
    }
    
    # 3. Insertar statement
    supabase.table("card_statements").insert(statement_data).execute()

    return created_card


@router.get("/{id}", response_model=CreditCardResponse)
def get_credit_card(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    response = supabase.table("credit_cards").select("*").eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return response.data[0]


@router.patch("/{id}", response_model=CreditCardResponse)
def update_credit_card(
    id: UUID, 
    card: CreditCardUpdate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    update_data = card.model_dump(mode="json", exclude_unset=True)
    if not update_data:
         raise HTTPException(status_code=400, detail="No hay datos para actualizar")
         
    response = supabase.table("credit_cards").update(update_data).eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return response.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credit_card(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    """Aplica soft-delete (is_active = FALSE) a la tarjeta"""
    response = supabase.table("credit_cards").update({"is_active": False}).eq("id", str(id)).execute()
    if not response.data:
         raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return None


@router.get("/{id}/statements", response_model=List[CardStatementResponse])
def get_card_statements(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene los estados de cuenta (historial de cortes) de la tarjeta."""
    response = supabase.table("card_statements").select("*").eq("credit_card_id", str(id)).order("cutoff_date", desc=True).execute()
    return response.data
