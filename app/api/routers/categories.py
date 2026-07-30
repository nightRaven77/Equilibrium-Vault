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
    Si la lista está vacía (por ejemplo, porque el trigger de base de datos no se ejecutó
    o el usuario se creó manualmente), se siembran automáticamente las categorías por defecto.
    """
    # Buscamos todas las categorías del usuario (de cualquier tipo)
    response = supabase.table("categories").select("*").execute()
    
    if not response.data:
        try:
            # Obtenemos el ID del usuario autenticado desde el cliente de Supabase
            user_resp = supabase.auth.get_user()
            if user_resp and user_resp.user:
                user_id = str(user_resp.user.id)
                
                default_categories = [
                    # Gastos
                    {"user_id": user_id, "name": "Vivienda", "icon": "🏠", "color": "#FF5E5E", "type": "expense"},
                    {"user_id": user_id, "name": "Alimentación", "icon": "🍔", "color": "#FFAB40", "type": "expense"},
                    {"user_id": user_id, "name": "Transporte", "icon": "🚗", "color": "#448AFF", "type": "expense"},
                    {"user_id": user_id, "name": "Servicios", "icon": "🔌", "color": "#FFD740", "type": "expense"},
                    {"user_id": user_id, "name": "Salud", "icon": "🏥", "color": "#69F0AE", "type": "expense"},
                    {"user_id": user_id, "name": "Educación", "icon": "🎓", "color": "#E040FB", "type": "expense"},
                    {"user_id": user_id, "name": "Compras", "icon": "🛍️", "color": "#FF4081", "type": "expense"},
                    {"user_id": user_id, "name": "Entretenimiento", "icon": "🍿", "color": "#7C4DFF", "type": "expense"},
                    {"user_id": user_id, "name": "Viajes", "icon": "✈️", "color": "#18FFFF", "type": "expense"},
                    {"user_id": user_id, "name": "Otros Gastos", "icon": "📦", "color": "#B0BEC5", "type": "expense"},
                    
                    # Ingresos
                    {"user_id": user_id, "name": "Salario", "icon": "💼", "color": "#4CAF50", "type": "income"},
                    {"user_id": user_id, "name": "Inversiones", "icon": "📈", "color": "#00E676", "type": "income"},
                    {"user_id": user_id, "name": "Regalos", "icon": "🎁", "color": "#00B0FF", "type": "income"},
                    {"user_id": user_id, "name": "Otros Ingresos", "icon": "💰", "color": "#00E5FF", "type": "income"},
                ]
                # Insertamos todas las categorías en la base de datos
                supabase.table("categories").insert(default_categories).execute()
                # Volvemos a consultar para tener los datos de la BD con sus IDs generados
                response = supabase.table("categories").select("*").execute()
        except Exception as e:
            # En caso de error en la siembra, lo registramos pero dejamos que continúe el flujo
            print(f"Error al sembrar categorías por defecto: {e}")

    # Filtramos en memoria de Python por el tipo solicitado para ahorrar un query extra a la BD
    return [cat for cat in response.data if cat.get("type") == type]

