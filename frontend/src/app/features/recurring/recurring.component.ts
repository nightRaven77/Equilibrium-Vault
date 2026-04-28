import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RecurringService } from '../../core/services/recurring.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { AlertService } from '../../core/services/alert.service';
import { RecurringPayment, UpcomingPayment } from '../../core/models/finance.model';
import { RecurringPlanModalComponent } from './recurring-plan-modal/recurring-plan-modal.component';
import { OccurrencePayModalComponent } from './occurrence-pay-modal/occurrence-pay-modal.component';
import { RecurringHistoryModalComponent } from './recurring-history-modal/recurring-history-modal.component';

@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe,
    RecurringPlanModalComponent,
    OccurrencePayModalComponent,
    RecurringHistoryModalComponent,
  ],
  templateUrl: './recurring.component.html',
})
export class RecurringComponent implements OnInit {
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  public activePlans = signal<RecurringPayment[]>([]);
  public upcomingPayments = signal<UpcomingPayment[]>([]);
  public isLoading = signal<boolean>(true);

  /** Suma mensual normalizada de todos los planes activos */
  public monthlyTotal = computed(() => {
    const multiplier: Record<string, number> = {
      daily: 30, weekly: 4.33, biweekly: 2.17,
      monthly: 1, quarterly: 1 / 3, yearly: 1 / 12,
    };
    return this.activePlans().reduce((sum, p) => {
      return sum + (p.amount * (multiplier[p.frequency] ?? 1));
    }, 0);
  });

  /** Monto total de pagos urgentes (próximos 7 días) */
  public urgentTotal = computed(() =>
    this.upcomingPayments()
      .filter(p => this.daysUntil(p.scheduled_date) <= 7 && p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0)
  );

  /** Contadores para KPIs */
  public pendingCount = computed(() =>
    this.upcomingPayments().filter(p => p.status === 'pending').length
  );

  private readonly brandLogos: Record<string, string> = {
    netflix: 'netflix', spotify: 'spotify', apple: 'apple', amazon: 'amazon',
    youtube: 'youtube', disney: 'disney', hbo: 'hbo', max: 'max',
    xbox: 'xbox', playstation: 'playstation', nintendo: 'nintendo',
    crunchyroll: 'crunchyroll', claude: 'anthropic', copilot: 'githubcopilot',
    google: 'googlegemini', openai: 'openai', chatgpt: 'openai',
    github: 'github', notion: 'notion', figma: 'figma', slack: 'slack',
    dropbox: 'dropbox', onedrive: 'microsoftonedrive',
  };

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) this.loadData();
    });
  }

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.isLoading.set(true);
    let done = 0;
    const check = () => { if (++done === 2) this.isLoading.set(false); };

    this.recurringService.getRecurringPayments().subscribe({
      next: (plans) => { this.activePlans.set(plans); check(); },
      error: () => check(),
    });

    this.recurringService.getUpcomingPayments().subscribe({
      next: (up) => { this.upcomingPayments.set(up); check(); },
      error: () => check(),
    });
  }

  openAddPlanModal(): void { this.modalService.openRecurringPlanModal(); }
  editPlan(id: string): void { this.modalService.openRecurringPlanModal(id); }
  openHistoryModal(id: string): void { this.modalService.openRecurringHistoryModal(id); }
  payOccurrence(payment: UpcomingPayment): void { this.modalService.openOccurrencePayModal(payment); }

  skipOccurrence(payment: UpcomingPayment): void {
    this.alertService.confirm(
      '¿Omitir este pago?',
      `Se marcará "${payment.plan_name}" como omitido para esta fecha. No se creará ninguna transacción.`,
    ).then(confirmed => {
      if (!confirmed) return;
      this.recurringService.skipOccurrence(payment.occurrence_id).subscribe({
        next: () => {
          this.alertService.success('Omitido', 'El pago fue marcado como omitido.');
          this.refreshService.triggerRefresh();
        },
        error: (err) => {
          const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al omitir.';
          this.alertService.error('Error', msg);
        },
      });
    });
  }

  deletePlan(plan: RecurringPayment): void {
    this.alertService.confirm(
      `¿Eliminar "${plan.name}"?`,
      'La suscripción se desactivará. El historial de pagos se conservará.',
    ).then(confirmed => {
      if (!confirmed) return;
      this.recurringService.deleteRecurringPayment(plan.id).subscribe({
        next: () => {
          this.alertService.success('Eliminada', `"${plan.name}" fue eliminada.`);
          this.refreshService.triggerRefresh();
        },
        error: (err) => {
          const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al eliminar.';
          this.alertService.error('Error', msg);
        },
      });
    });
  }

  getBrandLogo(name: string): string | null {
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const key in this.brandLogos) {
      if (lower.includes(key)) return this.brandLogos[key];
    }
    return null;
  }

  /** Días hasta una fecha futura (negativo = vencida) */
  daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.ceil(diff / 86_400_000);
  }

  urgencyClass(dateStr: string): string {
    const d = this.daysUntil(dateStr);
    if (d < 0) return 'text-error';
    if (d <= 3) return 'text-[#ffb876]';
    if (d <= 7) return 'text-primary';
    return 'text-on-surface-variant';
  }

  urgencyLabel(dateStr: string): string {
    const d = this.daysUntil(dateStr);
    if (d < 0) return `Vencido hace ${Math.abs(d)}d`;
    if (d === 0) return '¡Hoy!';
    if (d === 1) return 'Mañana';
    return `En ${d} días`;
  }

  frequencyLabel(f: string): string {
    const map: Record<string, string> = {
      daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
      monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual',
    };
    return map[f] ?? f;
  }
}
