import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.auth import UpdateNameRequest, UpdatePasswordRequest

router = APIRouter(prefix="/profile", tags=["profile"])


@router.patch("/name")
def update_profile_name(
    request: UpdateNameRequest,
    supabase: Client = Depends(get_current_user_supplier)
):
    user = supabase.auth.get_user().user
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")

    response = supabase.table("profiles").update(
        {"full_name": request.full_name}).eq("id", str(user.id)).execute()

    if not response.data:
        raise HTTPException(
            status_code=400, detail="No se pudo actualizar el nombre")

    return {"message": "Nombre actualizado con éxito", "full_name": request.full_name}


@router.patch("/password")
def update_profile_password(
    request: UpdatePasswordRequest,
    supabase: Client = Depends(get_current_user_supplier)
):
    try:
        supabase.auth.update_user({"password": request.password})
        return {"message": "Contraseña actualizada con éxito"}
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"No se pudo actualizar la contraseña: {str(e)}")


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_current_user_supplier)
):
    user = supabase.auth.get_user().user
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")

    # Validar tipo de archivo
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="El archivo debe ser una imagen válida.")

    file_content = await file.read()

    # Validar tamaño del archivo (3MB = 3 * 1024 * 1024 bytes)
    if len(file_content) > 3 * 1024 * 1024:
        raise HTTPException(
            status_code=400, detail="La imagen no debe superar los 3MB.")

    # Intentar asegurar que el bucket exista (ignora error si no hay permisos)
    try:
        supabase.storage.get_bucket("avatars")
    except Exception:
        try:
            supabase.storage.create_bucket("avatars", {"public": True})
        except Exception:
            pass

    file_extension = file.filename.split(
        ".")[-1] if "." in file.filename else "jpg"
    file_name = f"{user.id}_{uuid.uuid4().hex[:8]}.{file_extension}"

    try:
        supabase.storage.from_("avatars").upload(
            path=file_name,
            file=file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error en Storage (Upload): {str(e)}")

    try:
        # Obtener URL pública
        public_url = supabase.storage.from_("avatars").get_public_url(file_name)
        
        # Actualizar perfil
        supabase.table("profiles").update(
            {"avatar_url": public_url}).eq("id", str(user.id)).execute()
        
        return {"message": "Avatar actualizado con éxito", "avatar_url": public_url}
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error en Database (Update Profile): {str(e)}")
