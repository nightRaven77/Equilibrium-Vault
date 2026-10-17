from typing import List, Optional, Dict
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal
from calendar import monthrange
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.budgets import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    Rule503020Response,
    RuleBucketSummary,
    RuleBucket,
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _get_current_month_range() -> tuple[date, date]:
    """Retorna el primer y último día del mes en curso."""
    today = date.today()
    first_day = today.replace(day=1)
    _, last_day_num = monthrange(today.year, today.month)
    last_day = today.replace(day=last_day_num)
    return first_day, last_day


@router.get("/", response_model=List[BudgetResponse])
def get_budgets(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene los presupuestos del usuario autenticado, enriquecidos con:
    - Información de categoría (nombre, icono, color)
    - Gasto real acumulado en el mes en curso
    - Saldo restante y porcentaje de consumo
    - Estado de alerta (normal, warning, exceeded)
    """
    user = supabase.auth.get_user().user
    first_day, last_day = _get_current_month_range()

    # 1. Obtener presupuestos con categoría
    budgets_resp = supabase.table("budgets").select("*, categories(name, icon, color)").order("created_at").execute()
    budgets = budgets_resp.data or []
    if not budgets:
        return []

    # 2. Consultar gastos del mes en curso agrupables por categoría
    tx_resp = supabase.table("personal_transactions").select("category_id, amount") \
        .eq("user_id", str(user.id)) \
        .eq("type", "expense") \
        .gte("transaction_date", str(first_day)) \
        .lte("transaction_date", str(last_day)) \
        .is_("parent_transaction_id", "null") \
        .execute()

    spent_by_category: Dict[str, Decimal] = {}
    for tx in (tx_resp.data or []):
        cat_id = tx.get("category_id")
        if cat_id:
            spent_by_category[cat_id] = spent_by_category.get(cat_id, Decimal("0.00")) + Decimal(str(tx.get("amount", 0)))

    # 3. Construir respuestas enriquecidas
    results: List[BudgetResponse] = []
    for b in budgets:
        cat = b.get("categories") or {}
        cat_id = b["category_id"]
        limit = Decimal(str(b["monthly_limit"]))
        spent = spent_by_category.get(cat_id, Decimal("0.00"))
        remaining = max(Decimal("0.00"), limit - spent)
        pct = float((spent / limit) * 100) if limit > Decimal("0.00") else 0.0

        if pct >= 100.0:
            budget_status = "exceeded"
        elif pct >= 80.0:
            budget_status = "warning"
        else:
            budget_status = "normal"

        results.append(
            BudgetResponse(
                id=UUID(b["id"]),
                user_id=UUID(b["user_id"]),
                category_id=UUID(cat_id),
                monthly_limit=limit,
                rule_bucket=RuleBucket(b.get("rule_bucket", "needs")),
                category_name=cat.get("name"),
                category_icon=cat.get("icon"),
                category_color=cat.get("color"),
                spent_this_month=spent,
                remaining=remaining,
                percentage_used=round(pct, 1),
                status=budget_status,
                created_at=b.get("created_at"),
            )
        )

    return results


@router.get("/50-30-20", response_model=Rule503020Response)
def get_rule_50_30_20_summary(supabase: Client = Depends(get_current_user_supplier)):
    """
    Analiza la salud financiera mensual del usuario bajo la Regla 50/30/20:
    - 50% Necesidades Básicas (Needs)
    - 30% Deseos y Estilo de Vida (Wants)
    - 20% Ahorro e Inversión (Savings)
    """
    user = supabase.auth.get_user().user
    first_day, last_day = _get_current_month_range()
    month_label = first_day.strftime("%B %Y")

    # 1. Calcular ingresos reales del mes en curso
    income_resp = supabase.table("personal_transactions").select("amount") \
        .eq("user_id", str(user.id)) \
        .eq("type", "income") \
        .gte("transaction_date", str(first_day)) \
        .lte("transaction_date", str(last_day)) \
        .execute()

    monthly_income = sum([Decimal(str(tx.get("amount", 0))) for tx in (income_resp.data or [])])

    # 2. Consultar presupuestos del usuario
    budgets_resp = supabase.table("budgets").select("category_id, monthly_limit, rule_bucket").execute()
    budgets = budgets_resp.data or []

    # 3. Consultar gastos del mes
    tx_resp = supabase.table("personal_transactions").select("category_id, amount") \
        .eq("user_id", str(user.id)) \
        .eq("type", "expense") \
        .gte("transaction_date", str(first_day)) \
        .lte("transaction_date", str(last_day)) \
        .is_("parent_transaction_id", "null") \
        .execute()

    spent_by_category: Dict[str, Decimal] = {}
    for tx in (tx_resp.data or []):
        cat_id = tx.get("category_id")
        if cat_id:
            spent_by_category[cat_id] = spent_by_category.get(cat_id, Decimal("0.00")) + Decimal(str(tx.get("amount", 0)))

    # 4. Sumar depósitos a metas de ahorro en el mes (para el bucket savings)
    saving_tx_resp = supabase.table("saving_transactions").select("amount, type") \
        .eq("type", "deposit") \
        .gte("transaction_date", str(first_day)) \
        .lte("transaction_date", str(last_day)) \
        .execute()
    savings_deposits = sum([Decimal(str(tx.get("amount", 0))) for tx in (saving_tx_resp.data or [])])

    # 5. Agrupar por cubo
    bucket_budgeted = {"needs": Decimal("0.00"), "wants": Decimal("0.00"), "savings": Decimal("0.00")}
    bucket_spent = {"needs": Decimal("0.00"), "wants": Decimal("0.00"), "savings": savings_deposits}

    for b in budgets:
        bucket = b.get("rule_bucket", "needs")
        cat_id = b.get("category_id")
        limit = Decimal(str(b.get("monthly_limit", 0)))
        bucket_budgeted[bucket] += limit
        bucket_spent[bucket] += spent_by_category.get(cat_id, Decimal("0.00"))

    # Metas ideales 50/30/20
    needs_target = (monthly_income * Decimal("0.50")).quantize(Decimal("0.01"))
    wants_target = (monthly_income * Decimal("0.30")).quantize(Decimal("0.01"))
    savings_target = (monthly_income * Decimal("0.20")).quantize(Decimal("0.01"))

    def _calc_bucket_summary(bucket: RuleBucket, target: Decimal, target_pct: float) -> RuleBucketSummary:
        budgeted = bucket_budgeted[bucket.value]
        spent = bucket_spent[bucket.value]
        pct_income = float((spent / monthly_income) * 100) if monthly_income > Decimal("0.00") else 0.0

        if monthly_income > Decimal("0.00") and spent > target:
            status_str = "over_budget"
        elif monthly_income > Decimal("0.00") and spent < (target * Decimal("0.50")):
            status_str = "under_budget"
        else:
            status_str = "optimal"

        return RuleBucketSummary(
            bucket=bucket,
            target_pct=target_pct,
            target_amount=target,
            budgeted_amount=budgeted,
            spent_amount=spent,
            percentage_of_income=round(pct_income, 1),
            status=status_str,
        )

    needs_summary = _calc_bucket_summary(RuleBucket.needs, needs_target, 50.0)
    wants_summary = _calc_bucket_summary(RuleBucket.wants, wants_target, 30.0)
    savings_summary = _calc_bucket_summary(RuleBucket.savings, savings_target, 20.0)

    total_budgeted = sum(bucket_budgeted.values())
    total_spent = sum(bucket_spent.values())
    unallocated = max(Decimal("0.00"), monthly_income - total_budgeted)

    if total_spent > monthly_income and monthly_income > Decimal("0.00"):
        health = "deficit"
    elif needs_summary.spent_amount > needs_target:
        health = "warning"
    else:
        health = "balanced"

    return Rule503020Response(
        current_month=month_label,
        monthly_income=monthly_income,
        total_budgeted=total_budgeted,
        total_spent=total_spent,
        needs=needs_summary,
        wants=wants_summary,
        savings=savings_summary,
        unallocated_income=unallocated,
        overall_health=health,
    )


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    data: BudgetCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea un nuevo tope presupuestal para una categoría.
    Un usuario solo puede tener un presupuesto activo por categoría.
    """
    user = supabase.auth.get_user().user

    # Validar que la categoría existe y pertenece al usuario
    cat_resp = supabase.table("categories").select("*").eq("id", str(data.category_id)).execute()
    if not cat_resp.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat = cat_resp.data[0]

    # Validar que no exista un presupuesto previo para esta categoría
    existing = supabase.table("budgets").select("id").eq("user_id", str(user.id)).eq("category_id", str(data.category_id)).execute()
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail={"code": "DUPLICATE_BUDGET", "message": f"Ya existe un presupuesto asignado a la categoría '{cat['name']}'."}
        )

    payload = {
        "user_id": str(user.id),
        "category_id": str(data.category_id),
        "monthly_limit": float(data.monthly_limit),
        "rule_bucket": data.rule_bucket.value,
    }

    res = supabase.table("budgets").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error al crear el presupuesto")

    created = res.data[0]
    limit = Decimal(str(created["monthly_limit"]))

    return BudgetResponse(
        id=UUID(created["id"]),
        user_id=UUID(created["user_id"]),
        category_id=UUID(created["category_id"]),
        monthly_limit=limit,
        rule_bucket=RuleBucket(created.get("rule_bucket", "needs")),
        category_name=cat.get("name"),
        category_icon=cat.get("icon"),
        category_color=cat.get("color"),
        spent_this_month=Decimal("0.00"),
        remaining=limit,
        percentage_used=0.0,
        status="normal",
        created_at=created.get("created_at"),
    )


