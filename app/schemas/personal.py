from pydantic import BaseModel, ConfigDict, Field, model_validator
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
    
    # MSI fields
    is_installment: bool = False
    installment_months: Optional[int] = Field(None, gt=1, le=48)
    parent_transaction_id: Optional[UUID] = None


class TransactionCreate(TransactionBase):
    @model_validator(mode='after')
    def validate_installment(self) -> 'TransactionCreate':
        if self.is_installment:
            if self.installment_months is None:
                raise ValueError('installment_months es obligatorio cuando is_installment=True')
            if self.payment_method != PaymentMethod.credit_card:
                raise ValueError('MSI solo aplica para pagos con tarjeta de crédito')
            if self.credit_card_id is None:
                raise ValueError('credit_card_id es obligatorio para MSI')
        return self


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


class CategorySummary(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None

class TransactionResponse(TransactionBase):
    id: UUID
    user_id: UUID
    categories: Optional[CategorySummary] = None

    model_config = ConfigDict(from_attributes=True)


class MonthlySummaryRead(BaseModel):
    month: str | date
    category: str
    category_color: str | None = None
    category_icon: str | None = None
    type: TransactionType
    transaction_count: int
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class InstallmentPlanResponse(BaseModel):
    id: UUID
    original_tx_id: UUID
    credit_card_id: UUID
    total_amount: Decimal
    total_months: int
    monthly_amount: Decimal
    first_charge_date: date
    status: str
    paid_count: int
    pending_count: int

    model_config = ConfigDict(from_attributes=True)
