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

router = APIRouter(prefix="/savings", tags=["savings"])

@router.get("/", response_model=List[SavingGoalSummaryResponse])
def get_savings(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene las metas de ahorro del usuario, consultando directamente la vista
    que entrega balances precalculados (`v_saving_goals_summary`).
    """
    response = supabase.table("v_saving_goals_summary").select("*").execute()
    return response.data

@router.post("/", response_model=SavingGoalResponse, status_code=status.HTTP_201_CREATED)
def create_saving_goal(
    goal: SavingGoalCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una nueva meta de ahorro.
    """
    data = goal.model_dump(mode="json", exclude_unset=True)
    user = supabase.auth.get_user().user
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
    """
    Detalle de una meta específica.
    """
    response = supabase.table("saving_goals").select("*").eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
        
    return response.data[0]

@router.patch("/{id}", response_model=SavingGoalResponse)
def update_saving_goal(
    id: UUID, 
    goal: SavingGoalUpdate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Modifica una meta de ahorro (ej. cambiar status a paused).
    """
    data = goal.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    
    response = supabase.table("saving_goals").update(data).eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
        
    return response.data[0]

@router.get("/{id}/transactions", response_model=List[SavingTransactionResponse])
def get_saving_transactions(
    id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Obtiene todos los movimientos de una meta.
    """
    response = supabase.table("saving_transactions").select("*").eq("saving_goal_id", str(id)).execute()
    return response.data

@router.post("/{id}/transactions", response_model=SavingTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_saving_transaction(
    id: UUID, 
    transaction: SavingTransactionCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Registra un depósito o retiro manual hacia la meta de ahorro.
    """
    data = transaction.model_dump(mode="json", exclude_unset=True)
    data["saving_goal_id"] = str(id)
    
    response = supabase.table("saving_transactions").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Error registrando la transacción de ahorro")
        
    return response.data[0]

@router.post("/{id}/interest")
def apply_interest(
    id: UUID, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Materializa el interés sobre el balance actual comunicándose con el Procedure de Supabase.
    """
    try:
        response = supabase.rpc('apply_periodic_interest', {'goal_id': str(id)}).execute()
        return {"status": "success", "message": "Intereses aplicados correctamente", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error aplicando interés: {str(e)}")
