from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import Decimal
from typing import Optional
from datetime import date
from uuid import UUID

from app.schemas.enums import StatementStatus


class CreditCardBase(BaseModel):
    bank_name: str = Field(max_length=80)
    alias: Optional[str] = Field(None, max_length=60)
    last_four: str = Field(min_length=4, max_length=4)
    credit_limit: Decimal = Field(gt=0, decimal_places=2)
    cutoff_day: int = Field(ge=1, le=31)
    payment_due_days: int = Field(default=20)
    min_payment_pct: Decimal = Field(default=1.50, max_digits=5, decimal_places=2)
    annual_rate_pct: Decimal = Field(default=0, max_digits=5, decimal_places=2)
    is_active: bool = True

class CreditCardCreate(CreditCardBase):
    pass

class CreditCardUpdate(BaseModel):
    bank_name: Optional[str] = Field(None, max_length=80)
    alias: Optional[str] = Field(None, max_length=60)
    credit_limit: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    cutoff_day: Optional[int] = Field(None, ge=1, le=31)
    payment_due_days: Optional[int] = Field(None)
    min_payment_pct: Optional[Decimal] = Field(None, max_digits=5, decimal_places=2)
    annual_rate_pct: Optional[Decimal] = Field(None, max_digits=5, decimal_places=2)
    is_active: Optional[bool] = None

class CreditCardResponse(CreditCardBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class CardStatementResponse(BaseModel):
    id: UUID
    credit_card_id: UUID
    cutoff_date: date
    payment_due_date: date
    total_balance: Decimal
    minimum_payment: Decimal
    status: StatementStatus

    model_config = ConfigDict(from_attributes=True)
