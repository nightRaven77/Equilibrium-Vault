from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from decimal import Decimal

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.couples import (
    CoupleCreate,
    CoupleUpdate,
    CoupleResponse,
    CoupleTransactionCreate,
    CoupleTransactionResponse,
    CoupleBalanceResponse
)

router = APIRouter(prefix="/couples", tags=["couples"])


@router.get("/", response_model=List[CoupleResponse])
def get_couples(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene los vínculos de pareja del usuario autenticado.
    RLS garantiza que solo se retornan donde user1_id o user2_id es el id en sesión.
    """
    response = supabase.table("couples").select("*").execute()
    return response.data


@router.post("/", response_model=CoupleResponse, status_code=status.HTTP_201_CREATED)
def create_couple(
    couple: CoupleCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea un nuevo vínculo de pareja.
    """
    data = couple.model_dump(mode="json", exclude_unset=True)
    user = supabase.auth.get_user().user
    data["user1_id"] = str(user.id)
    # Default status and avoiding double entry can be handled via DB triggers/indexes

    response = supabase.table("couples").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Error creando el vínculo de pareja")
    
    return response.data[0]


@router.patch("/{id}", response_model=CoupleResponse)
def update_couple(
    id: UUID, 
    couple: CoupleUpdate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Actualiza datos del vínculo, como su estado (abierto/inactivo) o nombre.
    """
    data = couple.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    
    response = supabase.table("couples").update(data).eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Vínculo no encontrado o sin permisos")
        
    return response.data[0]


@router.get("/{id}/transactions", response_model=List[CoupleTransactionResponse])
def get_couple_transactions(
    id: UUID, 
    status: Optional[str] = None, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Lista todos los gastos compartidos de este vínculo.
    Se puede filtrar usando query param, ej: ?status=pending
    """
    query = supabase.table("couple_transactions").select("*").eq("couple_id", str(id))
    if status is not None:
        query = query.eq("status", status)
    
    response = query.execute()
    return response.data


@router.post("/{id}/transactions", response_model=CoupleTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_couple_transaction(
    id: UUID, 
    transaction: CoupleTransactionCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea un gasto compartido para el vínculo, usando porcentajes de distribución para los usuarios.
    """
    if transaction.user1_share_pct + transaction.user2_share_pct != Decimal("100.00"):
        raise HTTPException(status_code=400, detail="Los porcentajes deben sumar 100")
        
    data = transaction.model_dump(mode="json", exclude_unset=True)
    data["couple_id"] = str(id)
    
    # Trigger db level handles if paid_by_user_id is valid member
    response = supabase.table("couple_transactions").insert(data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Error registrando el gasto compartido")
        
    return response.data[0]


@router.patch("/{id}/transactions/{tx_id}/settle", response_model=CoupleTransactionResponse)
def settle_transaction(
    id: UUID, 
    tx_id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Marca un gasto compartido como liquidado (settled).
    """
    response = supabase.table("couple_transactions").update({"status": "settled"}).eq("id", str(tx_id)).eq("couple_id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Transacción no encontrada o inmodificable")
        
    return response.data[0]


@router.get("/{id}/balance", response_model=CoupleBalanceResponse)
def get_couple_balance(
    id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Obtiene el balance actual a través de la vista v_couple_balance.
    Interpreta el resultado "user2_owes_user1" para definir deudores de manera legible.
    """
    # 1. Obtener la pareja para determinar qué ID es user1 y cuál user2
    couple_resp = supabase.table("couples").select("user1_id, user2_id").eq("id", str(id)).execute()
    if not couple_resp.data:
        raise HTTPException(status_code=404, detail="Vínculo no encontrado")
        
    couple = couple_resp.data[0]
    user1_id = couple["user1_id"]
    user2_id = couple["user2_id"]
    current_uid = str(supabase.auth.get_user().user.id)
    
    # 2. Consultar perfiles para nombres humanizados
    profiles_resp = supabase.table("profiles").select("id, full_name").in_("id", [user1_id, user2_id]).execute()
    names = {p["id"]: p["full_name"] for p in profiles_resp.data}
    
    user1_name = names.get(user1_id, "Tú" if user1_id == current_uid else "Pareja")
    user2_name = names.get(user2_id, "Tú" if user2_id == current_uid else "Pareja")
    
    # 3. Leer saldo de v_couple_balance
    balance_resp = supabase.table("v_couple_balance").select("*").eq("couple_id", str(id)).execute()
    
    if not balance_resp.data:
        return CoupleBalanceResponse(amount=Decimal("0.00"), is_settled=True)
        
    row = balance_resp.data[0]
    raw_amount = row.get("user2_owes_user1")
    
    if raw_amount is None:
        return CoupleBalanceResponse(amount=Decimal("0.00"), is_settled=True)
        
    amount = Decimal(str(raw_amount))
    
    # 4. Formatear la dirección
    if amount == Decimal("0.00"):
        return CoupleBalanceResponse(amount=Decimal("0.00"), is_settled=True)
        
    elif amount > 0:
        # User 2 le debe a User 1
        return CoupleBalanceResponse(
            debtor_id=UUID(user2_id),
            creditor_id=UUID(user1_id),
            debtor_name=user2_name,
            creditor_name=user1_name,
            amount=amount,
            is_settled=False
        )
    else:
        # User 1 le debe a User 2
        return CoupleBalanceResponse(
            debtor_id=UUID(user1_id),
            creditor_id=UUID(user2_id),
            debtor_name=user1_name,
            creditor_name=user2_name,
            amount=abs(amount),
            is_settled=False
        )
