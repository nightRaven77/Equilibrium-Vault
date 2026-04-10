from enum import Enum

class TransactionType(str, Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"

class PaymentMethod(str, Enum):
    credit_card = "credit_card"
    debit_card = "debit_card"
    cash = "cash"
    transfer = "transfer"
    digital_wallet = "digital_wallet"

class StatementStatus(str, Enum):
    open = "open"
    closed = "closed"
    paid = "paid"
    overdue = "overdue"

class RecurrenceFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"

class OccurrenceStatus(str, Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    skipped = "skipped"
