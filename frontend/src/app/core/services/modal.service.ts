import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  // Signal para controlar la visibilidad del modal global de transacciones
  private _isTransactionModalOpen = signal<boolean>(false);
  
  // Exponemos el signal como readonly para que solo se pueda cambiar vía métodos
  public isTransactionModalOpen = this._isTransactionModalOpen.asReadonly();

  openTransactionModal() {
    this._isTransactionModalOpen.set(true);
  }

  closeTransactionModal() {
    this._isTransactionModalOpen.set(false);
  }

  toggleTransactionModal() {
    this._isTransactionModalOpen.update(open => !open);
  }

  // --- Card Modal ---
  private _isCardModalOpen = signal<boolean>(false);
  private _selectedCardId = signal<string | null>(null);

  public isCardModalOpen = this._isCardModalOpen.asReadonly();
  public selectedCardId = this._selectedCardId.asReadonly();

  openCardModal(cardId: string | null = null) {
    this._selectedCardId.set(cardId);
    this._isCardModalOpen.set(true);
  }

  closeCardModal() {
    this._isCardModalOpen.set(false);
    this._selectedCardId.set(null);
  }

  // --- Recurring Plan Modal ---
  private _isRecurringPlanModalOpen = signal<boolean>(false);
  private _selectedRecurringPlanId = signal<string | null>(null);

  public isRecurringPlanModalOpen = this._isRecurringPlanModalOpen.asReadonly();
  public selectedRecurringPlanId = this._selectedRecurringPlanId.asReadonly();

  openRecurringPlanModal(planId: string | null = null) {
    this._selectedRecurringPlanId.set(planId);
    this._isRecurringPlanModalOpen.set(true);
  }

  closeRecurringPlanModal() {
    this._isRecurringPlanModalOpen.set(false);
    this._selectedRecurringPlanId.set(null);
  }

  // --- Occurrence Pay Modal ---
  private _isOccurrencePayModalOpen = signal<boolean>(false);
  private _selectedOccurrenceId = signal<string | null>(null);

  public isOccurrencePayModalOpen = this._isOccurrencePayModalOpen.asReadonly();
  public selectedOccurrenceId = this._selectedOccurrenceId.asReadonly();

  openOccurrencePayModal(occurrenceId: string) {
    this._selectedOccurrenceId.set(occurrenceId);
    this._isOccurrencePayModalOpen.set(true);
  }

  closeOccurrencePayModal() {
    this._isOccurrencePayModalOpen.set(false);
    this._selectedOccurrenceId.set(null);
  }
}
