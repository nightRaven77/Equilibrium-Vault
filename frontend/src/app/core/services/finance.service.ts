import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Transaction,
  MonthlySummary,
  CoupleBalance,
  CoupleTransaction,
  CreditCard,
} from '../models/finance.model';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

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
}
