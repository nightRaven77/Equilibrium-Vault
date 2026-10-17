from datetime import datetime, timezone
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.supabase import get_supabase_client
from app.api.routers import personal, cards, recurring, couples, savings, auth, categories, profile, budgets

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(personal.router, prefix="/api/v1")
app.include_router(cards.router, prefix="/api/v1")
app.include_router(recurring.router, prefix="/api/v1")
app.include_router(couples.router, prefix="/api/v1")
app.include_router(savings.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(budgets.router, prefix="/api/v1")

@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "version": settings.VERSION}

@app.get("/health/db", tags=["system"])
@app.get("/api/v1/health/db", tags=["system"])
def health_check_db():
    """
    Verifica la conectividad con Supabase ejecutando una consulta ligera.
    Sirve también como endpoint de ping / keep-alive para evitar que Supabase se pause por inactividad.
    """
    try:
        supabase = get_supabase_client()
        # Consulta ligera que genera actividad en la base de datos de Supabase
        supabase.table("categories").select("id").limit(1).execute()
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": settings.VERSION,
        }
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "detail": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

