from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum


class RuleBucket(str, Enum):
    needs = "needs"      # 50% Necesidades básicas (Vivienda, Alimentación, Transporte, Salud, Servicios)
    wants = "wants"      # 30% Deseos / Estilo de vida (Entretenimiento, Salidas, Compras, Viajes)
    savings = "savings"  # 20% Ahorro e Inversión (Metas, Fondo emergencia, Cetes)


class BudgetCreate(BaseModel):
    category_id: UUID
    monthly_limit: Decimal = Field(gt=0, decimal_places=2, description="Límite máximo mensual presupuestado")
    rule_bucket: RuleBucket = Field(default=RuleBucket.needs, description="Clasificación en la regla 50/30/20")


class BudgetUpdate(BaseModel):
    monthly_limit: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    rule_bucket: Optional[RuleBucket] = None


class BudgetResponse(BaseModel):
    id: UUID
    user_id: UUID
    category_id: UUID
    monthly_limit: Decimal
    rule_bucket: RuleBucket
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    spent_this_month: Decimal = Decimal("0.00")
    remaining: Decimal = Decimal("0.00")
    percentage_used: float = 0.0
    status: str = "normal"  # normal (<80%), warning (80-99%), exceeded (>=100%)
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RuleBucketSummary(BaseModel):
    bucket: RuleBucket
    target_pct: float
    target_amount: Decimal
    budgeted_amount: Decimal
    spent_amount: Decimal
    percentage_of_income: float
    status: str  # optimal, under_budget, over_budget


class Rule503020Response(BaseModel):
    current_month: str
    monthly_income: Decimal
    total_budgeted: Decimal
    total_spent: Decimal
    needs: RuleBucketSummary
    wants: RuleBucketSummary
    savings: RuleBucketSummary
    unallocated_income: Decimal
    overall_health: str  # balanced, warning, deficit

    model_config = ConfigDict(from_attributes=True)
