from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """
    Retorna una instancia del cliente de Supabase usando la service key o anon key.
    Esta instancia base puede ser usada para operaciones de administrador o acceso público.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
