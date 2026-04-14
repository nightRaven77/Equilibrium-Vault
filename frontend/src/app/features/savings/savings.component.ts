import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../core/services/finance.service';
import { SavingGoalSummary } from '../../core/models/finance.model';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './savings.component.html',
})
export class SavingsComponent implements OnInit {
  private financeService = inject(FinanceService);

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
