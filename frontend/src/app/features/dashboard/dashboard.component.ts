import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { Transaction, SavingGoalSummary } from '../../core/models/finance.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);

  constructor() {
    // Reacciona a cambios globales en los datos
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchDashboardData();
      }
    });
  }

  // Signals para enlace de datos con HTML
  public netWorth = signal<number>(0);
  public transactions = signal<Transaction[]>([]);
  public savings = signal<SavingGoalSummary[]>([]);
  public isLoading = signal<boolean>(true);

  ngOnInit() {
    this.fetchDashboardData();
  }

  fetchDashboardData() {
    this.financeService.getPersonalTransactions().subscribe({
      next: (data) => {
        this.transactions.set(data);
        // Balance ficticio calculado en el frontend basado en transacciones
        // Si es income suma, si es expense resta
        //curr es current y acc es acumulado
        const total = data.reduce((acc, curr) => {
          return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
        }, 0);
        this.netWorth.set(total);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando la vista de dashboard', err);
        this.isLoading.set(false);
      },
    });

    // Pedimos las metas de ahorro
    this.financeService.getSavings().subscribe({
      next: (data) => {
        this.savings.set(data);
      },
      error: (err) => {
        console.error('Error cargando los ahorros', err);
      },
    });
  }
}
