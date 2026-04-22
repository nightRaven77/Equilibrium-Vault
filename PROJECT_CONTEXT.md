# Finance Tracker — Contexto del Proyecto

## Descripción
Aplicación de control de finanzas personales y en pareja. Backend en FastAPI + PostgreSQL vía Supabase. Frontend en Angular como PWA responsiva.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend Web | Angular 19+ (Standalone Components) |
| Estilos | Tailwind CSS v4 + Angular Material |
| PWA | @angular/pwa (ng add) |
| HTTP Client | Angular HttpClient + Interceptors JWT |
| Estado | Angular Signals + Services |
| Backend API | FastAPI (Python) |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| ORM / Query | asyncpg o supabase-py |
| Validación | Pydantic v2 |
| Migraciones | SQL manual en Supabase SQL Editor |

---

## Módulos de la Aplicación

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | Personal | Transacciones individuales (ingresos y gastos) |
| 2 | Pareja | Gastos compartidos con división porcentual |
| 3 | Tarjetas | Control de crédito, cortes y pagos |
| 4 | Recurrentes | Suscripciones y pagos agendados |
| 5 | Ahorros | Metas con rendimientos capitalizados |

---

## Base de Datos — Tablas

### `public.profiles`
Extensión de `auth.users` de Supabase.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | FK → auth.users |
| full_name | VARCHAR(120) | |
| avatar_url | TEXT | nullable |
| currency | CHAR(3) | Default: MXN |
| locale | VARCHAR(10) | Default: es-MX |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | auto via trigger |

---

### `public.categories`
Categorías personalizadas por usuario.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | → profiles |
| name | VARCHAR(60) | UNIQUE por usuario |
| icon | VARCHAR(10) | emoji |
| color | CHAR(7) | hex |
| type | transaction_type | income / expense / transfer |
| is_default | BOOLEAN | si TRUE, no se puede eliminar |
| created_at | TIMESTAMPTZ | |

**Seed:** 14 categorías por defecto se crean automáticamente al registrar un usuario (trigger `handle_new_user` → `seed_default_categories()`).

---

### `public.credit_cards`
Tarjetas de crédito del usuario.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | → profiles |
| bank_name | VARCHAR(80) | |
| alias | VARCHAR(60) | nullable, apodo del usuario |
| last_four | CHAR(4) | |
| credit_limit | NUMERIC(12,2) | > 0 |
| cutoff_day | SMALLINT | 1–31 |
| payment_due_days | SMALLINT | días post-corte para pagar, default 20 |
| min_payment_pct | NUMERIC(5,2) | default 1.50 |
| annual_rate_pct | NUMERIC(5,2) | CAT, default 0 |
| is_active | BOOLEAN | default TRUE |

**Función auxiliar:** `next_cutoff_date(cutoff_day, from_date)` — calcula la próxima fecha de corte ajustando días inexistentes (ej. día 31 en abril).

---

### `public.card_statements`
Un registro por cada período de facturación.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| credit_card_id | UUID FK | → credit_cards |
| cutoff_date | DATE | UNIQUE por tarjeta |
| payment_due_date | DATE | debe ser > cutoff_date |
| total_balance | NUMERIC(12,2) | |
| minimum_payment | NUMERIC(12,2) | |
| status | statement_status | open / closed / paid / overdue |

---

### `public.personal_transactions`
Transacciones individuales del usuario.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | → profiles |
| category_id | UUID FK | → categories |
| credit_card_id | UUID FK | nullable → credit_cards |
| card_statement_id | UUID FK | nullable → card_statements |
| amount | NUMERIC(12,2) | > 0 |
| type | transaction_type | income / expense / transfer |
| payment_method | payment_method | ver ENUMs |
| description | VARCHAR(200) | |
| notes | TEXT | nullable |
| transaction_date | DATE | default hoy |

**Regla:** Si `payment_method = 'credit_card'` entonces `credit_card_id` es obligatorio (CHECK constraint).

---

### `public.couples`
Vínculo entre dos usuarios.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| user1_id | UUID FK | → profiles |
| user2_id | UUID FK | → profiles |
| name | VARCHAR(80) | nullable |
| status | couple_status | active / inactive |

**Unicidad:** Índice funcional `LEAST/GREATEST` evita duplicados `(A,B)` y `(B,A)`.

