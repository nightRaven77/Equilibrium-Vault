# Implementación MSI (Meses Sin Intereses) — FastAPI

## Contexto

El módulo de tarjetas de crédito ya existe y funciona. Esta tarea agrega soporte para
compras diferidas a MSI. La migración de base de datos **ya fue aplicada** — solo hay
que implementar la lógica en FastAPI.

---

## Qué cambió en la DB

### `personal_transactions` — 3 columnas nuevas

| Columna                 | Tipo                                    | Notas                                                                       |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `is_installment`        | BOOLEAN NOT NULL DEFAULT FALSE          | TRUE si la compra es MSI                                                    |
| `installment_months`    | SMALLINT NULL                           | Total de parcialidades (3,6,12,18,24). Obligatorio si `is_installment=TRUE` |
| `parent_transaction_id` | UUID NULL FK → personal_transactions.id | NULL en la madre, NOT NULL en cada hija                                     |

**Constraints en DB (ya existen, no duplicar en código):**

- Si `parent_transaction_id IS NOT NULL` → `is_installment` debe ser FALSE (no hay hijas de hijas)
- Si `is_installment = TRUE` → `installment_months` es obligatorio

### Nueva tabla `installment_plans`

```
id                UUID PK
original_tx_id    UUID NOT NULL UNIQUE FK → personal_transactions.id
credit_card_id    UUID NOT NULL FK → credit_cards.id
total_amount      NUMERIC(12,2)
total_months      SMALLINT
monthly_amount    NUMERIC(12,2)   -- total_amount / total_months
first_charge_date DATE
status            VARCHAR(20)     -- 'active' | 'completed' | 'cancelled'
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

### Vistas nuevas/actualizadas

- `v_monthly_summary` — ya filtra `WHERE parent_transaction_id IS NULL` (sin doble conteo)
- `v_card_committed_balance` — nueva, muestra saldo comprometido por tarjeta

---

## Lógica de negocio MSI

### Concepto

Una compra a MSI genera:

1. **Transacción madre** — el monto total ($12,000). Aparece en el resumen del mes de compra. `is_installment=TRUE`
2. **`installment_plan`** — la configuración del diferimiento
3. **N transacciones hijas** — una por mes ($1,000 c/u). Tienen `parent_transaction_id` apuntando a la madre. Cada una se asigna al `card_statement` del corte que le corresponde. NO aparecen en `v_monthly_summary`.

### Cálculo de fechas de cada hija

```python
from dateutil.relativedelta import relativedelta

def calcular_fechas_hijas(first_charge_date: date, total_months: int) -> list[date]:
    return [first_charge_date + relativedelta(months=i) for i in range(total_months)]
```

### Buscar o crear el card_statement para una fecha

Cada hija necesita su `card_statement_id`. Si no existe el corte para ese mes, crearlo:

```python
# Pseudocódigo
for fecha in fechas_hijas:
    statement = buscar_statement_por_fecha(credit_card_id, fecha)
    if not statement:
        statement = crear_statement(credit_card_id, fecha)
    crear_transaccion_hija(amount=monthly_amount, card_statement_id=statement.id, ...)
```

---

## Cambios en FastAPI

### 1. Schema Pydantic — actualizar `PersonalTransactionCreate`

```python
class PersonalTransactionCreate(BaseModel):
    # --- campos existentes ---
    category_id: UUID
    credit_card_id: UUID | None = None
    card_statement_id: UUID | None = None
    amount: Decimal
    type: TransactionType
    payment_method: PaymentMethod
    description: str
    notes: str | None = None
    transaction_date: date = Field(default_factory=date.today)

    # --- campos nuevos MSI ---
    is_installment: bool = False
    installment_months: int | None = Field(None, gt=1, le=48)

    @model_validator(mode='after')
    def validate_installment(self):
        if self.is_installment:
            if self.installment_months is None:
                raise ValueError('installment_months es obligatorio cuando is_installment=True')
            if self.payment_method != PaymentMethod.credit_card:
                raise ValueError('MSI solo aplica para pagos con tarjeta de crédito')
            if self.credit_card_id is None:
                raise ValueError('credit_card_id es obligatorio para MSI')
        return self
```

### 2. Schema nuevo `InstallmentPlanResponse`

```python
class InstallmentPlanResponse(BaseModel):
    id: UUID
    original_tx_id: UUID
    credit_card_id: UUID
    total_amount: Decimal
    total_months: int
    monthly_amount: Decimal
    first_charge_date: date
    status: str
    paid_count: int       # cuántas hijas ya tienen card_statement asignado
    pending_count: int    # cuántas hijas aún pendientes
