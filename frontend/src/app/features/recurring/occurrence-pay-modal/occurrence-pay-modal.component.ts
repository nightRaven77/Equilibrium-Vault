import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ModalService } from '../../../core/services/modal.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { RefreshService } from '../../../core/services/refresh.service';

@Component({
  selector: 'app-occurrence-pay-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './occurrence-pay-modal.component.html'
})
export class OccurrencePayModalComponent {
  public modalService = inject(ModalService);
  private fb = inject(FormBuilder);
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);

  public isOpen = this.modalService.isOccurrencePayModalOpen;
  public payment = this.modalService.selectedUpcomingPayment;

  public isSaving = signal<boolean>(false);

  // Brand logos mapping (same as in dashboard for consistency)
  private readonly brandLogos: Record<string, string> = {
    netflix: 'netflix', spotify: 'spotify', apple: 'apple', amazon: 'amazon',
    youtube: 'youtube', disney: 'disney', hbo: 'hbo', xbox: 'xbox',
    playstation: 'playstation', nintendo: 'nintendo', crunchyroll: 'crunchyroll',
    claude: 'claude', copilot: 'githubcopilot', google: 'googlegemini',
  };

  public payForm = this.fb.group({
    amount_override: [''],
    notes: ['']
  });

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (open) {
        this.payForm.reset();
      }
    });
  }

  close() {
    this.modalService.closeOccurrencePayModal();
  }

  getBrandLogo(name: string): string | null {
    if (!name) return null;
    const lowerName = name.toLowerCase();
    for (const key in this.brandLogos) {
      if (lowerName.includes(key)) return key;
    }
    return null;
  }

  onSubmit() {
    const paymentData = this.payment();
    if (!paymentData || this.payForm.invalid) return;

    this.isSaving.set(true);
    const formValue = this.payForm.value;

    const req = {
      amount_override: formValue.amount_override ? Number(formValue.amount_override) : null,
      notes: formValue.notes || null
    };

    this.recurringService.payOccurrence(paymentData.occurrence_id, req).subscribe({
      next: () => {
        this.refreshService.triggerRefresh();
        this.isSaving.set(false);
        this.close();
      },
      error: (err) => {
        console.error('Error pagando ocurrencia', err);
        this.isSaving.set(false);
      }
    });
  }
}
