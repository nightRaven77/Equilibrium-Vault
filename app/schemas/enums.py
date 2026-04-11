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

class CoupleStatus(str, Enum):
    active = "active"
    inactive = "inactive"

class SettlementStatus(str, Enum):
    pending = "pending"
    settled = "settled"

class SavingGoalStatus(str, Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"

class SavingTransactionType(str, Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    interest = "interest"
