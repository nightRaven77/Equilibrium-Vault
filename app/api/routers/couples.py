from fastapi import APIRouter, Depends
from supabase import Client
from app.api.dependencies.auth import get_current_user_supplier

router = APIRouter(prefix="/couples", tags=["couples"])

@router.get("/")
def get_couples(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene los vínculos de pareja del usuario.
    (Placeholder)
    """
    return {"message": "Lista de parejas"}