---

### `public.couple_transactions`
Gastos registrados en conjunto.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| couple_id | UUID FK | → couples |
| paid_by_user_id | UUID FK | → profiles (debe ser miembro del vínculo) |
| category_id | UUID FK | → categories |
| credit_card_id | UUID FK | nullable → credit_cards |
| amount | NUMERIC(12,2) | > 0 |
| payment_method | payment_method | |
| description | VARCHAR(200) | |
| user1_share_pct | NUMERIC(5,2) | default 50.00 |
| user2_share_pct | NUMERIC(5,2) | default 50.00 (suma = 100) |
| status | settlement_status | pending / settled |
| transaction_date | DATE | |
| settled_at | TIMESTAMPTZ | nullable, auto via trigger |

**Validación:** `paid_by_user_id` debe ser `user1_id` o `user2_id` del vínculo — validado por trigger `check_paid_by_is_member`.

---

### `public.recurring_payments`
Plantilla de cobros recurrentes (suscripciones, servicios).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | → profiles |
| category_id | UUID FK | → categories |
| credit_card_id | UUID FK | nullable → credit_cards |
| name | VARCHAR(100) | "Netflix", "Spotify" |
| description | VARCHAR(200) | nullable |
| amount | NUMERIC(12,2) | > 0 |
| currency | CHAR(3) | default MXN |
| payment_method | payment_method | |
| frequency | recurrence_frequency | ver ENUMs |
| start_date | DATE | |
| end_date | DATE | nullable |
| day_of_period | SMALLINT | 1–31 |
| reminder_days_before | SMALLINT | default 3 |
| is_active | BOOLEAN | default TRUE |

**Función clave:** `generate_occurrences(recurring_id, months_ahead=3)` — genera las ocurrencias futuras. Debe llamarse desde FastAPI al crear o activar una plantilla.

---

### `public.recurring_payment_occurrences`
Cada instancia individual de un pago recurrente.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| recurring_payment_id | UUID FK | → recurring_payments |
| scheduled_date | DATE | UNIQUE por plantilla |
| status | occurrence_status | pending / paid / failed / skipped |
| amount_override | NUMERIC(12,2) | nullable, si el monto cambió ese período |
| actual_transaction_id | UUID FK | nullable → personal_transactions |
| notes | VARCHAR(300) | nullable |

**Flujo:** `recurring_payments` → genera → `recurring_payment_occurrences` → al pagarse → crea → `personal_transaction`

---

### `public.saving_goals`
Metas de ahorro con configuración de rendimientos.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | → profiles |
| name | VARCHAR(100) | |
| description | VARCHAR(300) | nullable |
| target_amount | NUMERIC(12,2) | > 0 |
| currency | CHAR(3) | default MXN |
| annual_rate_pct | NUMERIC(5,2) | default 0 |
| compounding_frequency | recurrence_frequency | frecuencia de capitalización |
| target_date | DATE | nullable |
| icon | VARCHAR(10) | emoji |
| color | CHAR(7) | hex |
| status | saving_goal_status | active / paused / completed / cancelled |

**Importante:** El saldo actual NO se guarda como campo. Se calcula siempre con `SUM()` desde `saving_transactions`.

---

### `public.saving_transactions`
Movimientos de una meta de ahorro.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| saving_goal_id | UUID FK | → saving_goals |
| amount | NUMERIC(12,2) | positivo (deposit/interest) o negativo (withdrawal) |
| type | saving_transaction_type | deposit / withdrawal / interest |
| notes | VARCHAR(300) | nullable |
| transaction_date | DATE | default hoy |

---

## ENUMs definidos

| ENUM | Valores |
|------|---------|
| `transaction_type` | income, expense, transfer |
| `payment_method` | credit_card, debit_card, cash, transfer, digital_wallet |
| `couple_status` | active, inactive |
| `settlement_status` | pending, settled |
| `statement_status` | open, closed, paid, overdue |
| `recurrence_frequency` | daily, weekly, biweekly, monthly, quarterly, yearly |
| `occurrence_status` | pending, paid, failed, skipped |
| `saving_goal_status` | active, paused, completed, cancelled |
| `saving_transaction_type` | deposit, withdrawal, interest |

---

## Funciones SQL en DB

