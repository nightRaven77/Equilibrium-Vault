import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_buckets():
    try:
        buckets = supabase.storage.list_buckets()
        print("Buckets encontrados:")
        for b in buckets:
            print(f"- {b.name} (public: {b.public})")
    except Exception as e:
        print(f"Error listando buckets: {str(e)}")

if __name__ == "__main__":
    check_buckets()
