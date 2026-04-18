import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { CreditCard } from '../../core/models/finance.model';

@Component({
  selector: 'app-credit-cards',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './credit-cards.component.html',
})
export class CreditCardsComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
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

  ngOnInit() {
    this.fetchCards();
  }

  fetchCards() {
    this.isLoading.set(true);
    this.financeService.getCreditCards().subscribe({
      next: (data) => {
        this.cards.set(data);
        const total = data.reduce((acc, curr) => acc + Number(curr.credit_limit), 0);
        this.totalCreditLimit.set(total);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching cards:', err);
        this.isLoading.set(false);
      },
    });
  }

  openAddCardModal() {
    this.modalService.openCardModal();
  }

  editCard(id: string) {
    this.modalService.openCardModal(id);
  }

  /**
   * Retorna un gradiente sutil basado en el nombre del banco
   */
  getBankGradient(bankName: string): string {
    const name = bankName.toLowerCase();
    if (name.includes('bbva')) return 'from-blue-900/40 via-surface-container-low to-black';
    if (name.includes('santander')) return 'from-red-900/30 via-surface-container-low to-black';
    if (name.includes('citibanamex') || name.includes('banamex')) return 'from-blue-700/30 via-surface-container-low to-black';
    if (name.includes('amex') || name.includes('american')) return 'from-cyan-900/30 via-surface-container-low to-black';
    if (name.includes('nu') || name.includes('nubank')) return 'from-purple-900/30 via-surface-container-low to-black';
    if (name.includes('hsbc')) return 'from-red-800/20 via-surface-container-low to-black';
    
    // Default Obsidian Gradient
    return 'from-primary/20 via-surface-container-low to-black';
  }
}
