from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.types import Decimal
from typing import Optional
from datetime import date
from uuid import UUID

from app.schemas.enums import SavingGoalStatus, SavingTransactionType, RecurrenceFrequency

class SavingGoalBase(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    target_amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="MXN", min_length=3, max_length=3)
    annual_rate_pct: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, decimal_places=2)
    compounding_frequency: RecurrenceFrequency
    target_date: Optional[date] = None
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#([0-9A-Fa-f]{6})$")

    @field_validator("target_date")
    @classmethod
    def target_date_must_be_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v <= date.today():
            raise ValueError("La fecha límite debe ser una fecha futura.")
        return v

class SavingGoalCreate(SavingGoalBase):
    pass

class SavingGoalUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    target_amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    annual_rate_pct: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2)
    compounding_frequency: Optional[RecurrenceFrequency] = None
    target_date: Optional[date] = None
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#([0-9A-Fa-f]{6})$")
    status: Optional[SavingGoalStatus] = None

    @field_validator("target_date")
    @classmethod
    def target_date_must_be_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v <= date.today():
            raise ValueError("La fecha límite debe ser una fecha futura.")
        return v

class SavingGoalResponse(SavingGoalBase):
    id: UUID
    user_id: UUID
    status: SavingGoalStatus

    model_config = ConfigDict(from_attributes=True)

class SavingGoalSummaryResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str = Field(max_length=100)
    icon: Optional[str] = Field(None, max_length=10)
    color: Optional[str] = Field(None, max_length=7)
    target_amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="MXN", max_length=3)
    annual_rate_pct: Decimal = Field(default=Decimal("0.00"), decimal_places=2)
    target_date: Optional[date] = None
    status: SavingGoalStatus
    
    current_balance: Decimal
    progress_pct: Decimal
    remaining: Optional[Decimal] = None
    movement_count: Optional[int] = None
    last_movement_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)

class SavingTransactionBase(BaseModel):
    amount: Decimal = Field(decimal_places=2)   # Puede ser negativo (retiros en BD)
    type: SavingTransactionType
    notes: Optional[str] = Field(None, max_length=300)
    transaction_date: date

class SavingTransactionCreate(SavingTransactionBase):
    amount: Decimal = Field(gt=0, decimal_places=2)  # El frontend siempre manda positivo

class SavingTransactionResponse(SavingTransactionBase):
    id: UUID
    saving_goal_id: UUID

    model_config = ConfigDict(from_attributes=True)
