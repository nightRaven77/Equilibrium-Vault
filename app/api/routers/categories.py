from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from app.schemas.categories import CategoryResponse, CategoryCreate, CategoryUpdate
from app.api.dependencies.auth import get_current_user_supplier

router = APIRouter(prefix="/categories", tags=["categories"])


def _ensure_default_categories(supabase: Client) -> List[dict]:
    """Obtiene categorías o siembra las 14 por defecto si la lista está vacía."""
    response = supabase.table("categories").select("*").execute()
    if response.data:
        return response.data

    try:
        user_resp = supabase.auth.get_user()
        if user_resp and user_resp.user:
            user_id = str(user_resp.user.id)
            default_categories = [
                # Gastos
                {"user_id": user_id, "name": "Vivienda", "icon": "🏠", "color": "#FF5E5E", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Alimentación", "icon": "🍔", "color": "#FFAB40", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Transporte", "icon": "🚗", "color": "#448AFF", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Servicios", "icon": "🔌", "color": "#FFD740", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Salud", "icon": "🏥", "color": "#69F0AE", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Educación", "icon": "🎓", "color": "#E040FB", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Compras", "icon": "🛍️", "color": "#FF4081", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Entretenimiento", "icon": "🍿", "color": "#7C4DFF", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Viajes", "icon": "✈️", "color": "#18FFFF", "type": "expense", "is_default": True},
                {"user_id": user_id, "name": "Otros Gastos", "icon": "📦", "color": "#B0BEC5", "type": "expense", "is_default": True},
                
                # Ingresos
                {"user_id": user_id, "name": "Salario", "icon": "💼", "color": "#4CAF50", "type": "income", "is_default": True},
                {"user_id": user_id, "name": "Inversiones", "icon": "📈", "color": "#00E676", "type": "income", "is_default": True},
                {"user_id": user_id, "name": "Regalos", "icon": "🎁", "color": "#00B0FF", "type": "income", "is_default": True},
                {"user_id": user_id, "name": "Otros Ingresos", "icon": "💰", "color": "#00E5FF", "type": "income", "is_default": True},
            ]
            supabase.table("categories").insert(default_categories).execute()
            response = supabase.table("categories").select("*").execute()
            return response.data or []
    except Exception as e:
        print(f"Error al sembrar categorías por defecto: {e}")

    return response.data or []


@router.get("/", response_model=List[CategoryResponse])
def get_all_categories(
    type: Optional[str] = Query(default=None, description="Filtrar por tipo (income, expense, transfer)"),
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Lista todas las categorías del usuario autenticado.
    Opcionalmente se puede filtrar por tipo (?type=expense).
    """
    categories = _ensure_default_categories(supabase)
    if type:
        return [cat for cat in categories if cat.get("type") == type]
    return categories


@router.get("/{type}", response_model=List[CategoryResponse])
def get_categories(type: str, supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene las categorías filtradas por tipo (income o expense).
    Retrocompatible con clientes existentes.
    """
    categories = _ensure_default_categories(supabase)
    return [cat for cat in categories if cat.get("type") == type]


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category: CategoryCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una categoría personalizada para el usuario autenticado.
    Valida unicidad de nombre por usuario y tipo.
    """
    user = supabase.auth.get_user().user

    # Validar duplicados para el mismo usuario y tipo
    existing = supabase.table("categories").select("id").eq("user_id", str(user.id)).ilike("name", category.name.strip()).eq("type", category.type.value).execute()
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail={"code": "DUPLICATE_CATEGORY", "message": f"Ya tienes una categoría llamada '{category.name}' para {category.type.value}."}
        )

    payload = {
        "user_id": str(user.id),
        "name": category.name.strip(),
        "icon": category.icon,
        "color": category.color,
        "type": category.type.value,
        "is_default": False
    }

    res = supabase.table("categories").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error al crear la categoría.")

    return res.data[0]


@router.patch("/{id}", response_model=CategoryResponse)
def update_category(
    id: UUID,
    category: CategoryUpdate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Actualiza el nombre, icono o color de una categoría existente.
    """
    user = supabase.auth.get_user().user

    # Verificar existencia
    cat_resp = supabase.table("categories").select("*").eq("id", str(id)).execute()
    if not cat_resp.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    current_cat = cat_resp.data[0]

    update_data = category.model_dump(mode="json", exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")

    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()
        # Verificar duplicados si cambió el nombre
        if update_data["name"].lower() != current_cat["name"].lower():
            existing = supabase.table("categories").select("id").eq("user_id", str(user.id)).ilike("name", update_data["name"]).eq("type", current_cat["type"]).execute()
            if existing.data:
                raise HTTPException(
                    status_code=400,
                    detail={"code": "DUPLICATE_CATEGORY", "message": f"Ya tienes una categoría llamada '{update_data['name']}'."}
                )

    res = supabase.table("categories").update(update_data).eq("id", str(id)).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error al actualizar la categoría.")

    return res.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Elimina una categoría personalizada.
    No permite eliminar categorías marcadas como is_default ni categorías que tengan transacciones asociadas.
    """
    # 1. Verificar existencia
    cat_resp = supabase.table("categories").select("*").eq("id", str(id)).execute()
    if not cat_resp.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    cat = cat_resp.data[0]

    # 2. Bloquear eliminación de categorías default
    if cat.get("is_default"):
        raise HTTPException(
            status_code=400,
            detail={"code": "DEFAULT_CATEGORY", "message": "No se pueden eliminar las categorías base del sistema."}
        )

    # 3. Validar si tiene transacciones personales
    tx_check = supabase.table("personal_transactions").select("id", count="exact").eq("category_id", str(id)).limit(1).execute()
    if tx_check.count and tx_check.count > 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "CATEGORY_IN_USE", "message": "No se puede eliminar la categoría porque tiene transacciones registradas."}
        )

    # 4. Validar pagos recurrentes
    rec_check = supabase.table("recurring_payments").select("id", count="exact").eq("category_id", str(id)).limit(1).execute()
    if rec_check.count and rec_check.count > 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "CATEGORY_IN_USE", "message": "No se puede eliminar la categoría porque está asociada a pagos recurrentes."}
        )

    # 5. Eliminar
    supabase.table("categories").delete().eq("id", str(id)).execute()
    return None

