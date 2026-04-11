import os
import sys
import uuid
import httpx
from datetime import date
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

BASE_URL = "http://127.0.0.1:8000/api/v1"
EMAIL = os.getenv("TEST_EMAIL")
PASSWORD = os.getenv("TEST_PASSWORD")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def main():
    print(f"Iniciando Test Integrado en {BASE_URL}")
    if not all([EMAIL, PASSWORD, SUPABASE_URL, SUPABASE_KEY]):
        print("❌ Error: Faltan llaves en .env (TEST_EMAIL, TEST_PASSWORD, SUPABASE_URL, SUPABASE_KEY).")
        sys.exit(1)

    print(f"👤 Autenticando con: {EMAIL}...")
    headers = {"Content-Type": "application/json"}
    resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=headers)
    
    if resp.status_code != 200:
        print(f"❌ Login falló ({resp.status_code}): {resp.text}")
        sys.exit(1)
        
    auth_data = resp.json()
    token = auth_data["access_token"]
    user_id = auth_data["user_id"]
    headers["Authorization"] = f"Bearer {token}"
    print(f"✅ JWT generado. Acceso concedido al ID: {user_id}")

    # ========================================================
    # = MODULE SAVINGS
    # ========================================================
    print("\n--- MODULE: SAVINGS (Ahorros) ---")

    # 1. Crear meta de ahorro
    saving_goal_payload = {
        "name": "Fondo de Emergencia Test",
        "description": "Meta generada por script autotest",
        "target_amount": "50000.00",
        "currency": "MXN",
        "annual_rate_pct": "10.00",
        "compounding_frequency": "monthly"
    }

    print("🔄 POST /savings/")
    sg_res = httpx.post(f"{BASE_URL}/savings/", json=saving_goal_payload, headers=headers)
    if sg_res.status_code not in (200, 201):
        print(f"❌ Fallo creación de ahorro: {sg_res.text}")
    else:
        goal_id = sg_res.json()["id"]
        print(f"✅ Meta de ahorro guardada. ID: {goal_id}")

        # 2. Agregar transacción (Depósito)
        sg_tx_payload = {
            "amount": "1500.00",
            "type": "deposit",
            "notes": "Depósito base de prueba",
            "transaction_date": date.today().isoformat()
        }
        print(f"🔄 POST /savings/{goal_id}/transactions")
        tx_res = httpx.post(f"{BASE_URL}/savings/{goal_id}/transactions", json=sg_tx_payload, headers=headers)
        if tx_res.status_code not in (200, 201):
            print(f"❌ Error en depósito: {tx_res.text}")
        else:
             print(f"✅ Depósito exitoso por $1,500.00")

        # 3. Leer Vista de Balance General
        print("🔄 GET /savings/ (VISTA GENERAL)")
        v_res = httpx.get(f"{BASE_URL}/savings/", headers=headers)
        if v_res.status_code == 200:
            print("✅ Vista recuperada:")
            for item in v_res.json():
                 print(f"   - {item.get('name')}: Balance {item.get('current_balance')} | Progreso {item.get('progress_pct')}%")
        else:
             print(f"❌ Error en GET savings: {v_res.text}")


    # ========================================================
    # = MODULE COUPLES
    # ========================================================
    print("\n--- MODULE: COUPLES (Parejas) ---")
    print("🔄 Consultando vínculos existentes...")
    c_res = httpx.get(f"{BASE_URL}/couples/", headers=headers)
    
    if c_res.status_code == 200:
        couples = c_res.json()
        if not couples:
             print("⚠️ No tienes ningún vínculo de pareja registrado en esta cuenta. Para probar 'couples', deberías tener al menos una vinculación que requiera Foreign Keys a un user2_id real.")
        else:
             print(f"✅ Se encontraron {len(couples)} parejas. Tomaremos la primera para prueba.")
             couple_id = couples[0]["id"]
             
             # Verificar el balance humanizado
             print(f"🔄 GET /couples/{couple_id}/balance")
             b_res = httpx.get(f"{BASE_URL}/couples/{couple_id}/balance", headers=headers)
             if b_res.status_code == 200:
                  b_data = b_res.json()
                  if b_data.get("is_settled"):
                       print("✅ Balance: Actualmente a mano (Settled - $0.00) 👍")
                  else:
                       print(f"✅ Balance: {b_data.get('debtor_name')} debe ${b_data.get('amount')} a {b_data.get('creditor_name')}")
             else:
                  print(f"❌ Error al consultar balance: {b_res.text}")
    else:
        print(f"❌ Falla en /couples/: {c_res.text}")

    print("\n✅ Script finalizado.")

if __name__ == "__main__":
    main()
