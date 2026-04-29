import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TEST_EMAIL = os.getenv("TEST_EMAIL")
TEST_PASSWORD = os.getenv("TEST_PASSWORD")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_rls():
    print("Iniciando test de RLS...")
    # Login
    response = supabase.auth.sign_in_with_password({"email": TEST_EMAIL, "password": TEST_PASSWORD})
    user = response.user
    if not user:
        print("Error: No se pudo hacer login.")
        return
    print(f"✅ Login exitoso. Usuario: {user.id}")

    # Test 1: Update Profiles
    print("\n--- Test 1: Update Profiles ---")
    try:
        res = supabase.table("profiles").update({"full_name": "Test Name"}).eq("id", user.id).execute()
        print("✅ Update en Profiles exitoso!")
    except Exception as e:
        print(f"❌ Error en Profiles (RLS): {str(e)}")

    # Test 2: Upload to Storage
    print("\n--- Test 2: Upload to Storage ---")
    try:
        res = supabase.storage.from_("avatars").upload(
            path=f"{user.id}_test.txt",
            file=b"test file",
            file_options={"content-type": "text/plain", "upsert": "true"}
        )
        print("✅ Upload en Storage exitoso!")
    except Exception as e:
        print(f"❌ Error en Storage (RLS): {str(e)}")

if __name__ == "__main__":
    test_rls()
