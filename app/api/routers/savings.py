from fastapi import APIRouter, Depends
from supabase import Client
from app.api.dependencies.auth import get_current_user_supplier

router = APIRouter(prefix="/savings", tags=["savings"])

@router.get("/")
def get_savings(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene las metas de ahorro del usuario.
    (Placeholder)
    """
    return {"message": "Lista de metas de ahorro"}
