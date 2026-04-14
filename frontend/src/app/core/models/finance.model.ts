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
  date: string;
  paid_by_user_id: string;
  user1_share_pct: number;
  user2_share_pct: number;
  status: 'pending' | 'settled';
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

export interface CardStatement {
  id: string;
  credit_card_id: string;
  cutoff_date: string;
  payment_due_date: string;
  total_balance: number;
  minimum_payment: number;
  status: 'open' | 'closed' | 'paid';
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
