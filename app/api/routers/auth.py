from fastapi import APIRouter, HTTPException, status
from supabase import Client
from app.db.supabase import get_supabase_client
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """
    Inicia sesión con correo y contraseña.
    Retorna el JWT (access_token) que se enviará en el Header 'Authorization' 
    de las demás peticiones que requieren el middleware (RLS).
    """
    supabase: Client = get_supabase_client()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        session = response.session
        user = response.user
        
        if not session or not user:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
             )
             
        return LoginResponse(
            access_token=session.access_token,
            token_type="Bearer",
            user_id=str(user.id),
            email=user.email
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de autenticación: {str(e)}",
        )