@router.patch("/{id}", response_model=BudgetResponse)
def update_budget(
    id: UUID,
    data: BudgetUpdate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Actualiza el límite mensual o el bucket de la regla 50/30/20 de un presupuesto.
    """
    update_data = data.model_dump(mode="json", exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No se enviaron campos para actualizar")

    res = supabase.table("budgets").update(update_data).eq("id", str(id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    updated = res.data[0]
    limit = Decimal(str(updated["monthly_limit"]))

    # Categoría
    cat_resp = supabase.table("categories").select("name, icon, color").eq("id", updated["category_id"]).execute()
    cat = cat_resp.data[0] if cat_resp.data else {}

    return BudgetResponse(
        id=UUID(updated["id"]),
        user_id=UUID(updated["user_id"]),
        category_id=UUID(updated["category_id"]),
        monthly_limit=limit,
        rule_bucket=RuleBucket(updated.get("rule_bucket", "needs")),
        category_name=cat.get("name"),
        category_icon=cat.get("icon"),
        category_color=cat.get("color"),
        spent_this_month=Decimal("0.00"),
        remaining=limit,
        percentage_used=0.0,
        status="normal",
        created_at=updated.get("created_at"),
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Elimina un presupuesto.
    """
    res = supabase.table("budgets").delete().eq("id", str(id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return None
