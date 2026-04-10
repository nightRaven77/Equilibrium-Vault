from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import Decimal
from typing import Optional
from datetime import date
from uuid import UUID

from app.schemas.enums import PaymentMethod, RecurrenceFrequency, OccurrenceStatus
from app.schemas.personal import TransactionResponse


class RecurringPaymentBase(BaseModel):
    """Esquema base para un pago recurrente 
    usando como campos:
    nombre, 
    la descripcion, 
    el monto, la moneda, el metodo de pago, la frecuencia, la fecha de inicio, la fecha de fin, el dia del periodo, el recordatorio y si esta activo"""
    category_id: UUID
    credit_card_id: Optional[UUID] = None
    name: str = Field(max_length=100)
    description: Optional[str] = Field(None, max_length=200)
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="MXN", min_length=3, max_length=3)
    payment_method: PaymentMethod
    frequency: RecurrenceFrequency
    start_date: date
    end_date: Optional[date] = None
    day_of_period: int = Field(ge=1, le=31)
    reminder_days_before: int = Field(default=3)
    is_active: bool = True

class RecurringPaymentCreate(RecurringPaymentBase):
    """Esquema para crear un pago recurrente"""
    pass

class RecurringPaymentUpdate(BaseModel):
    """ Esquema base para la actualización de un pago recurrente"""
    category_id: Optional[UUID] = None
    credit_card_id: Optional[UUID] = None
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    payment_method: Optional[PaymentMethod] = None
    frequency: Optional[RecurrenceFrequency] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    day_of_period: Optional[int] = Field(None, ge=1, le=31)
    reminder_days_before: Optional[int] = Field(None)
    is_active: Optional[bool] = None

class RecurringPaymentResponse(RecurringPaymentBase):
    """ Esquema base para la respuesta de un pago recurrente"""
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


class OccurrenceResponse(BaseModel):
    """ Esquema base para la respuesta de una ocurrencia tienedo los campos de la fecha, el estatus el monto y la transaccion real
    pending, paid, skipped"""
    id: UUID
    recurring_payment_id: UUID
    scheduled_date: date
    status: OccurrenceStatus
    amount_override: Optional[Decimal] = None
    actual_transaction_id: Optional[UUID] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OccurrencePayRequest(BaseModel):
    """ Esquema base para el pago de una ocurrencia"""
    amount_override: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    notes: Optional[str] = Field(None, max_length=300)


class UpcomingPaymentResponse(BaseModel):
    """ Esquema base para la respuesta de un pago recurrente"""
    # Asumimos una vista básica que devuelve id, recurring_payment_id, name, amount, date, status.
    # El archivo de contexto menciona que devuelve occurrences pendientes ordenadas.
    occurrence_id: UUID
    recurring_payment_id: UUID
    name: str
    scheduled_date: date
    amount: Decimal
    currency: str

    model_config = ConfigDict(from_attributes=True)
