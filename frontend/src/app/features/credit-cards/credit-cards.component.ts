import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../core/services/finance.service';
import { CreditCard } from '../../core/models/finance.model';

@Component({
  selector: 'app-credit-cards',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './credit-cards.component.html'
})
export class CreditCardsComponent implements OnInit {
  private financeService = inject(FinanceService);

  public cards = signal<CreditCard[]>([]);
  public isLoading = signal<boolean>(true);

  // Calcula la suma total de límites de crédito
  public totalCreditLimit = signal<number>(0);

  ngOnInit() {
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
      }
    });
  }
}
