from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routers import personal, cards, recurring,couples, savings, auth, categories

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://localhost:4201",
        "http://127.0.0.1:4200",
    ],
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

@app.get("/api/health", tags=["system"])
def health_check():
    return {"status": "ok", "version": settings.VERSION}