```

### 3. Servicio — `PersonalTransactionService`

Agregar método `create_with_installments()`:

```python
async def create_with_installments(
    self,
    data: PersonalTransactionCreate,
    user_id: UUID
) -> PersonalTransactionResponse:

    async with self.db.transaction():

        # 1. Crear transacción madre
        madre = await self.db.insert('personal_transactions', {
            **data.model_dump(exclude={'installment_months'}),
            'user_id': user_id,
            'is_installment': True,
            'installment_months': data.installment_months,
            'parent_transaction_id': None,
        })

        # 2. Calcular monto mensual
        monthly_amount = round(data.amount / data.installment_months, 2)

        # 3. Determinar primera fecha de cargo
        #    Usar la función SQL next_cutoff_date() de la tarjeta
        tarjeta = await self.get_credit_card(data.credit_card_id)
        first_charge_date = calcular_primer_cargo(
            cutoff_day=tarjeta.cutoff_day,
            from_date=data.transaction_date
        )

        # 4. Crear installment_plan
        plan = await self.db.insert('installment_plans', {
            'original_tx_id': madre['id'],
            'credit_card_id': data.credit_card_id,
            'total_amount': data.amount,
            'total_months': data.installment_months,
            'monthly_amount': monthly_amount,
            'first_charge_date': first_charge_date,
            'status': 'active',
        })

        # 5. Generar N transacciones hijas
        for i in range(data.installment_months):
            fecha_cargo = first_charge_date + relativedelta(months=i)

            # Buscar o crear el statement de ese mes
            statement_id = await self.get_or_create_statement(
                credit_card_id=data.credit_card_id,
                charge_date=fecha_cargo
            )

            await self.db.insert('personal_transactions', {
                'user_id': user_id,
                'category_id': data.category_id,
                'credit_card_id': data.credit_card_id,
                'card_statement_id': statement_id,
                'amount': monthly_amount,
                'type': 'expense',
                'payment_method': PaymentMethod.credit_card,
                'description': f'{data.description} ({i+1}/{data.installment_months})',
                'transaction_date': fecha_cargo,
                'is_installment': False,
                'parent_transaction_id': madre['id'],
            })

        # 6. Marcar installment_plan como completed si solo fue 1 mes (edge case)
        return madre
```

### 4. Router — actualizar `POST /personal`

```python
@router.post('/', response_model=PersonalTransactionResponse, status_code=201)
async def create_transaction(
    data: PersonalTransactionCreate,
    user=Depends(get_current_user),
    service: PersonalTransactionService = Depends()
):
    if data.is_installment:
        return await service.create_with_installments(data, user.id)
    else:
        return await service.create(data, user.id)
```

### 5. Endpoints nuevos para MSI

```
GET  /personal/installments                    → lista todos los planes MSI activos del usuario
GET  /personal/installments/{plan_id}          → detalle de un plan + hijas
PATCH /personal/installments/{plan_id}/cancel  → cancelar plan (marca status='cancelled')
GET  /cards/{card_id}/committed-balance        → consulta v_card_committed_balance
```

---

## Helper — calcular primer cargo

```python
from calendar import monthrange
from datetime import date
from dateutil.relativedelta import relativedelta

def calcular_primer_cargo(cutoff_day: int, from_date: date) -> date:
    """
    El primer cargo cae en el corte SIGUIENTE a la fecha de compra.
    Si compras el día 10 y el corte es día 15, el primer cargo es el día 15 de ese mes.
    Si compras el día 20 y el corte es día 15, el primer cargo es el día 15 del mes siguiente.
    """
    # Intentar el corte en el mes actual
    ultimo_dia = monthrange(from_date.year, from_date.month)[1]
    dia_ajustado = min(cutoff_day, ultimo_dia)
    candidato = from_date.replace(day=dia_ajustado)

    # Si ya pasó el corte este mes, ir al siguiente
    if candidato <= from_date:
        siguiente_mes = from_date + relativedelta(months=1)
        ultimo_dia = monthrange(siguiente_mes.year, siguiente_mes.month)[1]
        candidato = siguiente_mes.replace(day=min(cutoff_day, ultimo_dia))

    return candidato
```

---

## Casos edge a manejar

| Caso                              | Manejo                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Monto no divisible exactamente    | La última hija absorbe el centavo restante: `last_amount = total - (monthly * (n-1))`   |
| Cancelación anticipada del plan   | Marcar plan como `cancelled`, eliminar hijas que no tengan `card_statement_id` asignado |
| Tarjeta cancelada con plan activo | Mantener las hijas, solo bloquear nuevas compras MSI con esa tarjeta                    |
| `installment_months = 1`          | Rechazar en validación Pydantic — no es MSI, es una compra normal                       |

---

## Dependencia nueva requerida

```
python-dateutil>=2.9
```

Agregar a `requirements.txt` o `pyproject.toml`.
