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
  year_month: string;
  category_id: string;
  category_name: string;
  type: 'income' | 'expense';
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
  target_date?: string | null;
  status: 'active' | 'paused' | 'completed';
  current_balance: number;
  progress_pct: number;
  remaining?: number | null;
  movement_count?: number | null;
  last_movement_date?: string | null;
}
