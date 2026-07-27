# 💳 Equilibrium Vault — Finance Tracker PWA

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Angular](https://img.shields.io/badge/Frontend-Angular%2019-DD0031.svg?style=flat&logo=angular)](https://angular.dev/)
[![PWA](https://img.shields.io/badge/PWA-Offline--Ready-00f2fe.svg?style=flat)](https://developer.mozilla.org/es/docs/Web/Progressive_web_apps)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg?style=flat&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Equilibrium Vault** es una plataforma integral de gestión financiera personal y de parejas, diseñada con una estética premium *Dark Obsidian* (glassmorphism), respuesta ultra-rápida y arquitectura Progressive Web App (PWA).

Permite un control exhaustivo de ingresos, gastos, tarjetas de crédito con corte y MSI, suscripciones recurrentes, metas de ahorro y saldos compartidos en pareja.

---

## ✨ Características Principales

- **📊 Dashboard Analytics Interactivo:** Gráficas de flujo de caja y tendencias de gasto en tiempo real renderizadas con **Apache ECharts**.
- **💳 Tarjetas de Crédito & MSI:** Gestión automática de fechas de corte, días de pago y compras a Meses Sin Intereses con desglose de cuotas mensuales.
- **📅 Calendario Predictivo:** Línea de tiempo visual para anticipar cobros de suscripciones y cuotas de MSI pendientes.
- **👩‍❤️‍👨 Finanzas Compartidas (Pareja):** División porcentual de gastos comunes con cálculo de saldos y liquidación simplificada.
- **🔒 Seguridad & Row Level Security (RLS):** Autenticación JWT administrada por **Supabase Auth** y aislamiento estricto de datos en PostgreSQL mediante políticas RLS.
- **📱 PWA Instalable:** Instalación nativa en iOS, Android y Desktop con almacenamiento en caché seguro.

---

## 📁 Estructura del Proyecto

```text
Finanzas/
├── app/                   # 🐍 BACKEND (FastAPI)
│   ├── api/routers/       # Endpoints (Personal, Tarjetas, Recurrentes, Parejas, Ahorros, Categorías, Perfil)
│   ├── core/              # Configuración global y gestión de CORS dinámico
│   ├── db/                # Cliente y conexión asíncrona a Supabase
│   └── schemas/           # Modelos Pydantic v2 de validación
├── docker/                # 🐳 Dockerfiles y configuraciones Nginx
├── frontend/              # 🅰️ FRONTEND (Angular 19 PWA)
│   ├── scripts/
│   │   └── set-env.js     # Script automátizador que inyecta .env en environment.prod.ts
│   ├── src/app/core/      # Servicios HTTP, Interceptores JWT y Modelos
│   ├── src/app/features/  # Módulos UI (Dashboard, Calendar, Cards, Couples, Savings, Auth)
│   ├── .env.example       # Plantilla de variables para el frontend
│   └── package.json       # Scripts de build con compilación de entorno .env
├── main.py                # Entrypoint de FastAPI + Middleware CORS
├── docker-compose.yml     # Orquestación local en Docker
├── docker-compose.prod.yml# Orquestación de producción con SSL/Certbot
├── .env.example           # Plantilla de variables para el backend
└── README.md
```

---

## ☁️ Conexión a Base de Datos PostgreSQL / Supabase

El backend se conecta directamente a **Supabase PostgreSQL**. 

1. Registra tu proyecto en [supabase.com](https://supabase.com).
2. En tu archivo `.env` (en la raíz), configura las credenciales obtenidas del dashboard de Supabase:
   ```env
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_KEY=tu-anon-key-o-service-role-key
   ```
3. Las políticas de seguridad **Row Level Security (RLS)** y las tablas públicas deben crearse ejecutando los scripts SQL incluidos en el proyecto.

---

## 🚀 Guía de Despliegue en Producción (Arquitectura Híbrida)

La arquitectura recomendada separa el **Frontend PWA** (en Vercel / Cloudflare Pages) del **Backend FastAPI** (en Railway / Render), comunicándolos mediante subdominios HTTPS.

> [!TIP]
> Si vas a realizar el despliegue de ambos servicios en **Render** (Frontend como *Static Site* y Backend como *Web Service*), consulta la guía detallada [DEPLOY_GUIDE.md](file:///c:/Users/erick/Documents/projectosPropios/Equilibrium-Vault/DEPLOY_GUIDE.md) para ver los pasos de configuración y optimizaciones para la capa gratuita.


```text
[ Cliente / PWA ] ---> https://finanzas.tudominio.com (Vercel CDN)
         │
         └-----------> https://backend-finanzas.tudominio.com (Railway / Render)
                                  │
                                  └---> Supabase (PostgreSQL + Auth)
```

### 1. Configuración del Backend (Railway / Render)

En el panel de tu hosting de backend, agrega las siguientes Variables de Entorno:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-key
CORS_ORIGINS=https://finanzas.tudominio.com,https://tu-app.vercel.app
```
*(Nota: `CORS_ORIGINS` permite especificar múltiples dominios separados por coma que podrán consumir la API).*

### 2. Configuración del Frontend con `.env` (Vercel)

El frontend incluye un script automático (`frontend/scripts/set-env.js`) que lee variables `.env` o del sistema durante el build y genera la configuración de Angular sin exponer tokens.

1. En la carpeta `frontend/`, puedes crear un archivo `.env`:
   ```env
   API_URL=https://backend-finanzas.tudominio.com/api/v1
   ```
2. Si despliegas en **Vercel** o **Cloudflare Pages**, simplemente agrega la variable `API_URL` en el panel de **Environment Variables** del proyecto.
3. El comando `npm run build` ejecutará automáticamente `node scripts/set-env.js && ng build`, inyectando la URL del backend antes de compilar.

### 3. Configuración de Subdominios DNS

En tu proveedor de DNS, añade los registros CNAME correspondientes (evitando el subdominio `api` si ya está en uso por otro servicio):

| Registro | Nombre / Host | Apunta a / Valor | Servicio |
| :--- | :--- | :--- | :--- |
| **CNAME** | `finanzas` | `cname.vercel-dns.com` | Frontend PWA (Vercel) |
| **CNAME** | `backend-finanzas` | `tu-app.up.railway.app` | Backend FastAPI (Railway) |

### 4. Configuración en Supabase Auth

En el dashboard de Supabase (**Authentication -> URL Configuration**):
* **Site URL:** `https://finanzas.tudominio.com`
* **Redirect URLs:** Agregar `https://finanzas.tudominio.com/**`

---

## 🛠 Cómo Ejecutar en Desarrollo Local

### 1. Backend (FastAPI)

1. Instala las dependencias mediante `uv`:
   ```bash
   uv sync
   ```
2. Crea el archivo `.env` en la raíz copiando `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   uv run uvicorn main:app --reload
   ```
   👉 *Swagger UI (Documentación de API): `http://127.0.0.1:8000/docs`*

### 2. Frontend (Angular PWA)

1. Entra a la carpeta `frontend` e instala las dependencias de Node:
   ```bash
   cd frontend
   npm install
   ```
2. (Opcional) Crea un `.env` en `frontend/.env` con `API_URL=http://localhost:8000/api/v1`.
3. Inicia el servidor de desarrollo:
   ```bash
   npm run start
   ```
   👉 *Aplicación Web: `http://localhost:4200`*

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
