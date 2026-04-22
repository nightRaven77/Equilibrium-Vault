import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ModalService } from '../../../core/services/modal.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { Occurrence, RecurringPayment } from '../../../core/models/finance.model';

@Component({
  selector: 'app-recurring-history-modal',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe
  ],
  templateUrl: './recurring-history-modal.component.html'
})
export class RecurringHistoryModalComponent {
  public modalService = inject(ModalService);
  private recurringService = inject(RecurringService);

  public isOpen = this.modalService.isRecurringHistoryModalOpen;
  private planId = this.modalService.selectedHistoryPlanId;

  public occurrences = signal<Occurrence[]>([]);
  public currentPlan = signal<RecurringPayment | null>(null);
  public isLoading = signal<boolean>(false);

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const id = this.planId();

      if (open && id) {
        this.loadHistory(id);
      } else {
        this.occurrences.set([]);
        this.currentPlan.set(null);
      }
    });
  }

  loadHistory(id: string) {
    this.isLoading.set(true);
    
    // We need the plan details for the header, so we can fetch it from the active plans list
    // or just rely on the occurrences. But let's fetch the occurrences first.
    this.recurringService.getOccurrences(id).subscribe({
      next: (data) => {
        // Sort by scheduled date descending (newest first)
        const sorted = data.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
        this.occurrences.set(sorted);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading history', err);
        this.isLoading.set(false);
      }
    });

    // We can also fetch the plan details if we want, but let's assume the user knows which plan they clicked.
    // We can extract plan info from the parent component or fetch it here.
    // For now, let's just use the occurrences. We can get the plan name from the active plans list in the service
    // if we had a state management, but let's fetch the plan details to be safe and show it in the header.
    this.recurringService.getRecurringPayments().subscribe({
        next: (plans) => {
            const plan = plans.find(p => p.id === id);
            if (plan) {
                this.currentPlan.set(plan);
            }
        }
    });
  }

  close() {
    this.modalService.closeRecurringHistoryModal();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'pending': return 'text-tertiary bg-tertiary/10 border-tertiary/20';
      case 'failed': return 'text-error bg-error/10 border-error/20';
      case 'skipped': return 'text-on-surface-variant bg-surface-container-high border-white/5';
      default: return 'text-on-surface-variant bg-surface-container border-white/5';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
      case 'skipped': return 'Omitido';
      default: return status;
    }
  }
}