| Función | Cuándo se llama |
|---------|----------------|
| `set_updated_at()` | Trigger automático en todas las tablas |
| `handle_new_user()` | Trigger en `auth.users` al registrarse |
| `seed_default_categories(user_id)` | Llamada por `handle_new_user` |
| `next_cutoff_date(day, from_date)` | Desde FastAPI al crear/calcular statements |
| `generate_occurrences(id, months)` | Desde FastAPI al crear/activar recurring_payment |
| `apply_periodic_interest(goal_id)` | Cron job de Supabase (pg_cron) o endpoint admin |
| `check_paid_by_is_member()` | Trigger BEFORE INSERT/UPDATE en couple_transactions |
| `set_settled_at()` | Trigger BEFORE UPDATE en couple_transactions |

---

## Vistas SQL

| Vista | Descripción |
|-------|-------------|
| `v_monthly_summary` | Totales por mes, categoría y tipo |
| `v_couple_balance` | Deuda neta entre los miembros de un vínculo |
| `v_upcoming_payments` | Ocurrencias pendientes ordenadas por fecha |
| `v_saving_goals_summary` | Saldo actual, progreso % y días restantes de cada meta |

---

## Seguridad — RLS

Todas las tablas tienen **Row Level Security activado**. Patrón general:

- Tablas de primer nivel (`profiles`, `categories`, `credit_cards`, `saving_goals`, `recurring_payments`): `auth.uid() = user_id`
- Tablas dependientes (`card_statements`, `occurrences`, `saving_transactions`): `EXISTS (SELECT 1 FROM tabla_padre WHERE user_id = auth.uid())`
- Tablas de pareja (`couples`, `couple_transactions`): `auth.uid() = user1_id OR auth.uid() = user2_id`

---

## Archivos de Migración

| Archivo | Contenido |
|---------|-----------|
| `001_extensions_and_enums.sql` | uuid-ossp + todos los ENUMs |
| `002_profiles.sql` | profiles + trigger handle_new_user |
| `003_categories.sql` | categories + seed_default_categories |
| `004_credit_cards.sql` | credit_cards + card_statements + next_cutoff_date |
| `005_personal_transactions.sql` | personal_transactions + v_monthly_summary |
| `006_couples.sql` | couples + couple_transactions + v_couple_balance |
| `007_recurring_payments.sql` | recurring_payments + occurrences + generate_occurrences + v_upcoming_payments |
| `008_savings.sql` | saving_goals + saving_transactions + apply_periodic_interest + v_saving_goals_summary |

---

## 🚀 Progreso Actual — FastAPI

Hasta la fecha, se ha completado la construcción de la estructura base y los primeros módulos core de negocio en FastAPI.

**Fases Completadas (✅):**
1. ✅ **Setup del proyecto**: Estructura de carpetas modular (`app/core`, `app/api/routers`, `app/schemas`, `app/db`), configuración con entorno virtual (`uv`, `pydantic-settings`), y conexión inicial configurada.
2. ✅ **Auth Middleware**: Se construyó el mecanismo base de autenticación en `/auth/login` y un inyector (Dependency) que usa el JWT con el paquete `supabase-py` activando el RLS en la sesión en vivo de la db.
3. ✅ **Módulo `personal`**: CRUD completo (GET, POST, PATCH, DELETE) para transacciones personales y conexión exitosa con la vista `/summary` mensual (`v_monthly_summary`).
4. ✅ **Módulo `cards`**: CRUD de las tarjetas de crédito (implementando soft-delete nativo). Integración de RPC a Supabase para calcular automáticamente la próxima de fecha de corte con un fallback local hecho en Python (basado en librería calendar), y su enlace de registro silencioso del estado de cuenta (`card_statements`).
5. ✅ **Módulo `recurring`**: Base CRUD para crear planes de suscripción. Utiliza un llamado a RPC para generar un historial (`generate_occurrences`). Incluye el endpoint `/occurrences/{id}/pay` el cual permite cerrar una ocurrencia y simula un registro real e íntegro inyectando automáticamente una transacción hacia "personal_transactions" actualizando saldos bajo un mismo botón. También están soportadas las vistas directas a los futuros pagos con la vista pre-existente.

