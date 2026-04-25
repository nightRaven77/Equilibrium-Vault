import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Transaction,
  MonthlySummary,
  CoupleBalance,
  CoupleTransaction,
  Couple,
  CreditCard,
  SavingGoalSummary,
  SavingGoal,
  SavingGoalCreate,
  SavingGoalUpdate,
  SavingTransaction,
  SavingTransactionCreate,
  Category,
  TransactionCreate,
  CoupleTransactionCreate,
  CreditCardCreate,
  CreditCardUpdate,
  CardStatement,
  InstallmentPlan,
} from '../models/finance.model';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Obtiene los vínculos de pareja del usuario
   */
  getCouples(): Observable<Couple[]> {
    return this.http.get<Couple[]>(`${this.apiUrl}/couples/`);
  }

  /**
   * Obtiene la lista de transacciones personales
   * Crea un objeto de tipo Transaction(desde models/finance.model.ts) y regresa un array
   * de transacciones
   */
  getPersonalTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/personal/`);
  }

  /**
   * Obtiene el resumen mensual personal agrupado
   */
  getMonthlySummary(): Observable<MonthlySummary[]> {
    return this.http.get<MonthlySummary[]>(`${this.apiUrl}/personal/summary`);
  }

  /**
   * Obtiene el balance (quién le debe a quién) de una pareja por su ID
   */
  getCoupleBalance(coupleId: string): Observable<CoupleBalance> {
    return this.http.get<CoupleBalance>(`${this.apiUrl}/couples/${coupleId}/balance`);
  }

  /**
   * Obtiene las transacciones conjuntas de la pareja
   */
  getCoupleTransactions(coupleId: string): Observable<CoupleTransaction[]> {
    return this.http.get<CoupleTransaction[]>(`${this.apiUrl}/couples/${coupleId}/transactions`);
  }

  /**
   * Obtiene las tarjetas de crédito individuales activas
   */
  getCreditCards(): Observable<CreditCard[]> {
    return this.http.get<CreditCard[]>(`${this.apiUrl}/cards/`);
  }

  /**
   * Crea una nueva tarjeta de crédito
   */
  createCreditCard(card: CreditCardCreate): Observable<CreditCard> {
    return this.http.post<CreditCard>(`${this.apiUrl}/cards/`, card);
  }

  /**
   * Actualiza los datos de una tarjeta existente
   */
  updateCreditCard(id: string, card: CreditCardUpdate): Observable<CreditCard> {
    return this.http.patch<CreditCard>(`${this.apiUrl}/cards/${id}`, card);
  }

  /**
   * Elimina (soft-delete) una tarjeta de crédito
   */
  deleteCreditCard(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cards/${id}`, { responseType: 'text' as 'json' });
  }

  /**
   * Obtiene los estados de cuenta (historial) de una tarjeta
   */
  getCardStatements(cardId: string): Observable<CardStatement[]> {
    return this.http.get<CardStatement[]>(`${this.apiUrl}/cards/${cardId}/statements`);
  }

  /** Obtiene las metas de ahorro con sumario de progreso */
  getSavings(): Observable<SavingGoalSummary[]> {
    return this.http.get<SavingGoalSummary[]>(`${this.apiUrl}/savings/`);
  }

  /** Crea una nueva meta de ahorro */
  createSavingGoal(data: SavingGoalCreate): Observable<SavingGoal> {
    return this.http.post<SavingGoal>(`${this.apiUrl}/savings/`, data);
  }

  /** Actualiza una meta de ahorro */
  updateSavingGoal(id: string, data: SavingGoalUpdate): Observable<SavingGoal> {
    return this.http.patch<SavingGoal>(`${this.apiUrl}/savings/${id}`, data);
  }

  /** Cancela (soft-delete) una meta de ahorro */
  cancelSavingGoal(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/savings/${id}`, { responseType: 'text' });
  }

  /** Obtiene los movimientos de una meta */
  getSavingTransactions(goalId: string): Observable<SavingTransaction[]> {
    return this.http.get<SavingTransaction[]>(`${this.apiUrl}/savings/${goalId}/transactions`);
  }

  /** Registra un depósito o retiro */
  createSavingTransaction(goalId: string, data: SavingTransactionCreate): Observable<SavingTransaction> {
    return this.http.post<SavingTransaction>(`${this.apiUrl}/savings/${goalId}/transactions`, data);
  }

  /**
   * Obtiene las categorías del usuario
   */
  getCategories(categoryType: string): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories/${categoryType}`);
  }

  /**
   * Crea una transacción personal
   */
  createTransaction(data: TransactionCreate): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/personal/`, data);
  }

  /**
   * Crea una transacción compartida para una pareja
   */
  createCoupleTransaction(
    coupleId: string,
    data: CoupleTransactionCreate,
  ): Observable<CoupleTransaction> {
    return this.http.post<CoupleTransaction>(
      `${this.apiUrl}/couples/${coupleId}/transactions`,
      data,
    );
  }

  /**
   * Obtiene todos los planes de MSI del usuario
   */
  getInstallmentPlans(): Observable<InstallmentPlan[]> {
    return this.http.get<InstallmentPlan[]>(`${this.apiUrl}/personal/installments`);
  }

  /**
   * Cancela un plan de MSI
   */
  cancelInstallmentPlan(planId: string): Observable<InstallmentPlan> {
    return this.http.patch<InstallmentPlan>(
      `${this.apiUrl}/personal/installments/${planId}/cancel`,
      {},
    );
  }
}
