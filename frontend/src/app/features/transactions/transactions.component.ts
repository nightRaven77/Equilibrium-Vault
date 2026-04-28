import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { AlertService } from '../../core/services/alert.service';
import { Transaction, Category } from '../../core/models/finance.model';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './transactions.component.html',
})
export class TransactionsComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  public modalService = inject(ModalService);
  private alertService = inject(AlertService);

  public transactions = signal<Transaction[]>([]);
  public categories = signal<Category[]>([]);
  public isLoading = signal<boolean>(true);

  // Filters
  public typeFilter = signal<'all' | 'income' | 'expense'>('all');
  public categoryFilter = signal<string>('all');
  public searchTerm = signal<string>('');

  public filteredTransactions = computed(() => {
    let list = this.transactions();

    if (this.typeFilter() !== 'all') {
      list = list.filter((t) => t.type === this.typeFilter());
    }

    if (this.categoryFilter() !== 'all') {
      list = list.filter((t) => t.category_id === this.categoryFilter());
    }

    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      list = list.filter(
        (t) => t.description.toLowerCase().includes(term) || t.notes?.toLowerCase().includes(term),
      );
    }

    return list;
  });

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchTransactions();
      }
    });
  }

  ngOnInit() {
    this.fetchTransactions();
    this.loadCategories();
  }

  fetchTransactions() {
    this.isLoading.set(true);
    this.financeService.getPersonalTransactions().subscribe({
      next: (data) => {
        this.transactions.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching transactions:', err);
        this.isLoading.set(false);
      },
    });
  }

  loadCategories() {
    // Load both types
    this.financeService.getCategories('expense').subscribe((exp) => {
      this.financeService.getCategories('income').subscribe((inc) => {
        this.categories.set([...exp, ...inc]);
      });
    });
  }

  onEdit(tx: Transaction) {
    this.modalService.openTransactionModal(tx);
  }

  onDelete(tx: Transaction) {
    this.alertService
      .confirm(
        '¿Eliminar transacción?',
        `Esta acción no se puede deshacer. Se eliminará "${tx.description}".`,
      )
      .then((confirmed) => {
        if (confirmed) {
          this.financeService.deleteTransaction(tx.id).subscribe({
            next: () => {
              this.alertService.success('Eliminado', 'La transacción ha sido borrada.');
              this.refreshService.triggerRefresh();
            },
            error: (err) => {
              console.error('Error deleting transaction:', err);
              this.alertService.error('Error', 'No se pudo eliminar la transacción.');
            },
          });
        }
      });
  }

  setSearch(event: any) {
    this.searchTerm.set(event.target.value);
  }
}
