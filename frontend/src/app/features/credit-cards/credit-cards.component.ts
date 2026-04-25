import { Component, inject, OnInit, signal, effect } from '@angular/core';
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
          if (err.status === 400 && err.error && err.error.detail) {
            const code = err.error.detail.code;
            const message = err.error.detail.message;

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
              this.alertService.error('No se puede eliminar', message);
            }
          } else if (err.status === 404 || err.status === 204 || err.status === 200) {
            this.alertService.success(
              '¡Tarjeta eliminada!',
              'La tarjeta ha sido desactivada correctamente.',
            );
            this.refreshService.triggerRefresh();
          } else {
            this.alertService.error(
              'Error inesperado',
              'Ocurrió un error al intentar eliminar la tarjeta.',
            );
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
