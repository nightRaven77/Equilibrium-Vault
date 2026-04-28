import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RecurringPayment,
  RecurringPaymentCreate,
  RecurringPaymentUpdate,
  Occurrence,
  OccurrencePayRequest,
  UpcomingPayment,
} from '../models/finance.model';

@Injectable({ providedIn: 'root' })
export class RecurringService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/recurring`;

  getRecurringPayments(activeOnly = true): Observable<RecurringPayment[]> {
    return this.http.get<RecurringPayment[]>(`${this.base}?active_only=${activeOnly}`);
  }

  getUpcomingPayments(): Observable<UpcomingPayment[]> {
    return this.http.get<UpcomingPayment[]>(`${this.base}/upcoming`);
  }

  getRecurringPayment(id: string): Observable<RecurringPayment> {
    return this.http.get<RecurringPayment>(`${this.base}/${id}`);
  }

  createRecurringPayment(plan: RecurringPaymentCreate): Observable<RecurringPayment> {
    return this.http.post<RecurringPayment>(this.base, plan);
  }

  updateRecurringPayment(id: string, plan: RecurringPaymentUpdate): Observable<RecurringPayment> {
    return this.http.patch<RecurringPayment>(`${this.base}/${id}`, plan);
  }

  deleteRecurringPayment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  restoreRecurringPayment(id: string): Observable<RecurringPayment> {
    return this.http.post<RecurringPayment>(`${this.base}/${id}/restore`, {});
  }

  getOccurrences(id: string, status?: string): Observable<Occurrence[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<Occurrence[]>(`${this.base}/${id}/occurrences${params}`);
  }

  payOccurrence(occurrenceId: string, req: OccurrencePayRequest): Observable<Occurrence> {
    return this.http.post<Occurrence>(`${this.base}/occurrences/${occurrenceId}/pay`, req);
  }

  skipOccurrence(occurrenceId: string): Observable<Occurrence> {
    return this.http.post<Occurrence>(`${this.base}/occurrences/${occurrenceId}/skip`, {});
  }
}
