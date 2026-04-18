import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { FinanceService } from '../../services/finance.service';
import { RefreshService } from '../../services/refresh.service';
import { AuthService } from '../../services/auth.service';
import { Category, CreditCard, Couple } from '../../models/finance.model';

@Component({
  selector: 'app-transaction-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transaction-modal.component.html',
})
export class TransactionModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private authService = inject(AuthService);
  public modalService = inject(ModalService);

  // Formulario Reactivo
  public transactionForm!: FormGroup;

  // Datos para los combos
  public categories = signal<Category[]>([]);
  public creditCards = signal<CreditCard[]>([]);
  public couples = signal<Couple[]>([]);
  public isLoading = signal<boolean>(false);

  public filteredCategories = computed(() => {
    const type = this.transactionForm?.get('type')?.value;
    return this.categories().filter((c) => c.type === type);
  });

  // Cálculo de mensualidad MSI en tiempo real
  public monthlyInstallment = computed(() => {
    const amount = this.transactionForm?.get('amount')?.value || 0;
    const months = this.transactionForm?.get('installment_months')?.value || 1;
    const isMSI = this.transactionForm?.get('is_installment')?.value;
    
    if (!isMSI || amount <= 0 || months <= 1) return null;
    return amount / months;
  });

  ngOnInit() {
    this.initForm();
    this.loadInitialData();
  }

  private initForm() {
    this.transactionForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      description: ['', [Validators.required, Validators.maxLength(200)]],
      category_id: ['', [Validators.required]],
      type: ['expense', [Validators.required]],
      payment_method: ['cash', [Validators.required]],
      credit_card_id: [null],
      transaction_date: [new Date().toISOString().split('T')[0], [Validators.required]],
      is_shared: [false],
      couple_id: [null],
      user1_share_pct: [50],
      user2_share_pct: [50],
      is_installment: [false],
      installment_months: [null],
    });

    // Validaciones condicionales para tarjetas de crédito
    this.transactionForm.get('payment_method')?.valueChanges.subscribe((method) => {
      const cardControl = this.transactionForm.get('credit_card_id');
      if (method === 'credit_card') {
        cardControl?.setValidators([Validators.required]);
      } else {
        cardControl?.clearValidators();
        cardControl?.setValue(null);
        // Al quitar tarjeta de crédito, quitamos MSI
        this.transactionForm.get('is_installment')?.setValue(false);
      }
      cardControl?.updateValueAndValidity();
    });

    // Validaciones condicionales para MSI
    this.transactionForm.get('is_installment')?.valueChanges.subscribe((isMSI) => {
      const monthsControl = this.transactionForm.get('installment_months');
      if (isMSI) {
        monthsControl?.setValidators([Validators.required, Validators.min(2)]);
        if (!monthsControl?.value) monthsControl?.setValue(3);
      } else {
        monthsControl?.clearValidators();
        monthsControl?.setValue(null);
      }
      monthsControl?.updateValueAndValidity();
    });

    // Validaciones condicionales para gastos compartidos
    this.transactionForm.get('is_shared')?.valueChanges.subscribe((isShared) => {
      const coupleControl = this.transactionForm.get('couple_id');
      if (isShared) {
        coupleControl?.setValidators([Validators.required]);
        // Si hay una pareja disponible, la seleccionamos por defecto
        if (this.couples().length > 0 && !coupleControl?.value) {
          coupleControl?.setValue(this.couples()[0].id);
        }
      } else {
        coupleControl?.clearValidators();
        coupleControl?.setValue(null);
      }
      coupleControl?.updateValueAndValidity();
    });

    // Lógica específica para Income (Ingresos)
    this.transactionForm.get('type')?.valueChanges.subscribe((type) => {
      if (type === 'income') {
        // Los ingresos no se comparten en esta versión para mantener integridad de deudas
        this.transactionForm.get('is_shared')?.setValue(false);
        this.financeService.getCategories('income').subscribe((data) => this.categories.set(data));

        // Si el método era tarjeta de crédito, lo cambiamos a transferencia
        if (this.transactionForm.get('payment_method')?.value === 'credit_card') {
          this.transactionForm.get('payment_method')?.setValue('transfer');
        }
      }
      // Limpiar categoría al cambiar de tipo para forzar nueva selección válida
      this.transactionForm.get('category_id')?.setValue('');
    });
  }

  private loadInitialData() {
    this.financeService.getCategories('expense').subscribe((data) => this.categories.set(data));
    this.financeService.getCreditCards().subscribe((data) => this.creditCards.set(data));
    this.financeService.getCouples().subscribe((data) => this.couples.set(data));
  }

  close() {
    this.modalService.closeTransactionModal();
    this.transactionForm.reset({
      type: 'expense',
      payment_method: 'cash',
      transaction_date: new Date().toISOString().split('T')[0],
      is_shared: false,
      user1_share_pct: 50,
      user2_share_pct: 50,
    });
  }

  onSubmit() {
    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formValues = this.transactionForm.value;

    if (formValues.is_shared) {
      // Flujo de transacción compartida (Couples)
      const payload = {
        category_id: formValues.category_id,
        credit_card_id: formValues.credit_card_id,
        amount: formValues.amount,
        payment_method: formValues.payment_method,
        description: formValues.description,
        user1_share_pct: formValues.user1_share_pct,
        user2_share_pct: formValues.user2_share_pct,
        transaction_date: formValues.transaction_date,
        paid_by_user_id: this.authService.currentUser()?.id || '',
      };

      this.financeService.createCoupleTransaction(formValues.couple_id, payload).subscribe({
        next: () => this.handleSuccess(),
        error: (err) => this.handleError(err),
      });
    } else {
      // Flujo de transacción personal
      const payload = {
        category_id: formValues.category_id,
        credit_card_id: formValues.credit_card_id,
        amount: formValues.amount,
        type: formValues.type,
        payment_method: formValues.payment_method,
        description: formValues.description,
        transaction_date: formValues.transaction_date,
        is_installment: formValues.is_installment,
        installment_months: formValues.installment_months,
      };

      this.financeService.createTransaction(payload).subscribe({
        next: () => this.handleSuccess(),
        error: (err) => this.handleError(err),
      });
    }
  }

  private handleSuccess() {
    this.isLoading.set(false);
    this.refreshService.triggerRefresh();
    this.close();
  }

  private handleError(err: any) {
    this.isLoading.set(false);
    console.error('Error saving transaction:', err);
    alert('Failed to save transaction. Please try again.');
  }
}
