import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def setup_avatars_bucket():
    print("Iniciando configuración del bucket 'avatars'...")
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
    }
    
    # Intentar obtener el bucket
    resp = requests.get(f"{url}/avatars", headers=headers)
    if resp.status_code == 200:
        print("✅ El bucket 'avatars' ya existe.")
        return
        
    print("El bucket no existe, procediendo a crearlo...")
    payload = {
        "id": "avatars",
        "name": "avatars",
        "public": True
    }
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code in [200, 201]:
        print("✅ Bucket 'avatars' creado exitosamente como público.")
    else:
        print(f"❌ Error al crear el bucket: {resp.status_code} - {resp.text}")
        print("Por favor, asegúrate de tener la Service Role Key o créalo manualmente en el dashboard.")

if __name__ == "__main__":
    setup_avatars_bucket()
