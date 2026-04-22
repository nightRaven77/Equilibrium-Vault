# Equilibrium Vault (v1.0) 🍌✨

**Equilibrium Vault** (internamente *NanoBanana*) es una plataforma integral de gestión financiera personal y de parejas, diseñada con una estética premium *dark obsidian* e interfaces de alto rendimiento.

Este repositorio contiene la versión `v1.0` completa, que incluye un backend seguro y escalable, y una Progressive Web App (PWA) reactiva.

---

## 🚀 Características Principales

*   **Dashboard Analytics Interactivo:** Gráficas de flujo de caja y tendencias de gasto renderizadas en tiempo real con **Apache ECharts** y efectos *glassmorphism*.
*   **Gestión de Tarjetas de Crédito y MSI:** Sistema avanzado de fechas de corte y cálculo automático de Meses Sin Intereses con transacciones "hijas".
*   **Calendario Predictivo:** Línea de tiempo visual para anticipar cobros de suscripciones y cuotas de MSI pendientes.
*   **Ahorros y Finanzas Compartidas:** Gestión de deudas cruzadas entre parejas y simulador visual de metas de ahorro.
*   **Seguridad de Nivel Bancario:** Autenticación JWT y políticas nativas de Row Level Security (RLS) en la base de datos PostgreSQL.
*   **PWA Instalable:** Acceso como app nativa offline con caché estricto y seguro (solo UI, sin comprometer datos financieros).

---

## 🏗 Stack Tecnológico

### Backend (`/`)
*   **Framework:** FastAPI (Python 3.13+)
*   **Base de Datos & Auth:** Supabase (PostgreSQL + JWT + Triggers/Views)
*   **Manejo de Paquetes:** `uv`
*   **Validaciones:** Pydantic v2

### Frontend (`/frontend`)
*   **Framework:** Angular 17+ (Standalone Components, Signals, Control Flow)
*   **Estilos:** TailwindCSS v4
*   **Visualización de Datos:** Apache ECharts (`ngx-echarts`)
*   **PWA:** `@angular/service-worker`

---

## 📦 Estructura del Proyecto

```text
├── app/                   # 🐍 BACKEND (FastAPI)
│   ├── api/routers/       # Endpoints (Personal, Cards, Recurring, Couples, Savings)
│   ├── core/              # Autenticación y configuración global
│   ├── db/                # Cliente de Supabase
│   └── schemas/           # Modelos Pydantic de entrada/salida
├── frontend/              # 🅰️ FRONTEND (Angular)
│   ├── public/icons/      # Assets de la PWA (NanoBanana icon)
│   ├── src/app/core/      # Servicios (HTTP), Interceptors (JWT), Modelos
│   └── src/app/features/  # Componentes UI (Dashboard, Calendar, Layout, Auth)
├── main.py                # Entrypoint de FastAPI
└── PROJECT_CONTEXT.md     # Bitácora detallada de arquitectura y base de datos
```

---

## 🛠 Instalación y Configuración Local

### 1. Configurar el Backend (FastAPI)

1. Ve a la raíz del proyecto e instala las dependencias de Python ultra-rápido usando `uv`:
   ```bash
   uv sync
   ```
2. Crea el archivo de variables de entorno:
   ```bash
   cp .env.example .env
   ```
   *(Asegúrate de llenar `SUPABASE_URL` y `SUPABASE_KEY` con tus credenciales).*
3. Arranca el servidor:
   ```bash
   uv run uvicorn main:app --reload
   ```
   👉 *Swagger UI (Documentación API): `http://127.0.0.1:8000/docs`*

### 2. Configurar el Frontend (Angular)

1. Abre una nueva terminal y navega a la carpeta del frontend:
   ```bash
   cd frontend
   ```
2. Instala los paquetes de Node:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run start
   ```
   👉 *Aplicación Web: `http://localhost:4200`*

*(Nota: Para probar la instalación PWA en el navegador, debes compilar el proyecto usando `npm run build` y servir la carpeta `dist/frontend/browser` con un servidor estático como `http-server`).*

---

## 📌 Estado del Proyecto
**Versión 1.0 (Completada):** Todos los módulos core detallados en `PROJECT_CONTEXT.md` (Personal, Tarjetas, Recurrentes, Parejas, Ahorros, Calendario, Analytics y PWA) han sido finalizados y probados con éxito.
