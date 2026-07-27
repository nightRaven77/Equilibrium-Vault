# 🚀 Guía de Despliegue en Render (Arquitectura Híbrida)

Esta guía detalla el paso a paso para desplegar **Equilibrium Vault** utilizando la arquitectura híbrida recomendada:

- **Backend (FastAPI):** Desplegado como un _Web Service_ (Docker) en Render.
- **Frontend (Angular PWA):** Desplegado como un _Static Site_ en Render (100% gratuito y sin apagados automáticos).
- **Base de datos:** Hospedada de forma independiente en Supabase.
- **Dominio Personalizado:** `https://tu-dominio.com/` apuntando al Frontend.

---

## 📋 Requisitos Previos

1.  Tener el repositorio del proyecto en GitHub (por ejemplo, `nightRaven77/Equilibrium-Vault`).
2.  Tener una cuenta activa en [Render](https://render.com/).
3.  Tener acceso a tu proveedor de dominio (DNS) para gestionar `tu-dominio.com`.
4.  Tener las credenciales del proyecto en **Supabase** (`SUPABASE_URL` y la clave de servicio/anon).

---

## 🛠️ Paso 1: Despliegue del Backend (FastAPI)

El backend corre sobre FastAPI y se compila utilizando el Dockerfile optimizado con `uv`.

1.  En tu dashboard de Render, haz clic en **New** -> **Web Service**.
2.  Conecta tu repositorio de GitHub.
3.  Configura los siguientes campos:
    - **Name:** `equilibrium-vault-backend`
    - **Runtime:** `Docker`
    - **Dockerfile Path:** `docker/Dockerfile.backend`
    - **Docker Build Context:** `.` (punto, que representa la raíz del repositorio)
    - **Instance Type:** `Free`
4.  Despliega la sección **Advanced** y añade las siguientes **Environment Variables**:

    | Variable          | Valor                             | Nota                                                                                |
    | :---------------- | :-------------------------------- | :---------------------------------------------------------------------------------- |
    | `SUPABASE_URL`    | `https://tu-proyecto.supabase.co` | URL del dashboard de Supabase                                                       |
    | `SUPABASE_KEY`    | `tu-anon-o-service-role-key`      | Token de acceso para Supabase                                                       |
    | `CORS_ORIGINS`    | `https://tu-dominio.com/`         | El dominio personalizado de tu frontend                                             |
    | `WEB_CONCURRENCY` | `1`                               | **Crítico:** Limita los workers a 1 para no exceder los 512 MB de la capa gratuita. |

5.  Haz clic en **Create Web Service**.
6.  _Una vez completado el despliegue, copia la URL que te asigna Render (ej: `https://equilibrium-vault-backend.onrender.com`)._

---

## 🅰️ Paso 2: Despliegue del Frontend (Angular 19 PWA)

El frontend se despliega como un sitio estático gratuito. El build inyecta automáticamente la URL del backend sin exponer claves sensibles.

1.  En tu dashboard de Render, haz clic en **New** -> **Static Site**.
2.  Conecta el mismo repositorio de GitHub.
3.  Configura los siguientes campos:
    - **Name:** `equilibrium-vault-frontend`
    - **Root Directory:** `frontend` _(Render ejecutará los comandos dentro de la subcarpeta del frontend)_
    - **Build Command:** `npm run build`
    - **Publish Directory:** `dist/frontend/browser`
4.  En la sección **Advanced**, añade las siguientes **Environment Variables**:

    | Variable       | Valor                                                   | Nota                                              |
    | :------------- | :------------------------------------------------------ | :------------------------------------------------ |
    | `API_URL`      | `https://equilibrium-vault-backend.onrender.com/api/v1` | URL de tu backend creado en el Paso 1 + `/api/v1` |
    | `NODE_VERSION` | `20`                                                    | Asegura que compile usando Node 20 o posterior.   |

5.  Haz clic en **Create Static Site**.
6.  _Copia la URL por defecto que Render le asigna a tu frontend (ej: `equilibrium-vault-frontend.onrender.com`)._

> [!NOTE]
> Gracias al archivo `frontend/.npmrc`, Render ejecutará automáticamente `npm install --legacy-peer-deps` antes de compilar, evitando cualquier conflicto de dependencias secundarias en Angular.

---

## 🌐 Paso 3: Configuración del Dominio Personalizado

Para asociar tu dominio **`https://tu-dominio.com/`**:

### 1. Configuración de DNS (En tu proveedor de dominio)

Inicia sesión en tu proveedor de dominio (Cloudflare, Namecheap, GoDaddy, etc.) y añade el siguiente registro en la zona DNS:

- **Tipo:** `CNAME`
- **Nombre/Host:** `finanzas`
- **Valor/Destino:** `equilibrium-vault-frontend.onrender.com` _(La URL original asignada por Render al frontend)_
- **TTL:** `Auto` o `3600`

> [!WARNING]
> Si utilizas **Cloudflare**, es obligatorio desactivar el proxy (establecer el estado en **DNS Only** / Nube gris) durante la verificación inicial para que Render pueda validar el certificado de seguridad SSL.

### 2. Configuración en Render

1.  Entra al servicio de **Static Site** de tu frontend en Render.
2.  Ve a **Settings** -> **Custom Domains**.
3.  Haz clic en **Add Custom Domain**.
4.  Ingresa `https://tu-dominio.com/` y guarda los cambios.
5.  Render comprobará la validez del registro y activará la conexión HTTPS automática en unos minutos.

---

## 🔒 Paso 4: Seguridad y Redirección en Supabase Auth

1.  Ve al panel de **Supabase** de tu proyecto.
2.  Navega a **Authentication** -> **URL Configuration**.
3.  Ajusta las configuraciones de URL para que coincidan con tu dominio personalizado:
    - **Site URL:** `https://tu-dominio.com/`
    - **Redirect URLs:** `https://tu-dominio.com//**`
4.  Guarda los cambios.

---

## ⏱️ Nota sobre la Capa Gratuita (Cold Start)

Dado que el Backend está alojado en la capa gratuita de Render:

- Si la API no recibe peticiones durante 15 minutos, la instancia entrará en estado de suspensión (apagado automático).
- La siguiente petición entrante despertará la instancia automáticamente, lo cual puede tardar entre **40 y 50 segundos** (conocido como _cold start_). Las peticiones subsecuentes responderán de inmediato.
- El Frontend estático **nunca se apaga** y siempre carga al instante, pero mostrará un estado de carga mientras el backend se despierta.
