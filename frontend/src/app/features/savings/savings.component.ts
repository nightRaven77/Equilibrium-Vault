import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { AlertService } from '../../core/services/alert.service';
import { SavingGoalSummary } from '../../core/models/finance.model';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './savings.component.html',
})
export class SavingsComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchSavings();
      }
    });
  }

  public savings = signal<SavingGoalSummary[]>([]);
  public isLoading = signal<boolean>(true);

  // Totales globales
  public totalSaved = computed(() =>
    this.savings().filter(g => g.status !== 'cancelled').reduce((acc, curr) => acc + Number(curr.current_balance), 0),
  );

  public totalTarget = computed(() =>
    this.savings().filter(g => g.status !== 'cancelled').reduce((acc, curr) => acc + Number(curr.target_amount), 0),
  );

  public overallProgress = computed(() => {
    const target = this.totalTarget();
    if (target === 0) return 0;
    return (this.totalSaved() / target) * 100;
  });

  public activeGoals = computed(() => this.savings().filter(g => g.status === 'active' || g.status === 'paused'));

  ngOnInit() {
    this.fetchSavings();
  }

  fetchSavings() {
    this.isLoading.set(true);
    this.financeService.getSavings().subscribe({
      next: (data) => {
        this.savings.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching savings:', err);
        this.isLoading.set(false);
      },
    });
  }

  openNewGoalModal() {
    this.modalService.openSavingGoalModal();
  }

  editGoal(goalId: string) {
    this.modalService.openSavingGoalModal(goalId);
  }

  openTxModal(goal: SavingGoalSummary) {
    this.modalService.openSavingTxModal({
      id: goal.id,
      name: goal.name,
      color: goal.color,
      balance: Number(goal.current_balance),
    });
  }

  cancelGoal(goal: SavingGoalSummary) {
    const hasFunds = Number(goal.current_balance) > 0;
    const msg = hasFunds
      ? `Esta meta tiene $${Number(goal.current_balance).toLocaleString('es-MX', { minimumFractionDigits: 2 })} de balance. Retira los fondos antes de cancelarla.`
      : `¿Seguro que deseas cancelar "${goal.name}"? Esta acción no se puede deshacer.`;

    if (hasFunds) {
      this.alertService.error('No se puede cancelar', msg);
      return;
    }

    this.alertService.confirm('¿Cancelar meta?', msg, 'Sí, cancelar').then(result => {
      if (!result.isConfirmed) return;
      this.financeService.cancelSavingGoal(goal.id).subscribe({
        next: () => {
          this.alertService.success('Meta cancelada', `"${goal.name}" ha sido cancelada.`);
          this.refreshService.triggerRefresh();
        },
        error: (err) => {
          const errMsg = err.error?.detail?.message ?? 'Ocurrió un error al cancelar la meta.';
          this.alertService.error('No se pudo cancelar', errMsg);
        }
      });
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'text-primary';
      case 'paused': return 'text-[#ffb876]';
      case 'completed': return 'text-[#34d399]';
      case 'cancelled': return 'text-error';
      default: return 'text-on-surface-variant';
    }
  }

  /** Fondo con gradiente sutil usando el color de la meta */
  getCardStyle(color: string | null | undefined): object {
    const c = color || '#47EAED';
    return {
      'background': `linear-gradient(135deg, ${c}0D 0%, transparent 60%)`,
      'border-left': `2px solid ${c}60`,
      'transition': 'box-shadow 0.3s ease, border-color 0.3s ease',
    };
  }

  /** Glow de hover con el color de la meta */
  getGlowStyle(color: string | null | undefined): string {
    const c = color || '#47EAED';
    return `0 0 24px ${c}30, 0 4px 16px rgba(0,0,0,0.2)`;
  }

  /** Color del texto del porcentaje */
  getAccentColor(color: string | null | undefined): string {
    return color || '#47EAED';
  }

  /** Gauge color del panel derecho: usa el color de la meta con más saldo */
  getTopGoalColor(): string {
    const top = this.activeGoals().slice().sort((a, b) => b.current_balance - a.current_balance)[0];
    return top?.color || '#47EAED';
  }
}
