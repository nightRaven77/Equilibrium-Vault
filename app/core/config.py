from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finance Tracker"
    VERSION: str = "0.1.0"
    
    # Supabase config
    SUPABASE_URL: str
    SUPABASE_KEY: str = ""
    SUPABASE_ANON_KEY: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None

    # AI / Gemini Vision OCR config
    GEMINI_API_KEY: str | None = None

    @property
    def anon_key(self) -> str:
        key = self.SUPABASE_ANON_KEY or self.SUPABASE_KEY
        if not key:
            raise ValueError("SUPABASE_ANON_KEY o SUPABASE_KEY debe estar configurado")
        return key

    @property
    def service_role_key(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_KEY or self.anon_key

    # CORS configuration (coma-separated or list)
    CORS_ORIGINS: str = "http://localhost:4200,http://localhost:4201,http://127.0.0.1:4200"

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

