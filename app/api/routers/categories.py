from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException,status
from supabase import Client
from app.schemas.categories import CategoryResponse, CategoryCreate, CategoryUpdate

#esto indica si el ususario esta autenticado y muestra el jwt
from app.api.dependencies.auth import get_current_user_supplier

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/{type}", response_model=List[CategoryResponse])
def get_categories(type: str, supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene todas las categorías del usuario autenticado.
    """
    response = supabase.table("categories").select("*").eq("type",type).execute()
    return response.data
