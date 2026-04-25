import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { FinanceService } from '../../services/finance.service';
import { RefreshService } from '../../services/refresh.service';
import { AlertService } from '../../services/alert.service';
import { SavingTransaction } from '../../models/finance.model';

@Component({
  selector: 'app-saving-tx-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, ReactiveFormsModule],
  template: `
    @if (modalService.isSavingTxModalOpen()) {
      @let goal = modalService.selectedSavingGoalForTx()!;
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" (click)="close()">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-md bg-[#1C1B1B] border border-[#3B4949]/30 rounded-2xl shadow-2xl p-8 z-10" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center"
                   [style.backgroundColor]="(goal.color || '#47EAED') + '20'"
                   [style.borderColor]="goal.color || '#47EAED'"
                   style="border-width: 1px;">
                <span class="material-symbols-outlined text-[20px]" [style.color]="goal.color || '#47EAED'">savings</span>
              </div>
              <div>
                <h2 class="text-lg font-headline font-bold tracking-tighter text-on-surface">{{ goal.name }}</h2>
                <p class="text-[10px] font-label text-primary tracking-widest uppercase">Balance: {{ goal.balance | currency:'MXN' }}</p>
              </div>
            </div>
            <button (click)="close()" class="text-on-surface-variant hover:text-error transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Transaction Type Toggle -->
          <div class="flex rounded-xl overflow-hidden border border-outline-variant/20 mb-6">
            <button type="button" (click)="setType('deposit')"
              class="flex-1 py-3 text-xs font-label font-bold tracking-widest uppercase transition-all"
              [class]="txForm.value.type === 'deposit'
                ? 'bg-primary text-on-primary'
                : 'bg-transparent text-on-surface-variant hover:bg-surface-container'">
              <span class="material-symbols-outlined text-sm align-middle mr-1">add_circle</span>Depósito
            </button>
            <button type="button" (click)="setType('withdrawal')"
              class="flex-1 py-3 text-xs font-label font-bold tracking-widest uppercase transition-all"
              [class]="txForm.value.type === 'withdrawal'
                ? 'bg-error text-on-error'
                : 'bg-transparent text-on-surface-variant hover:bg-surface-container'">
              <span class="material-symbols-outlined text-sm align-middle mr-1">remove_circle</span>Retiro
            </button>
          </div>

          <form [formGroup]="txForm" (ngSubmit)="onSubmit()" class="space-y-4">
            <!-- Amount -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Monto *</label>
              <input formControlName="amount" type="number" step="0.01" min="0.01" placeholder="0.00"
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
              @if (txForm.get('amount')?.invalid && txForm.get('amount')?.touched) {
                <p class="text-error text-[10px]">Ingresa un monto mayor a 0.</p>
              }
            </div>

            <!-- Date -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Fecha *</label>
              <input formControlName="transaction_date" type="date"
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
            </div>

            <!-- Notes -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Notas (Opcional)</label>
              <input formControlName="notes" type="text" placeholder="Descripción del movimiento..."
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
            </div>

            <!-- History -->
            @if (transactions().length > 0) {
              <div class="space-y-2 pt-2">
                <p class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Últimos movimientos</p>
                <div class="max-h-36 overflow-y-auto space-y-1 pr-1">
                  @for (tx of transactions(); track tx.id) {
                    <div class="flex justify-between items-center py-2 border-b border-outline-variant/10 text-xs">
                      <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-base"
                          [class]="tx.type === 'deposit' || tx.type === 'interest' ? 'text-primary' : 'text-error'">
                          {{ tx.type === 'deposit' ? 'add_circle' : tx.type === 'interest' ? 'trending_up' : 'remove_circle' }}
                        </span>
                        <span class="text-on-surface-variant">{{ tx.notes || tx.type }}</span>
                      </div>
                      <span [class]="tx.type === 'withdrawal' ? 'text-error' : 'text-primary'">
                        {{ tx.type === 'withdrawal' ? '-' : '+' }}{{ (tx.amount | currency:'MXN')?.replace('-', '') }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button type="button" (click)="close()"
                class="flex-1 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-label text-xs tracking-widest uppercase hover:bg-surface-container-high transition-colors">
                Cancelar
              </button>
              <button type="submit" [disabled]="isLoading()"
                class="flex-1 py-3 rounded-xl font-label text-xs font-bold tracking-widest uppercase transition-all disabled:opacity-50"
                [class]="txForm.value.type === 'withdrawal'
                  ? 'bg-error text-on-error hover:brightness-110'
                  : 'bg-primary text-on-primary hover:brightness-110 status-glow'">
                {{ isLoading() ? 'Guardando...' : 'Registrar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class SavingTxModalComponent {
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  public txForm!: FormGroup;
  public isLoading = signal(false);
  public transactions = signal<SavingTransaction[]>([]);

  readonly today = new Date().toISOString().split('T')[0];

  constructor() {
    this.txForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      type: ['deposit'],
      transaction_date: [this.today, Validators.required],
      notes: [null],
    });

    // Load transaction history when goal changes
    effect(() => {
      const goal = this.modalService.selectedSavingGoalForTx();
      if (goal) {
        this.loadHistory(goal.id);
        this.txForm.reset({ amount: null, type: 'deposit', transaction_date: this.today, notes: null });
      }
    });
  }

  setType(type: 'deposit' | 'withdrawal') {
    this.txForm.patchValue({ type });
  }

  private loadHistory(goalId: string) {
    this.financeService.getSavingTransactions(goalId).subscribe({
      next: (txs) => this.transactions.set(txs.slice(0, 5)),
      error: () => this.transactions.set([])
    });
  }

  close() { this.modalService.closeSavingTxModal(); }

  onSubmit() {
    if (this.txForm.invalid) { this.txForm.markAllAsTouched(); return; }
    const goal = this.modalService.selectedSavingGoalForTx();
    if (!goal) return;

    this.isLoading.set(true);
    const data = this.txForm.value;

    this.financeService.createSavingTransaction(goal.id, data).subscribe({
      next: () => {
        const type = data.type === 'deposit' ? 'Depósito' : 'Retiro';
        this.alertService.success(`${type} registrado`, `Tu movimiento ha sido aplicado a "${goal.name}".`);
        this.refreshService.triggerRefresh();
        this.isLoading.set(false);
        this.close();
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.detail?.message ?? 'Ocurrió un error al registrar el movimiento.';
        this.alertService.error('No se pudo registrar', msg);
      }
    });
  }
}
