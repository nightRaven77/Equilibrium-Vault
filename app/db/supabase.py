from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client(use_service_role: bool = False) -> Client:
    """
    Retorna una instancia del cliente de Supabase.
    Por defecto utiliza anon_key para respetar Row Level Security (RLS).
    Si use_service_role=True, utiliza la service_role_key para tareas administrativas.
    """
    key = settings.service_role_key if use_service_role else settings.anon_key
    return create_client(settings.SUPABASE_URL, key)
