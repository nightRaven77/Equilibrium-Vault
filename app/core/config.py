from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finance Tracker"
    VERSION: str = "0.1.0"
    
    # Supabase config
    SUPABASE_URL: str
    SUPABASE_KEY: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
