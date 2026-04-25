import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
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
    this._isTransactionModalOpen.update((open) => !open);
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

  // --- Confirm Delete Modal ---
  private _isConfirmDeleteModalOpen = signal<boolean>(false);
  private _confirmDeleteAction = signal<(() => void) | null>(null);

  public isConfirmDeleteModalOpen = this._isConfirmDeleteModalOpen.asReadonly();
  public confirmDeleteAction = this._confirmDeleteAction.asReadonly();

  openConfirmDeleteModal(action: () => void) {
    this._confirmDeleteAction.set(action);
    this._isConfirmDeleteModalOpen.set(true);
  }

  closeConfirmDeleteModal() {
    this._isConfirmDeleteModalOpen.set(false);
    this._confirmDeleteAction.set(null);
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
  private _selectedUpcomingPayment = signal<any | null>(null);

  public isOccurrencePayModalOpen = this._isOccurrencePayModalOpen.asReadonly();
  public selectedUpcomingPayment = this._selectedUpcomingPayment.asReadonly();

  openOccurrencePayModal(payment: any) {
    this._selectedUpcomingPayment.set(payment);
    this._isOccurrencePayModalOpen.set(true);
  }

  closeOccurrencePayModal() {
    this._isOccurrencePayModalOpen.set(false);
    this._selectedUpcomingPayment.set(null);
  }

  // --- Recurring History Modal ---
  private _isRecurringHistoryModalOpen = signal<boolean>(false);
  private _selectedHistoryPlanId = signal<string | null>(null);

  public isRecurringHistoryModalOpen = this._isRecurringHistoryModalOpen.asReadonly();
  public selectedHistoryPlanId = this._selectedHistoryPlanId.asReadonly();

  openRecurringHistoryModal(planId: string) {
    this._selectedHistoryPlanId.set(planId);
    this._isRecurringHistoryModalOpen.set(true);
  }

  closeRecurringHistoryModal() {
    this._isRecurringHistoryModalOpen.set(false);
    this._selectedHistoryPlanId.set(null);
  }

  // --- Saving Goal Modal ---
  private _isSavingGoalModalOpen = signal<boolean>(false);
  private _selectedSavingGoalId = signal<string | null>(null);

  public isSavingGoalModalOpen = this._isSavingGoalModalOpen.asReadonly();
  public selectedSavingGoalId = this._selectedSavingGoalId.asReadonly();

  openSavingGoalModal(goalId: string | null = null) {
    this._selectedSavingGoalId.set(goalId);
    this._isSavingGoalModalOpen.set(true);
  }

  closeSavingGoalModal() {
    this._isSavingGoalModalOpen.set(false);
    this._selectedSavingGoalId.set(null);
  }

  // --- Saving Transaction Modal ---
  private _isSavingTxModalOpen = signal<boolean>(false);
  private _selectedSavingGoalForTx = signal<{ id: string; name: string; color?: string | null; balance: number } | null>(null);

  public isSavingTxModalOpen = this._isSavingTxModalOpen.asReadonly();
  public selectedSavingGoalForTx = this._selectedSavingGoalForTx.asReadonly();

  openSavingTxModal(goal: { id: string; name: string; color?: string | null; balance: number }) {
    this._selectedSavingGoalForTx.set(goal);
    this._isSavingTxModalOpen.set(true);
  }

  closeSavingTxModal() {
    this._isSavingTxModalOpen.set(false);
    this._selectedSavingGoalForTx.set(null);
  }
}
