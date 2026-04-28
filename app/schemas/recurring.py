from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.types import Decimal
from typing import Optional
from datetime import date
from uuid import UUID

from app.schemas.enums import PaymentMethod, RecurrenceFrequency, OccurrenceStatus


class RecurringPaymentBase(BaseModel):
    category_id: UUID
    credit_card_id: Optional[UUID] = None
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=200)
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="MXN", min_length=3, max_length=3)
    payment_method: PaymentMethod
    frequency: RecurrenceFrequency
    start_date: date
    end_date: Optional[date] = None
    day_of_period: int = Field(ge=1, le=31)
    reminder_days_before: int = Field(default=3, ge=0, le=30)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates_and_period(self) -> "RecurringPaymentBase":
        # end_date debe ser posterior a start_date
        if self.end_date and self.start_date and self.end_date <= self.start_date:
            raise ValueError("end_date debe ser posterior a start_date.")

        # Para frecuencias semanales el día del periodo es 1-7 (día de semana)
        if self.frequency in (RecurrenceFrequency.weekly, RecurrenceFrequency.biweekly):
            if self.day_of_period > 7:
                raise ValueError(
                    f"Para frecuencia '{self.frequency.value}' el día del periodo debe estar entre 1 y 7 (lunes=1 ... domingo=7)."
                )

        return self


class RecurringPaymentCreate(RecurringPaymentBase):
    pass


class RecurringPaymentUpdate(BaseModel):
    category_id: Optional[UUID] = None
    credit_card_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    payment_method: Optional[PaymentMethod] = None
    frequency: Optional[RecurrenceFrequency] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    day_of_period: Optional[int] = Field(None, ge=1, le=31)
    reminder_days_before: Optional[int] = Field(None, ge=0, le=30)
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "RecurringPaymentUpdate":
        if self.end_date and self.start_date and self.end_date <= self.start_date:
            raise ValueError("end_date debe ser posterior a start_date.")
        return self


class RecurringPaymentResponse(RecurringPaymentBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class OccurrenceResponse(BaseModel):
    id: UUID
    recurring_payment_id: UUID
    scheduled_date: date
    status: OccurrenceStatus
    amount_override: Optional[Decimal] = None
    actual_transaction_id: Optional[UUID] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OccurrencePayRequest(BaseModel):
    amount_override: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    notes: Optional[str] = Field(None, max_length=300)


class UpcomingPaymentResponse(BaseModel):
    occurrence_id: UUID
    recurring_payment_id: UUID
    plan_name: Optional[str] = None   # alias para compatibilidad con la vista
    name: Optional[str] = None        # nombre directo si la vista lo expone así
    scheduled_date: date
    amount: Decimal
    currency: str
    status: OccurrenceStatus = OccurrenceStatus.pending

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="after")
    def normalize_name(self) -> "UpcomingPaymentResponse":
        # La vista puede devolver el nombre como 'name' o 'plan_name'
        if not self.name and self.plan_name:
            self.name = self.plan_name
        elif not self.plan_name and self.name:
            self.plan_name = self.name
        return self
