import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
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

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchSavings();
      }
    });
  }

  public savings = signal<SavingGoalSummary[]>([]);
  public isLoading = signal<boolean>(true);

  // Totales
  public totalSaved = computed(() =>
    this.savings().reduce((acc, curr) => acc + Number(curr.current_balance), 0),
  );

  public totalTarget = computed(() =>
    this.savings().reduce((acc, curr) => acc + Number(curr.target_amount), 0),
  );

  public overallProgress = computed(() => {
    const target = this.totalTarget();
    if (target === 0) return 0;
    return (this.totalSaved() / target) * 100;
  });

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
}
