from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.core.config import settings

security = HTTPBearer()

def get_current_user_supplier(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Client:
    """
    Middleware que intercepta el JWT de la petición, 
    e inicializa un cliente de Supabase asumiendo la identidad de ese usuario
    para que se apliquen las políticas RLS.
    """
    token = credentials.credentials
    
    # Creamos un cliente fresco para esta request
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    # Configuramos el token localmente en el cliente para aplicar RLS
    try:
        supabase.auth.set_session(access_token=token, refresh_token="")
        # Obtenemos al usuario para verificar que el token es válido
        user = supabase.auth.get_user()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token no válido o expirado",
            )
        return supabase
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Autenticación fallida: {str(e)}",
        )
