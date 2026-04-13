import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FinanceService } from '../../core/services/finance.service';
import { Transaction } from '../../core/models/finance.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private financeService = inject(FinanceService);
  private router = inject(Router);

  // Signals para enlace de datos con HTML
  public netWorth = signal<number>(0);
  public transactions = signal<Transaction[]>([]);
  public isLoading = signal<boolean>(true);

  ngOnInit() {
    this.fetchDashboardData();
  }

  fetchDashboardData() {
    // Pedimos las transacciones personales
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
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
