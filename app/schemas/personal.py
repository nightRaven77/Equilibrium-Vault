from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import Decimal
from typing import Optional
from datetime import date, datetime
from uuid import UUID

from app.schemas.enums import TransactionType, PaymentMethod


class TransactionBase(BaseModel):
    category_id: UUID
    credit_card_id: Optional[UUID] = None
    card_statement_id: Optional[UUID] = None
    amount: Decimal = Field(gt=0, decimal_places=2)
    type: TransactionType
    payment_method: PaymentMethod
    description: str = Field(max_length=200)
    notes: Optional[str] = None
    transaction_date: date


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    category_id: Optional[UUID] = None
    credit_card_id: Optional[UUID] = None
    card_statement_id: Optional[UUID] = None
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    type: Optional[TransactionType] = None
    payment_method: Optional[PaymentMethod] = None
    description: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None
    transaction_date: Optional[date] = None


class TransactionResponse(TransactionBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class MonthlySummaryRead(BaseModel):
    year_month: str # e.g. "2024-04"
    category_id: UUID
    category_name: str
    type: TransactionType
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)
