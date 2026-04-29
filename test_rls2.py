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
    response = supabase.auth.sign_in_with_password({"email": TEST_EMAIL, "password": TEST_PASSWORD})
    user = response.user

    print("\n--- Test 2: Upload to Storage (JPEG) ---")
    try:
        res = supabase.storage.from_("avatars").upload(
            path=f"{user.id}_test.jpg",
            file=b"fake image content",
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        print("✅ Upload en Storage exitoso!")
    except Exception as e:
        print(f"❌ Error en Storage (RLS): {str(e)}")

if __name__ == "__main__":
    test_rls()
