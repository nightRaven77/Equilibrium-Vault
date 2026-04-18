from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from datetime import date

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.personal import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    MonthlySummaryRead,
    InstallmentPlanResponse,
)
from app.services.personal_service import PersonalTransactionService

router = APIRouter(prefix="/personal", tags=["personal"])

def get_personal_service(supabase: Client = Depends(get_current_user_supplier)):
    return PersonalTransactionService(supabase)


@router.get("/", response_model=List[TransactionResponse])
def get_personal_transactions(supabase: Client = Depends(get_current_user_supplier)):
    """
    Lista todas las transacciones personales del usuario autenticado.
    El filtrado por usuario se aplica automáticamente gracias al RLS de Supabase.
    """
    response = supabase.table("personal_transactions").select("*").execute()
    return response.data


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
    Elimina una transacción.
    """
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
