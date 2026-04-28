import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ModalService } from '../../../core/services/modal.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { RefreshService } from '../../../core/services/refresh.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-occurrence-pay-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './occurrence-pay-modal.component.html'
})
export class OccurrencePayModalComponent {
  public modalService = inject(ModalService);
  private fb = inject(FormBuilder);
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);

  public isOpen = this.modalService.isOccurrencePayModalOpen;
  public payment = this.modalService.selectedUpcomingPayment;
  public isSaving = signal<boolean>(false);

  private readonly brandLogos: Record<string, string> = {
    netflix: 'netflix', spotify: 'spotify', apple: 'apple', amazon: 'amazon',
    youtube: 'youtube', disney: 'disney', hbo: 'hbo', max: 'max',
    xbox: 'xbox', playstation: 'playstation', nintendo: 'nintendo',
    crunchyroll: 'crunchyroll', claude: 'anthropic', copilot: 'githubcopilot',
    google: 'googlegemini', openai: 'openai',
  };

  public payForm = this.fb.group({
    amount_override: [''],
    notes: [''],
  });

  constructor() {
    effect(() => { if (this.isOpen()) this.payForm.reset(); });
  }

  close() { this.modalService.closeOccurrencePayModal(); }

  getBrandLogo(name: string): string | null {
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const key in this.brandLogos) {
      if (lower.includes(key)) return this.brandLogos[key];
    }
    return null;
  }

  onSubmit() {
    const p = this.payment();
    if (!p) return;
    this.isSaving.set(true);
    const v = this.payForm.value;
    this.recurringService.payOccurrence(p.occurrence_id, {
      amount_override: v.amount_override ? Number(v.amount_override) : null,
      notes: v.notes || null,
    }).subscribe({
      next: () => {
        this.alertService.success('¡Pagado!', `"${p.plan_name}" marcado como pagado.`);
        this.refreshService.triggerRefresh();
        this.isSaving.set(false);
        this.close();
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al registrar el pago.';
        this.alertService.error('No se pudo pagar', msg);
      },
    });
  }

  onSkip() {
    const p = this.payment();
    if (!p) return;
    this.alertService.confirm(
      '¿Omitir este pago?',
      `"${p.plan_name}" se marcará como omitido. No se creará ninguna transacción.`,
    ).then(confirmed => {
      if (!confirmed) return;
      this.isSaving.set(true);
      this.recurringService.skipOccurrence(p.occurrence_id).subscribe({
        next: () => {
          this.alertService.success('Omitido', 'El pago fue marcado como omitido.');
          this.refreshService.triggerRefresh();
          this.isSaving.set(false);
          this.close();
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al omitir.';
          this.alertService.error('Error', msg);
        },
      });
    });
  }
}
