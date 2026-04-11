from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import Decimal
from typing import Optional
from datetime import date
from uuid import UUID

from app.schemas.enums import SavingGoalStatus, SavingTransactionType, RecurrenceFrequency

class SavingGoalBase(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    target_amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="MXN", max_length=3)
    annual_rate_pct: Decimal = Field(default=Decimal("0.00"), decimal_places=2)
    compounding_frequency: RecurrenceFrequency
    target_date: Optional[date] = None
    icon: Optional[str] = Field(None, max_length=10)
    color: Optional[str] = Field(None, max_length=7)

class SavingGoalCreate(SavingGoalBase):
    pass

class SavingGoalUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    target_amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    currency: Optional[str] = Field(None, max_length=3)
    annual_rate_pct: Optional[Decimal] = Field(None, decimal_places=2)
    compounding_frequency: Optional[RecurrenceFrequency] = None
    target_date: Optional[date] = None
    icon: Optional[str] = Field(None, max_length=10)
    color: Optional[str] = Field(None, max_length=7)
    status: Optional[SavingGoalStatus] = None

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
    amount: Decimal = Field(decimal_places=2)
    type: SavingTransactionType
    notes: Optional[str] = Field(None, max_length=300)
    transaction_date: date

class SavingTransactionCreate(SavingTransactionBase):
    pass

class SavingTransactionResponse(SavingTransactionBase):
    id: UUID
    saving_goal_id: UUID

    model_config = ConfigDict(from_attributes=True)
