from fastapi import APIRouter, HTTPException, status
from supabase import Client
from app.db.supabase import get_supabase_client
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest):
    """
    Crea una nueva cuenta de usuario en Supabase Auth.
    El trigger handle_new_user() en la BD crea automáticamente el perfil con full_name.
    Retorna el JWT listo para usar (auto-login tras registro).
    """
    supabase: Client = get_supabase_client()
    try:
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name,
                }
            }
        })

        user = response.user
        session = response.session

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo crear la cuenta. El email puede ya estar registrado."
            )

        # Si el proyecto tiene confirmación de email habilitada, session puede ser None
        if not session:
            return LoginResponse(
                access_token="",
                token_type="Bearer",
                user_id=str(user.id),
                email=user.email or request.email,
                full_name=request.full_name,
                avatar_url=None
            )

        return LoginResponse(
            access_token=session.access_token,
            token_type="Bearer",
            user_id=str(user.id),
            email=user.email or request.email,
            full_name=request.full_name,
            avatar_url=None
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg or "already been registered" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "EMAIL_EXISTS", "message": "Este email ya está registrado. Intenta iniciar sesión."}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar: {error_msg}",
        )


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """
    Inicia sesión con correo y contraseña.
    Retorna el JWT (access_token) + datos básicos del perfil.
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

        # Enriquecer con datos del perfil
        full_name = None
        avatar_url = None
        try:
            profile_resp = supabase.table("profiles").select(
                "full_name, avatar_url"
            ).eq("id", str(user.id)).execute()
            if profile_resp.data:
                full_name = profile_resp.data[0].get("full_name")
                avatar_url = profile_resp.data[0].get("avatar_url")
        except Exception:
            pass  # No bloqueamos el login si el perfil falla

        return LoginResponse(
            access_token=session.access_token,
            token_type="Bearer",
            user_id=str(user.id),
            email=user.email or request.email,
            full_name=full_name,
            avatar_url=avatar_url
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de autenticación: {str(e)}",
        )
