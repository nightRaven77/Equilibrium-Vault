# Finance Tracker Backend 🚀

Backend de alto rendimiento construido con **FastAPI** y **Supabase** para administrar finanzas personales y en pareja. Este servicio expone una API RESTFul rápida, tipada y con reglas de seguridad estrictas (Row Level Security) nativas de Postgres.

## 🏗 Stack Tecnológico
- **Framework:** FastAPI (Python 3.13+)
- **Base de Datos & Auth:** Supabase (PostgreSQL + JWT)
- **Manejo de Paquetes:** `uv`
- **Validaciones:** Pydantic v2
- **Llamadas Base de datos:** `supabase-py` (Cliente REST Oficial)

## 📦 Estructura del Proyecto

```text
├── app/
│   ├── api/
│   │   ├── dependencies/  # Middlewares (ej. Inyección del token JWT en Supabase)
│   │   └── routers/       # Módulos de negocio (CRUDs)
│   ├── core/              # Configuración base y variables de entorno
│   ├── db/                # Inicialización de Supabase
│   └── schemas/           # Pydantic models & Enums
├── main.py                # Entrypoint y configuración CORS
├── PROJECT_CONTEXT.md     # Documentación original y mapeo de Base de Datos
└── README.md
```

## 🛠 Instalación y Configuración Local

1. **Instalar dependencias:**
   Usamos `uv` para la máxima velocidad. En la raíz del proyecto ejecuta:
   ```bash
   uv sync
   ```

2. **Variables de Entorno:**
   Copia el archivo de prueba y configúralo con las llaves de tu panel de Supabase:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` e inserta tu `SUPABASE_URL` y tu Public `SUPABASE_KEY` (Anon Key).

3. **Arrancar el Servidor:**
   ```bash
   uv run uvicorn main:app --reload
   ```

## 🔑 Pruebas / Swagger UI

El proyecto incluye auto-documentación usando Swagger.
Una vez que el servidor esté corriendo, navega a:
👉 `http://127.0.0.1:8000/docs`

**Para interactuar con la Base de datos protegida por RLS:**
1. Ve al endpoint `POST /api/v1/auth/login`.
2. Introduce tu email y contraseña de tu usuario en Supabase (`Try it out` -> `Execute`).
3. Copia el string devuelto con la etiqueta `"access_token"`.
4. Sube a la cima de la página del navegador, haz clic en el botón verde **"Authorize"** y pega tu token.

Todo el resto de llamadas a módulos (`/personal`, `/cards`, `/recurring`, etc.) inyectarán este token y aislarán los datos correctamente.

## 📌 Progreso de Módulos (Features)

- [x] Autenticación e Inyección dinámica a Base de Datos (Seguridad RLS).
- [x] Módulo Personal (Transacciones Individuales, Lectura de Vistas).
- [x] Módulo de Tarjetas y Gestión Histórica de Cortes (Soft-Deletes).
- [x] Pagos Recurrentes (Suscripciones, Ocurrencias, Acción automatizada de Pagos).
- [ ] Vínculos / Parejas (Gastos en fracciones compartidas).
- [ ] Metas de Ahorros y simulación virtual de intereses.
