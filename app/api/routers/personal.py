from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.personal import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    MonthlySummaryRead,
)

router = APIRouter(prefix="/personal", tags=["personal"])


@router.get("/", response_model=List[TransactionResponse])
def get_personal_transactions(supabase: Client = Depends(get_current_user_supplier)):
    """
    Lista todas las transacciones personales del usuario autenticado.
    El filtrado por usuario se aplica automáticamente gracias al RLS de Supabase.
    """
    response = supabase.table("personal_transactions").select("*").execute()
    return response.data


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_personal_transaction(
    transaction: TransactionCreate, 
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una nueva transacción personal.
    """
    # Excluimos unset y lo convertimos a formato json compatible con postgREST (stringificando UUIDs, dates, etc)
    data = transaction.model_dump(mode="json", exclude_unset=True)
    
    # También inyectaremos el user_id manualmente para asegurarnos, 
    # aunque si el RLS / default db rules lo tienen configurado podría ser omitido.
    # supabase.auth.get_user() nos devuelve el perfil validado del backend
    user = supabase.auth.get_user().user
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