6. ✅ **Módulo `couples`**: CRUD de vínculos y las operaciones cruzadas: registro de gastos compartidos con porcentajes divididos + acción de liquidación (settlement) completados con pruebas de integración.
7. ✅ **Módulo `savings`**: CRUD de metas financieras, el histórico de movimientos individuales del ahorro + implementación completada con éxito.
8. ✅ **Soporte MSI (Meses Sin Intereses)**: Implementación de lógica de división de transacciones (Madre/Hijas) en backend (Service/Router) y frontend (Modal reactivo), incluyendo cálculo preciso de fechas de cargo.
9. ✅ **Módulo `cards` Frontend**: Rediseño premium con "Obsidian Glassmorphism", gestión de utilización de crédito, visualización de estados de cuenta y CRUD completo de tarjetas.
10. ✅ **Sincronización Real-time**: Bus de eventos basado en Angular Signals (`RefreshService`) para coordinar la actualización de datos entre módulos tras cualquier movimiento.

11. ✅ **Frontend Base (Angular)** — Inicialización completada, estructura modular, Tailwind v4 configurado y sistema de diseño "Equilibrium Obsidian" establecido.

**Por Desarrollar / Siguientes Tareas (⏳):**
12. ✅ **Módulo Recurrentes (Suscripciones)** — Implementar la visualización y gestión de pagos recurrentes en el frontend.
13. ✅ **Calendario de Pagos** — Nueva vista para visualizar el impacto futuro de los MSI y pagos recurrentes en una línea de tiempo.
14. ✅ **PWA (Configuración Final)** — Refinar el service worker y la instalación offline para dispositivos móviles.
15. ✅ **Dashboard Analytics** — Gráficas avanzadas de flujo de caja y tendencias de gasto.

---

## Frontend — Decisiones de Arquitectura

### Tecnologías confirmadas
- **Angular 19+** con Standalone Components (sin NgModules)
- **Tailwind CSS v4** para utilidades de estilo
- **Angular Material** para componentes UI (forms, dialogs, snackbars)
- **@angular/pwa** para service worker y manifest
- **Angular Signals** como mecanismo de estado reactivo (sin NgRx)

### Estructura de carpetas planeada
```
src/
├── app/
│   ├── core/
│   │   ├── auth/           # Guard, interceptor JWT, servicio de sesión
│   │   ├── services/       # ApiService base (HttpClient wrapper)
│   │   └── models/         # Interfaces TypeScript espejo de los schemas FastAPI
│   ├── shared/
│   │   ├── components/     # Componentes reutilizables (cards, badges, empty-state)
│   │   ├── pipes/          # CurrencyMx, RelativeDate, etc.
│   │   └── directives/
│   ├── features/
│   │   ├── auth/           # Login, registro
│   │   ├── dashboard/      # Vista principal con resumen
│   │   ├── personal/       # Transacciones personales
│   │   ├── cards/          # Tarjetas de crédito y cortes
│   │   ├── recurring/      # Pagos recurrentes
│   │   ├── couples/        # Gastos en pareja
│   │   └── savings/        # Metas de ahorro
│   └── app.routes.ts       # Lazy loading por feature
├── assets/
└── manifest.webmanifest
```

### Convenciones Angular
- Todos los componentes son **Standalone** (`standalone: true`)
- Lazy loading obligatorio por feature route
- **Signals** para estado local de componentes (`signal()`, `computed()`, `effect()`)
- **Interceptor JWT**: adjunta el Bearer token de Supabase en cada request a FastAPI
- **Auth Guard**: redirige a `/login` si no hay sesión activa
- Formularios con **ReactiveFormsModule** (no template-driven)

### Requisitos PWA
- Responsive: mobile-first, breakpoints sm/md/lg de Tailwind
- Service worker con `@angular/pwa` (cache de assets y shell)
- Manifest con íconos, nombre y `display: standalone`
- Soporte offline básico: mostrar datos cacheados cuando no hay red

### Comunicación con FastAPI
- `ApiService` base con métodos genéricos `get<T>`, `post<T>`, `patch<T>`, `delete<T>`
- Interceptor agrega header `Authorization: Bearer <token>` en cada llamada
- Manejo de errores centralizado: interceptor de respuesta muestra snackbar en 401/403/500
- Modelos TypeScript en `core/models/` alineados 1:1 con los schemas Pydantic del backend