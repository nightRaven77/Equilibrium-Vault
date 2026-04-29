# Docker — Finance Tracker

## Estructura de archivos

```
Finanzas/
├── docker/
│   ├── Dockerfile.backend       # Imagen FastAPI
│   ├── Dockerfile.frontend      # Imagen Angular (build + Nginx)
│   └── nginx/
│       ├── nginx.conf           # Reverse proxy principal
│       └── frontend.conf        # Config Nginx para SPA Angular
├── docker-compose.yml           # Orquestación base
├── docker-compose.prod.yml      # Overrides de producción (SSL)
├── .env.example                 # Plantilla de variables de entorno
└── .dockerignore                # Exclusiones del contexto de build
```

---

## Antes de empezar

### 1. Verificar el nombre del proyecto Angular

Abrir `frontend/angular.json` y confirmar el valor de `defaultProject` o el nombre
de la primera key bajo `"projects"`. Si no es `finance-tracker`, actualizar esta
línea en `docker/Dockerfile.frontend`:

```dockerfile
COPY --from=builder /frontend/dist/finance-tracker/browser /usr/share/nginx/html
```

### 2. Crear el archivo `.env`

```bash
cp .env.example .env
# Editar .env con tus valores reales de Supabase
```

### 3. Verificar el endpoint `/health` en FastAPI

El healthcheck del backend llama a `GET /health`. Asegúrate de tener este endpoint
en `app/main.py`:

```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

---

## Comandos

### Desarrollo local

```bash
# Construir y levantar todos los servicios
docker compose up --build

# Solo reconstruir un servicio específico
docker compose up --build backend

# Ver logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend

# Detener todo
docker compose down
```

### Producción

```bash
# Levantar con overrides de producción (SSL habilitado)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verificar estado de los contenedores
docker compose ps

# Renovar certificado SSL manualmente
docker compose exec certbot certbot renew
```

---

## Arquitectura de red

```
Internet :80 / :443
        ↓
    [ Nginx - reverse proxy ]
        ├── /api/*  →  backend:8000  (FastAPI + Uvicorn)
        └── /*      →  frontend:80  (Angular estático)

Supabase ☁️ (fuera de Docker — conexión directa desde FastAPI)
```

Los contenedores `backend` y `frontend` **no exponen puertos al host**.
Solo Nginx es accesible desde fuera. La comunicación interna usa la red
`finanzas_net` por nombre de servicio.

---

## Variables de entorno

| Variable                    | Descripción                            | Requerida |
| --------------------------- | -------------------------------------- | --------- |
| `SUPABASE_URL`              | URL del proyecto Supabase              | ✅        |
| `SUPABASE_ANON_KEY`         | Clave anon pública                     | ✅        |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo backend)       | ✅        |
| `CORS_ORIGINS`              | Orígenes permitidos separados por coma | ✅        |
| `APP_ENV`                   | `development` o `production`           | ✅        |
| `WEB_CONCURRENCY`           | Workers de Uvicorn (default: 2)        | ➖        |

---

## SSL en producción (Certbot)

El archivo `docker-compose.prod.yml` incluye un contenedor Certbot que
renueva el certificado automáticamente cada 12 horas.

Para el primer certificado:

```bash
# 1. Levantar solo Nginx primero (para el challenge HTTP)
docker compose up -d nginx

# 2. Obtener el certificado
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d tudominio.com \
  --email tu@email.com \
  --agree-tos \
  --no-eff-email

# 3. Levantar el resto
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---
