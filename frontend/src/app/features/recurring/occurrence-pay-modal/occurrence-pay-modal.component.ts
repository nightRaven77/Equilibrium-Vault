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
  private occurrenceId = this.modalService.selectedOccurrenceId;

  public isSaving = signal<boolean>(false);

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

  onSubmit() {
    const id = this.occurrenceId();
    if (!id || this.payForm.invalid) return;

    this.isSaving.set(true);
    const formValue = this.payForm.value;

    const req = {
      amount_override: formValue.amount_override ? Number(formValue.amount_override) : null,
      notes: formValue.notes || null
    };

    this.recurringService.payOccurrence(id, req).subscribe({
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
