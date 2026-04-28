import { Component, inject, OnInit, signal, effect, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { CreditCard } from '../../core/models/finance.model';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { Router } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-credit-cards',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NgxEchartsDirective],
  templateUrl: './credit-cards.component.html',
})
export class CreditCardsComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchCards();
      }
    });
  }

  public cards = signal<CreditCard[]>([]);
  public isLoading = signal<boolean>(true);

  // Calcula la suma total de límites de crédito
  public totalCreditLimit = signal<number>(0);
  public totalBalance = signal<number>(0);
  public utilizationOptions = signal<EChartsOption>({});

  public creditUtilizationPct = computed(() => {
    const limit = this.totalCreditLimit();
    const balance = this.totalBalance();
    return limit > 0 ? (balance / limit) * 100 : 0;
  });

  public integrityInsights = computed(() => {
    const pct = this.creditUtilizationPct();
    if (this.cards().length === 0) {
      return {
        message: "No financial nodes detected. Provision a credit node to begin integrity monitoring.",
        health: "Offline",
        risk: "N/A",
        healthClass: "text-on-surface-variant/40",
        riskClass: "text-on-surface-variant/40"
      };
    }
    if (pct === 0) {
      return {
        message: "Your financial nodes are dormant. Strategic credit usage can improve your credit profile over time.",
        health: "Stable",
        risk: "Null",
        healthClass: "text-primary",
        riskClass: "text-primary"
      };
    } else if (pct < 30) {
      return {
        message: `Your financial node is operating at ${ (100 - pct).toFixed(0) }% efficiency. Credit utilization remains below optimal threshold.`,
        health: "Excellent",
        risk: "Minimum",
        healthClass: "text-[#47EAED]",
        riskClass: "text-[#47EAED]"
      };
    } else if (pct < 50) {
      return {
        message: "Liquidity architecture is under moderate load. Consider consolidating balances to maintain peak efficiency.",
        health: "Good",
        risk: "Low",
        healthClass: "text-yellow-400",
        riskClass: "text-yellow-400"
      };
    } else if (pct < 75) {
      return {
        message: "System warning: High utilization detected. Risk of credit score impact is increasing. Strategic repayment recommended.",
        health: "Fair",
        risk: "Moderate",
        healthClass: "text-orange-500",
        riskClass: "text-orange-500"
      };
    } else {
      return {
        message: "CRITICAL: Near-maximum capacity reached. Debt-to-limit ratio exceeds safety parameters. Immediate action required.",
        health: "Poor",
        risk: "High",
        healthClass: "text-error",
        riskClass: "text-error"
      };
    }
  });

  ngOnInit() {
    this.fetchCards();
  }

  fetchCards() {
    this.isLoading.set(true);

    forkJoin({
      cards: this.financeService.getCreditCards(),
      transactions: this.financeService.getPersonalTransactions(),
    })
      .pipe(
        map(({ cards, transactions }) => {
          const activeCards = cards.filter((c) => c.is_active);
          const total = activeCards.reduce((acc, curr) => acc + Number(curr.credit_limit), 0);

          const enrichedCards = activeCards.map((card) => {
            // Sum all expenses for this card
            const cardTxs = transactions.filter(
              (t) => t.credit_card_id === card.id && t.type === 'expense',
            );
            const balance = cardTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);

            const limit = Number(card.credit_limit);
            const usagePct = limit > 0 ? (balance / limit) * 100 : 0;

            return { ...card, currentBalance: balance, usagePct };
          });

          const totalBalance = enrichedCards.reduce(
            (sum, card) => sum + (card.currentBalance || 0),
            0,
          );

          return { cards: enrichedCards, totalLimit: total, totalBalance };
        }),
      )
      .subscribe({
        next: (result) => {
          this.cards.set(result.cards);
          this.totalCreditLimit.set(result.totalLimit);
          this.totalBalance.set(result.totalBalance);
          this.setupChart(result.totalBalance, result.totalLimit);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching cards:', err);
          this.isLoading.set(false);
        },
      });
  }

  setupChart(used: number, limit: number) {
    const available = Math.max(0, limit - used);
    const utilizationPct = limit > 0 ? ((used / limit) * 100).toFixed(1) : '0.0';

    this.utilizationOptions.set({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(28, 27, 27, 0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      series: [
        {
          name: 'Credit Usage',
          type: 'pie',
          radius: ['70%', '90%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: '#1C1B1B',
            borderWidth: 2,
          },
          label: { show: false },
          data: [
            { value: used, name: 'Used Credit', itemStyle: { color: '#47EAED' } },
            {
              value: available,
              name: 'Available Credit',
              itemStyle: { color: 'rgba(255,255,255,0.05)' },
            },
          ],
        },
      ],
    });
  }

  openAddCardModal() {
    this.modalService.openCardModal();
  }

  editCard(id: string) {
    this.modalService.openCardModal(id);
  }

  deleteCard(id: string) {
    const confirmDeleteAction = () => {
      this.financeService.deleteCreditCard(id).subscribe({
        next: () => {
          this.alertService.success(
            '¡Tarjeta eliminada!',
            'La tarjeta ha sido desactivada correctamente.',
          );
          this.refreshService.triggerRefresh();
        },
        error: (err) => {
          console.error('Error deleting card:', err);
          
          // Extraemos el detalle del error de forma segura
          const errorDetail = err.error?.detail;
          
          if (err.status === 400 && errorDetail) {
            const code = typeof errorDetail === 'object' ? errorDetail.code : null;
            const message = typeof errorDetail === 'object' ? errorDetail.message : errorDetail;

            if (code === 'HAS_RECURRING') {
              this.alertService
                .decision(
                  'Pagos Recurrentes Activos',
                  message + ' Deberás cambiar el método de pago antes de eliminarla.',
                  'Ir a Pagos Recurrentes',
                  'Cancelar',
                )
                .then((result) => {
                  if (result.isConfirmed) {
                    this.router.navigate(['/recurring']);
                  }
                });
            } else {
              // Maneja HAS_DEBT, HAS_INSTALLMENTS y cualquier otro 400 estructurado
              this.alertService.error('No se puede eliminar', message);
            }
          } else if (err.status === 404) {
            this.alertService.error('Error', 'La tarjeta no fue encontrada.');
          } else {
            // Fallback para errores genéricos o sin detalle estructurado
            const genericMessage = typeof errorDetail === 'string' ? errorDetail : 'Ocurrió un error al intentar eliminar la tarjeta.';
            this.alertService.error('Error inesperado', genericMessage);
          }
        },
      });
    };
    this.modalService.openConfirmDeleteModal(confirmDeleteAction);
  }

  /**
   * Retorna un gradiente sutil basado en el nombre del banco
   */
  getBankGradient(bankName: string): string {
    const name = bankName.toLowerCase();
    if (name.includes('bbva')) return 'from-blue-900/80 via-surface-container-low to-black';
    if (name.includes('santander')) return 'from-red-900/70 via-surface-container-low to-black';
    if (name.includes('citibanamex') || name.includes('banamex'))
      return 'from-blue-700/70 via-surface-container-low to-black';
    if (name.includes('amex') || name.includes('american'))
      return 'from-cyan-900/70 via-surface-container-low to-black';
    if (name.includes('nu') || name.includes('nubank'))
      return 'from-purple-900/70 via-surface-container-low to-black';
    if (name.includes('hsbc')) return 'from-red-800/60 via-surface-container-low to-black';
    if (name.includes('mercado')) return 'from-black-900/60 via-surface-container-low to-black';
    if (name.includes('plata')) return 'from-gray-200/60 via-surface-container-low to-black';

    // Default Obsidian Gradient
    return 'from-primary/40 via-surface-container-low to-black';
  }
}
