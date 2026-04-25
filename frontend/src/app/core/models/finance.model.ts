export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  credit_card_id?: string | null;
  card_statement_id?: string | null;
  amount: number;
  type: 'income' | 'expense';
  payment_method: string;
  description: string;
  notes?: string | null;
  transaction_date: string;
  is_installment: boolean;
  installment_months?: number | null;
  parent_transaction_id?: string | null;
}

export interface TransactionCreate {
  category_id: string;
  credit_card_id?: string | null;
  card_statement_id?: string | null;
  amount: number;
  type: 'income' | 'expense';
  payment_method: string;
  description: string;
  notes?: string | null;
  transaction_date: string;
  is_installment: boolean;
  installment_months?: number | null;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface MonthlySummary {
  month: string;
  category: string;
  category_color?: string;
  category_icon?: string;
  type: 'income' | 'expense';
  transaction_count: number;
  total_amount: number;
}

export interface CoupleBalance {
  debtor_id?: string;
  creditor_id?: string;
  debtor_name?: string;
  creditor_name?: string;
  amount: number;
  is_settled: boolean;
}

export interface CoupleTransaction {
  id: string;
  couple_id: string;
  category_id: string;
  amount: number;
  description: string;
  transaction_date: string;
  paid_by_user_id: string;
  user1_share_pct: number;
  user2_share_pct: number;
  status: 'pending' | 'settled';
}

export interface CoupleTransactionCreate {
  category_id: string;
  credit_card_id?: string | null;
  amount: number;
  payment_method: string;
  description: string;
  user1_share_pct: number;
  user2_share_pct: number;
  transaction_date: string;
  paid_by_user_id: string;
}

export interface Couple {
  id: string;
  user1_id: string;
  user2_id: string;
  name?: string | null;
  status: 'active' | 'inactive';
}

export interface CreditCard {
  id: string;
  user_id: string;
  bank_name: string;
  alias?: string | null;
  last_four: string;
  credit_limit: number;
  cutoff_day: number;
  payment_due_days: number;
  min_payment_pct: number;
  annual_rate_pct: number;
  is_active: boolean;
  currentBalance?: number;
  usagePct?: number;
}

export interface CreditCardCreate {
  bank_name: string;
  alias?: string | null;
  last_four: string;
  credit_limit: number;
  cutoff_day: number;
  payment_due_days: number;
  min_payment_pct: number;
  annual_rate_pct: number;
}

export interface CreditCardUpdate {
  bank_name?: string;
  alias?: string | null;
  last_four?: string;
  credit_limit?: number;
  cutoff_day?: number;
  payment_due_days?: number;
  min_payment_pct?: number;
  annual_rate_pct?: number;
  is_active?: boolean;
}

export interface CardStatement {
  id: string;
  credit_card_id: string;
  cutoff_date: string;
  payment_due_date: string;
  total_balance: number;
  minimum_payment: number;
  status: 'open' | 'closed' | 'paid';
}

export interface InstallmentPlan {
  id: string;
  original_tx_id: string;
  credit_card_id: string;
  total_amount: number;
  total_months: number;
  monthly_amount: number;
  first_charge_date: string;
  status: 'active' | 'completed' | 'cancelled';
  paid_count: number;
  pending_count: number;
}

export interface SavingGoalSummary {
  id: string;
  user_id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  target_amount: number;
  currency: string;
  annual_rate_pct: number;
  compounding_frequency: string;
  target_date?: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_balance: number;
  progress_pct: number;
  remaining?: number | null;
  movement_count?: number | null;
  last_movement_date?: string | null;
}

export interface SavingGoalCreate {
  name: string;
  description?: string | null;
  target_amount: number;
  currency?: string;
  annual_rate_pct?: number;
  compounding_frequency: string;
  target_date?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface SavingGoalUpdate {
  name?: string;
  description?: string | null;
  target_amount?: number;
  currency?: string;
  annual_rate_pct?: number;
  compounding_frequency?: string;
  target_date?: string | null;
  icon?: string | null;
  color?: string | null;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
}

export interface SavingGoal {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  target_amount: number;
  currency: string;
  annual_rate_pct: number;
  compounding_frequency: string;
  target_date?: string | null;
  icon?: string | null;
  color?: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

export interface SavingTransaction {
  id: string;
  saving_goal_id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'interest';
  notes?: string | null;
  transaction_date: string;
}

export interface SavingTransactionCreate {
  amount: number;
  type: 'deposit' | 'withdrawal';
  notes?: string | null;
  transaction_date: string;
}

export interface RecurringPayment {
  id: string;
  user_id: string;
  category_id: string;
  credit_card_id?: string | null;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string | null;
  day_of_period: number;
  reminder_days_before: number;
  is_active: boolean;
}

export interface RecurringPaymentCreate {
  category_id: string;
  credit_card_id?: string | null;
  name: string;
  description?: string | null;
  amount: number;
  currency?: string;
  payment_method: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string | null;
  day_of_period: number;
  reminder_days_before?: number;
}

export interface RecurringPaymentUpdate {
  category_id?: string;
  credit_card_id?: string | null;
  name?: string;
  description?: string | null;
  amount?: number;
  currency?: string;
  payment_method?: string;
  frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date?: string;
  end_date?: string | null;
  day_of_period?: number;
  reminder_days_before?: number;
  is_active?: boolean;
}

export interface Occurrence {
  id: string;
  recurring_payment_id: string;
  scheduled_date: string;
  status: 'pending' | 'paid' | 'failed' | 'skipped';
  amount_override?: number | null;
  actual_transaction_id?: string | null;
  notes?: string | null;
}

export interface OccurrencePayRequest {
  amount_override?: number | null;
  notes?: string | null;
}

export interface UpcomingPayment {
  occurrence_id: string;
  recurring_payment_id: string;
  plan_name: string;
  amount: number;
  scheduled_date: string;
  status: 'pending' | 'paid' | 'failed' | 'skipped';
  category_id?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}
