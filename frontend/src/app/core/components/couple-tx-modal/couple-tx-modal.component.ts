import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { FinanceService } from '../../services/finance.service';
import { RefreshService } from '../../services/refresh.service';
import { AlertService } from '../../services/alert.service';
import { AuthService } from '../../services/auth.service';
import { Category } from '../../models/finance.model';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: 'payments' },
  { value: 'debit_card', label: 'Débito', icon: 'credit_card' },
  { value: 'credit_card', label: 'Crédito', icon: 'credit_score' },
  { value: 'transfer', label: 'Transferencia', icon: 'swap_horiz' },
  { value: 'digital_wallet', label: 'Wallet', icon: 'account_balance_wallet' },
];

@Component({
  selector: 'app-couple-tx-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (modalService.isCoupleTxModalOpen()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" (click)="close()">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-lg bg-[#1C1B1B] border border-[#3B4949]/30 rounded-2xl shadow-2xl p-8 z-10 overflow-y-auto max-h-[92vh]"
             (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="flex justify-between items-center mb-8">
            <div>
              <h2 class="text-2xl font-headline font-bold tracking-tighter text-on-surface">New Joint Expense</h2>
              <p class="text-[10px] font-label text-primary tracking-widest uppercase">
                {{ member1Name() }} & {{ member2Name() }}
              </p>
            </div>
            <button (click)="close()" class="text-on-surface-variant hover:text-error transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <form [formGroup]="txForm" (ngSubmit)="onSubmit()" class="space-y-5">

            <!-- Description -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Descripción *</label>
              <input formControlName="description" type="text" placeholder="Ej. Cena restaurante"
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"/>
              @if (txForm.get('description')?.invalid && txForm.get('description')?.touched) {
                <p class="text-error text-[10px]">La descripción es requerida.</p>
              }
            </div>

            <!-- Amount + Date -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Monto *</label>
                <input formControlName="amount" type="number" step="0.01" min="0.01" placeholder="0.00"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"/>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Fecha *</label>
                <input formControlName="transaction_date" type="date"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"/>
              </div>
            </div>

            <!-- Category -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Categoría *</label>
              <select formControlName="category_id"
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors">
                <option value="">Seleccionar categoría...</option>
                @for (cat of categories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
                }
              </select>
            </div>

            <!-- Payment Method -->
            <div class="space-y-2">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Método de Pago *</label>
              <div class="flex gap-2 flex-wrap">
                @for (pm of paymentMethods; track pm.value) {
                  <button type="button" (click)="txForm.patchValue({ payment_method: pm.value })"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-label font-bold tracking-wider uppercase transition-all border"
                    [class]="txForm.value.payment_method === pm.value
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-outline-variant/20 bg-surface-container text-on-surface-variant hover:border-primary/40'">
                    <span class="material-symbols-outlined text-sm">{{ pm.icon }}</span>{{ pm.label }}
                  </button>
                }
              </div>
            </div>

            <!-- ─── Who paid? ─────────────────────────────────────────────── -->
            <div class="space-y-2">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">¿Quién pagó? *</label>
              <div class="grid grid-cols-2 gap-3">
                <!-- Member 1 -->
                <button type="button"
                  (click)="txForm.patchValue({ paid_by_user_id: couple()?.user1_id })"
                  class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                  [class]="txForm.value.paid_by_user_id === couple()?.user1_id
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant/20 bg-surface-container hover:border-primary/30'">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                       [class]="txForm.value.paid_by_user_id === couple()?.user1_id
                         ? 'bg-primary text-on-primary'
                         : 'bg-surface-container-high text-on-surface-variant'">
                    {{ member1Initials() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold truncate"
                       [class]="txForm.value.paid_by_user_id === couple()?.user1_id ? 'text-primary' : 'text-on-surface'">
                      {{ member1Name() }}
                    </p>
                    @if (isCurrentUser(couple()?.user1_id)) {
                      <p class="text-[9px] text-on-surface-variant uppercase tracking-widest">Tú</p>
                    }
                  </div>
                </button>

                <!-- Member 2 -->
                <button type="button"
                  (click)="txForm.patchValue({ paid_by_user_id: couple()?.user2_id })"
                  class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                  [class]="txForm.value.paid_by_user_id === couple()?.user2_id
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant/20 bg-surface-container hover:border-primary/30'">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                       [class]="txForm.value.paid_by_user_id === couple()?.user2_id
                         ? 'bg-primary text-on-primary'
                         : 'bg-surface-container-high text-on-surface-variant'">
                    {{ member2Initials() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold truncate"
                       [class]="txForm.value.paid_by_user_id === couple()?.user2_id ? 'text-primary' : 'text-on-surface'">
                      {{ member2Name() }}
                    </p>
                    @if (isCurrentUser(couple()?.user2_id)) {
                      <p class="text-[9px] text-on-surface-variant uppercase tracking-widest">Tú</p>
                    }
                  </div>
                </button>
              </div>
            </div>

            <!-- ─── Split ──────────────────────────────────────────────────── -->
            <div class="space-y-3 bg-surface-container-high rounded-xl p-4">
              <div class="flex justify-between items-center">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">División del gasto</label>
                <button type="button" (click)="setSplit(50)"
                  class="text-[9px] font-label text-primary/70 hover:text-primary uppercase tracking-wider transition-colors">
                  ↺ 50/50
                </button>
              </div>
              <div class="flex items-center gap-3">
                <!-- Member 1 side -->
                <div class="flex-1 space-y-1 text-center">
                  <p class="text-[9px] font-label text-on-surface-variant tracking-wider uppercase truncate">{{ member1Name() }}</p>
                  <input formControlName="user1_share_pct" type="number" min="0" max="100" step="1"
                    class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-2 text-sm text-center font-bold focus:outline-none focus:border-primary/60 transition-colors"
                    (input)="syncSplit('user1')"/>
                  <p class="text-[11px] font-bold text-primary">{{ txForm.value.user1_share_pct }}%</p>
                </div>

                <div class="text-on-surface-variant/30 font-bold pb-4">+</div>

                <!-- Member 2 side -->
                <div class="flex-1 space-y-1 text-center">
                  <p class="text-[9px] font-label text-on-surface-variant tracking-wider uppercase truncate">{{ member2Name() }}</p>
                  <input formControlName="user2_share_pct" type="number" min="0" max="100" step="1"
                    class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-2 text-sm text-center font-bold focus:outline-none focus:border-primary/60 transition-colors"
                    (input)="syncSplit('user2')"/>
                  <p class="text-[11px] font-bold text-primary">{{ txForm.value.user2_share_pct }}%</p>
                </div>

                <div class="text-on-surface-variant/30 text-sm pb-4">= 100%</div>
              </div>

              <!-- Split preview bar -->
              <div class="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-300"
                     [style.width.%]="txForm.value.user1_share_pct"></div>
              </div>
              <div class="flex justify-between text-[9px] font-label text-on-surface-variant/60">
                <span>{{ member1Name() }}</span>
                <span>{{ member2Name() }}</span>
              </div>

              @if ((txForm.value.user1_share_pct + txForm.value.user2_share_pct) !== 100) {
                <p class="text-error text-[10px] text-center">
                  La suma debe ser 100% (actual: {{ txForm.value.user1_share_pct + txForm.value.user2_share_pct }}%)
                </p>
              }
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              <button type="button" (click)="close()"
                class="flex-1 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-label text-xs tracking-widest uppercase hover:bg-surface-container-high transition-colors">
                Cancelar
              </button>
              <button type="submit" [disabled]="isLoading()"
                class="flex-1 py-3 rounded-xl bg-primary text-on-primary font-label text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50 status-glow">
                {{ isLoading() ? 'Guardando...' : 'Registrar Gasto' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class CoupleTxModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  private authService = inject(AuthService);
  public modalService = inject(ModalService);

  public txForm!: FormGroup;
  public isLoading = signal(false);
  public categories = signal<Category[]>([]);

  readonly paymentMethods = PAYMENT_METHODS;
  readonly today = new Date().toISOString().split('T')[0];

  // Computed shortcuts from the couple in the modal service
  public couple = computed(() => this.modalService.selectedCouple());

  public member1Name = computed(() =>
    this.couple()?.user1_name || this._initials(this.couple()?.user1_id)
  );
  public member2Name = computed(() =>
    this.couple()?.user2_name || this._initials(this.couple()?.user2_id)
  );
  public member1Initials = computed(() =>
    this._toInitials(this.couple()?.user1_name || 'U1')
  );
  public member2Initials = computed(() =>
    this._toInitials(this.couple()?.user2_name || 'U2')
  );

  ngOnInit() {
    this.txForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(200)]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      transaction_date: [this.today, Validators.required],
      category_id: ['', Validators.required],
      payment_method: ['cash', Validators.required],
      user1_share_pct: [50],
      user2_share_pct: [50],
      paid_by_user_id: ['', Validators.required],
    });

    // Pre-seleccionar al usuario actual como pagador si es miembro
    const uid = this.authService.currentUser()?.id;
    const c = this.couple();
    if (uid && c) {
      if (c.user1_id === uid || c.user2_id === uid) {
        this.txForm.patchValue({ paid_by_user_id: uid });
      }
    }

    this.financeService.getCategories('expense').subscribe({
      next: cats => this.categories.set(cats),
      error: () => {}
    });
  }

  isCurrentUser(userId?: string | null): boolean {
    return !!userId && userId === this.authService.currentUser()?.id;
  }

  setSplit(pct1: number) {
    this.txForm.patchValue({ user1_share_pct: pct1, user2_share_pct: 100 - pct1 });
  }

  syncSplit(changed: 'user1' | 'user2') {
    const v = this.txForm.value;
    if (changed === 'user1') {
      const p1 = Math.min(100, Math.max(0, Number(v.user1_share_pct)));
      this.txForm.patchValue({ user1_share_pct: p1, user2_share_pct: 100 - p1 }, { emitEvent: false });
    } else {
      const p2 = Math.min(100, Math.max(0, Number(v.user2_share_pct)));
      this.txForm.patchValue({ user2_share_pct: p2, user1_share_pct: 100 - p2 }, { emitEvent: false });
    }
  }

  close() { this.modalService.closeCoupleTxModal(); }

  onSubmit() {
    if (this.txForm.invalid) { this.txForm.markAllAsTouched(); return; }
    const v = this.txForm.value;
    if (v.user1_share_pct + v.user2_share_pct !== 100) {
      this.alertService.error('Split inválido', 'Los porcentajes deben sumar 100%.');
      return;
    }

    const coupleId = this.couple()?.id;
    if (!coupleId) return;

    this.isLoading.set(true);
    this.financeService.createCoupleTransaction(coupleId, v).subscribe({
      next: () => {
        this.alertService.success('Gasto registrado', 'El gasto compartido fue guardado correctamente.');
        this.refreshService.triggerRefresh();
        this.isLoading.set(false);
        this.close();
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al registrar el gasto.';
        this.alertService.error('No se pudo guardar', msg);
      }
    });
  }

  private _toInitials(name: string): string {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  private _initials(id?: string | null): string {
    return id ? id.substring(0, 6) + '...' : 'N/A';
  }
}
