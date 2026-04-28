import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { AlertService } from '../../core/services/alert.service';
import { Couple, CoupleBalance, CoupleTransaction } from '../../core/models/finance.model';

type FilterTab = 'all' | 'pending' | 'settled';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-couples',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './couples.component.html',
})
export class CouplesComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  private fb = inject(FormBuilder);
  public modalService = inject(ModalService);

  public isCreateModalOpen = signal(false);
  public isCreating = signal(false);
  public isSearching = signal(false);
  public foundProfile = signal<{ id: string; full_name: string } | null>(null);
  public coupleForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', Validators.maxLength(80)],
  });

  public couple = signal<Couple | null>(null);
  public transactions = signal<CoupleTransaction[]>([]);
  public balance = signal<CoupleBalance | null>(null);
  public isLoading = signal<boolean>(true);
  public activeFilter = signal<FilterTab>('all');

  public pendingTransactions = computed(() =>
    this.transactions().filter((t) => t.status === 'pending'),
  );

  public settledTransactions = computed(() =>
    this.transactions().filter((t) => t.status === 'settled'),
  );

  public filteredTransactions = computed(() => {
    const f = this.activeFilter();
    const all = this.transactions();
    if (f === 'pending') return all.filter(t => t.status === 'pending');
    if (f === 'settled') return all.filter(t => t.status === 'settled');
    return all;
  });

  public totalPending = computed(() =>
    this.pendingTransactions().reduce((acc, t) => acc + Number(t.amount), 0)
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
          const activeCouple = couples.find(c => c.status === 'active') ?? couples[0];
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

  setFilter(f: string) {
    this.activeFilter.set(f as FilterTab);
  }

  openNewExpenseModal() {
    const c = this.couple();
    if (c) this.modalService.openCoupleTxModal(c);
  }

  settleTransaction(tx: CoupleTransaction) {
    const coupleId = this.couple()?.id;
    if (!coupleId) return;

    this.alertService.confirm(
      '¿Liquidar gasto?',
      `¿Marcar "${tx.description}" (${ Number(tx.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) }) como liquidado?`,
      'Liquidar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.financeService.settleTransaction(coupleId, tx.id).subscribe({
        next: () => {
          this.alertService.success('Liquidado', `"${tx.description}" marcado como liquidado.`);
          this.refreshService.triggerRefresh();
        },
        error: (err) => {
          const msg = err.error?.detail?.message ?? 'Error al liquidar.';
          this.alertService.error('No se pudo liquidar', msg);
        }
      });
    });
  }

  settleAll() {
    const coupleId = this.couple()?.id;
    if (!coupleId || this.pendingTransactions().length === 0) return;

    this.alertService.confirm(
      '¿Liquidar todo?',
      `Se marcarán ${this.pendingTransactions().length} transacción(es) pendiente(s) como liquidadas.`,
      'Liquidar todo'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.financeService.settleAllTransactions(coupleId).subscribe({
        next: (res) => {
          this.alertService.success('¡Cuentas saldadas!', res.message);
          this.refreshService.triggerRefresh();
        },
        error: (err) => {
          const msg = err.error?.detail?.message ?? 'Error al liquidar.';
          this.alertService.error('Error', msg);
        }
      });
    });
  }

  getBalancePct(): number {
    const total = this.transactions().reduce((acc, t) => acc + Number(t.amount), 0);
    const settled = this.settledTransactions().reduce((acc, t) => acc + Number(t.amount), 0);
    if (total === 0) return 100;
    return Math.round((settled / total) * 100);
  }

  openCreateModal() {
    this.coupleForm.reset({ email: '', name: '' });
    this.foundProfile.set(null);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal() {
    this.isCreateModalOpen.set(false);
    this.foundProfile.set(null);
  }

  searchPartner() {
    const email = this.coupleForm.get('email')?.value?.trim();
    if (!email || !this.coupleForm.get('email')?.valid) return;
    this.isSearching.set(true);
    this.foundProfile.set(null);
    this.financeService.searchProfile(email).subscribe({
      next: (profile) => {
        this.foundProfile.set(profile);
        this.isSearching.set(false);
      },
      error: (err) => {
        this.isSearching.set(false);
        const msg = err.error?.detail?.message ?? 'Usuario no encontrado.';
        this.alertService.error('No encontrado', msg);
      }
    });
  }

  submitCreateCouple() {
    if (!this.foundProfile()) {
      this.alertService.warning('Busca primero', 'Debes buscar y confirmar el perfil de tu pareja antes de crear el vínculo.');
      return;
    }
    this.isCreating.set(true);
    const v = this.coupleForm.value;
    this.financeService.createCouple({
      user2_id: this.foundProfile()!.id,
      name: v.name?.trim() || null,
    }).subscribe({
      next: () => {
        this.alertService.success('¡Vínculo creado!', 'El vínculo de pareja fue creado exitosamente.');
        this.isCreating.set(false);
        this.closeCreateModal();
        this.fetchCoupleData();
      },
      error: (err) => {
        this.isCreating.set(false);
        const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al crear el vínculo.';
        this.alertService.error('No se pudo crear', msg);
      }
    });
  }
}
