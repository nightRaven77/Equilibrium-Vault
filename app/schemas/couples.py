from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.types import Decimal
from typing import Optional
from datetime import date, datetime
from uuid import UUID

from app.schemas.enums import CoupleStatus, SettlementStatus, PaymentMethod

class CoupleBase(BaseModel):
    name: Optional[str] = Field(None, max_length=80)


class CoupleCreate(CoupleBase):
    user2_id: UUID


class CoupleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    status: Optional[CoupleStatus] = None


class CoupleResponse(CoupleBase):
    id: UUID
    user1_id: UUID
    user2_id: UUID
    status: CoupleStatus
    user1_name: Optional[str] = None
    user2_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CoupleTransactionBase(BaseModel):
    category_id: UUID
    credit_card_id: Optional[UUID] = None
    amount: Decimal = Field(gt=0, decimal_places=2)
    payment_method: PaymentMethod
    description: str = Field(min_length=1, max_length=200)
    user1_share_pct: Decimal = Field(default=Decimal("50.00"), ge=0, le=100, max_digits=5, decimal_places=2)
    user2_share_pct: Decimal = Field(default=Decimal("50.00"), ge=0, le=100, max_digits=5, decimal_places=2)
    transaction_date: date

    @model_validator(mode="after")
    def shares_must_sum_100(self) -> "CoupleTransactionBase":
        total = (self.user1_share_pct or Decimal("0")) + (self.user2_share_pct or Decimal("0"))
        if total != Decimal("100.00"):
            raise ValueError(f"Los porcentajes deben sumar 100 (actualmente suman {total}).")
        return self


class CoupleTransactionCreate(CoupleTransactionBase):
    paid_by_user_id: UUID


class CoupleTransactionUpdate(BaseModel):
    status: SettlementStatus


class CoupleTransactionResponse(CoupleTransactionBase):
    id: UUID
    couple_id: UUID
    paid_by_user_id: UUID
    status: SettlementStatus
    settled_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CoupleBalanceResponse(BaseModel):
    debtor_id: Optional[UUID] = None
    creditor_id: Optional[UUID] = None
    debtor_name: Optional[str] = None
    creditor_name: Optional[str] = None
    amount: Decimal
    is_settled: bool
