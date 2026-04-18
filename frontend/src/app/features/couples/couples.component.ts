import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { Couple, CoupleBalance, CoupleTransaction } from '../../core/models/finance.model';

@Component({
  selector: 'app-couples',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './couples.component.html',
})
export class CouplesComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);

  public couple = signal<Couple | null>(null);
  public transactions = signal<CoupleTransaction[]>([]);
  public balance = signal<CoupleBalance | null>(null);
  public isLoading = signal<boolean>(true);

  public pendingTransactions = computed(() =>
    this.transactions().filter((t) => t.status === 'pending'),
  );

  public settledTransactions = computed(() =>
    this.transactions().filter((t) => t.status === 'settled'),
  );

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchCoupleData();
      }
    });
  }

  ngOnInit() {
    this.fetchCoupleData();
  }

  fetchCoupleData() {
    this.isLoading.set(true);
    this.financeService.getCouples().subscribe({
      next: (couples) => {
        if (couples && couples.length > 0) {
          const activeCouple = couples[0]; // Tomamos la primera por ahora
          this.couple.set(activeCouple);
          this.loadTransactionsAndBalance(activeCouple.id);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('Error fetching couples:', err);
        this.isLoading.set(false);
      },
    });
  }

  loadTransactionsAndBalance(coupleId: string) {
    // Cargar balance y transacciones en paralelo
    this.financeService.getCoupleBalance(coupleId).subscribe({
      next: (balance) => this.balance.set(balance),
      error: (err) => console.error('Error fetching balance:', err),
    });

    this.financeService.getCoupleTransactions(coupleId).subscribe({
      next: (transactions) => {
        this.transactions.set(transactions);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching transactions:', err);
        this.isLoading.set(false);
      },
    });
  }
}
