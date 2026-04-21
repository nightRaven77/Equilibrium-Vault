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
  UpcomingPayment
} from '../models/finance.model';

@Injectable({
  providedIn: 'root'
})
export class RecurringService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private readonly RECURRING_ENDPOINT = `${this.apiUrl}/recurring`;

  // Obtiene las plantillas activas
  getRecurringPayments(): Observable<RecurringPayment[]> {
    return this.http.get<RecurringPayment[]>(this.RECURRING_ENDPOINT);
  }

  // Obtiene las ocurrencias pendientes próximas (vista global)
  getUpcomingPayments(): Observable<UpcomingPayment[]> {
    return this.http.get<UpcomingPayment[]>(`${this.RECURRING_ENDPOINT}/upcoming`);
  }

  // Crea una nueva plantilla
  createRecurringPayment(plan: RecurringPaymentCreate): Observable<RecurringPayment> {
    return this.http.post<RecurringPayment>(this.RECURRING_ENDPOINT, plan);
  }

  // Actualiza una plantilla existente
  updateRecurringPayment(id: string, plan: RecurringPaymentUpdate): Observable<RecurringPayment> {
    return this.http.patch<RecurringPayment>(`${this.RECURRING_ENDPOINT}/${id}`, plan);
  }

  // Soft-delete de una plantilla
  deleteRecurringPayment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.RECURRING_ENDPOINT}/${id}`);
  }

  // Obtiene el historial de ocurrencias de una plantilla específica
  getOccurrences(id: string): Observable<Occurrence[]> {
    return this.http.get<Occurrence[]>(`${this.RECURRING_ENDPOINT}/${id}/occurrences`);
  }

  // Paga una ocurrencia específica
  payOccurrence(occurrenceId: string, req: OccurrencePayRequest): Observable<Occurrence> {
    return this.http.post<Occurrence>(`${this.RECURRING_ENDPOINT}/occurrences/${occurrenceId}/pay`, req);
  }
}

