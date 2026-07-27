from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finance Tracker"
    VERSION: str = "0.1.0"
    
    # Supabase config
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # CORS configuration (coma-separated or list)
    CORS_ORIGINS: str = "http://localhost:4200,http://localhost:4201,http://127.0.0.1:4200"

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

