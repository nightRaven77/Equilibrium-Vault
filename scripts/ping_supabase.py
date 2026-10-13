#!/usr/bin/env python3
"""
Script de Keep-Alive para Supabase y Backend (FastAPI en Render).
Realiza una consulta a PostgREST en Supabase para registrar actividad y evitar
que el proyecto gratuito se pause por inactividad (pausa automática tras 7 días).
"""
import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

def load_dotenv():
    """Carga variables desde .env si existe en el directorio de trabajo."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(env_path):
        env_path = ".env"
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v

def ping_supabase(supabase_url: str, supabase_key: str) -> bool:
    clean_url = supabase_url.rstrip("/")
    target_url = f"{clean_url}/rest/v1/categories?select=id&limit=1"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "User-Agent": "EquilibriumVault-KeepAlive/1.0"
    }

    print(f"[{datetime.now(timezone.utc).isoformat()}] Pinging Supabase: {clean_url}...")
    req = urllib.request.Request(target_url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            status_code = res.getcode()
            body = res.read().decode("utf-8")
            print(f"✅ Supabase respondió con código HTTP {status_code}: {body}")
            return 200 <= status_code < 300
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"❌ Error HTTP de Supabase ({e.code}): {body}")
        return False
    except Exception as e:
        print(f"❌ Error de conexión con Supabase: {e}")
        return False

def ping_backend(backend_url: str) -> bool:
    clean_url = backend_url.rstrip("/")
    target_url = f"{clean_url}/health/db"
    headers = {
        "User-Agent": "EquilibriumVault-KeepAlive/1.0"
    }

    print(f"[{datetime.now(timezone.utc).isoformat()}] Pinging Backend: {target_url}...")
    req = urllib.request.Request(target_url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            status_code = res.getcode()
            body = res.read().decode("utf-8")
            print(f"✅ Backend respondió con código HTTP {status_code}: {body}")
            return 200 <= status_code < 300
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"❌ Error HTTP del Backend ({e.code}): {body}")
        return False
    except Exception as e:
        print(f"❌ Error al conectar con Backend: {e}")
        return False

def main():
    load_dotenv()
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    backend_url = os.environ.get("BACKEND_URL")

    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL o SUPABASE_KEY no están configurados.")
        sys.exit(1)

    sb_success = ping_supabase(supabase_url, supabase_key)

    be_success = True
    if backend_url:
        be_success = ping_backend(backend_url)

    if sb_success and be_success:
        print("🎉 Keep-alive completado exitosamente.")
        sys.exit(0)
    else:
        print("⚠️ Keep-alive completado con advertencias o errores.")
        sys.exit(1)

if __name__ == "__main__":
    main()
