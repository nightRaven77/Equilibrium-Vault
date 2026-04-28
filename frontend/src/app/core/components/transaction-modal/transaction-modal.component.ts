import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { FinanceService } from '../../services/finance.service';
import { RefreshService } from '../../services/refresh.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';
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
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  // Formulario Reactivo
  public transactionForm!: FormGroup;

  // Datos para los combos
  public categories = signal<Category[]>([]);
  public creditCards = signal<CreditCard[]>([]);
  public couples = signal<Couple[]>([]);
  public isLoading = signal<boolean>(false);

  public isEditMode = computed(() => !!this.modalService.selectedTransaction());

  public filteredCategories = computed(() => {
    const type = this.transactionForm?.get('type')?.value;
    return this.categories().filter((c) => c.type === type);
  });

  public monthlyInstallment = computed(() => {
    const amount = this.transactionForm?.get('amount')?.value || 0;
    const months = this.transactionForm?.get('installment_months')?.value || 1;
    const isMSI = this.transactionForm?.get('is_installment')?.value;
    
    if (!isMSI || amount <= 0 || months <= 1) return null;
    return amount / months;
  });

  constructor() {
    effect(() => {
      const tx = this.modalService.selectedTransaction();
      if (tx && this.transactionForm) {
        this.transactionForm.patchValue({
          amount: tx.amount,
          description: tx.description,
          category_id: tx.category_id,
          type: tx.type,
          payment_method: tx.payment_method,
          credit_card_id: tx.credit_card_id,
          transaction_date: tx.transaction_date,
          notes: tx.notes,
          is_installment: tx.is_installment || false,
          installment_months: tx.installment_months
        });
      }
    });
  }

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
      notes: ['']
    });

    this.transactionForm.get('payment_method')?.valueChanges.subscribe((method) => {
      const cardControl = this.transactionForm.get('credit_card_id');
      if (method === 'credit_card') {
        cardControl?.setValidators([Validators.required]);
      } else {
        cardControl?.clearValidators();
        cardControl?.setValue(null);
        this.transactionForm.get('is_installment')?.setValue(false);
      }
      cardControl?.updateValueAndValidity();
    });

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

    this.transactionForm.get('is_shared')?.valueChanges.subscribe((isShared) => {
      const coupleControl = this.transactionForm.get('couple_id');
      if (isShared) {
        coupleControl?.setValidators([Validators.required]);
        if (this.couples().length > 0 && !coupleControl?.value) {
          coupleControl?.setValue(this.couples()[0].id);
        }
      } else {
        coupleControl?.clearValidators();
        coupleControl?.setValue(null);
      }
      coupleControl?.updateValueAndValidity();
    });

    this.transactionForm.get('type')?.valueChanges.subscribe((type) => {
      if (type === 'income') {
        this.transactionForm.get('is_shared')?.setValue(false);
        this.financeService.getCategories('income').subscribe((data) => this.categories.set(data));
        if (this.transactionForm.get('payment_method')?.value === 'credit_card') {
          this.transactionForm.get('payment_method')?.setValue('transfer');
        }
      } else {
        this.financeService.getCategories('expense').subscribe((data) => this.categories.set(data));
      }
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
    const tx = this.modalService.selectedTransaction();

    if (this.isEditMode() && tx) {
      // Update logic
      const payload = {
        category_id: formValues.category_id,
        credit_card_id: formValues.credit_card_id,
        amount: formValues.amount,
        type: formValues.type,
        payment_method: formValues.payment_method,
        description: formValues.description,
        transaction_date: formValues.transaction_date,
        notes: formValues.notes
      };

      this.financeService.updateTransaction(tx.id, payload).subscribe({
        next: () => {
          this.alertService.success('Transacción Actualizada', 'Los cambios se han guardado correctamente.');
          this.handleSuccess();
        },
        error: (err) => this.handleError(err),
      });
      return;
    }

    if (formValues.is_shared) {
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
        next: () => {
          this.alertService.success('Gasto Compartido', 'El gasto se ha registrado correctamente.');
          this.handleSuccess();
        },
        error: (err) => this.handleError(err),
      });
    } else {
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
        notes: formValues.notes
      };

      this.financeService.createTransaction(payload).subscribe({
        next: () => {
          this.alertService.success('Transacción Registrada', 'La transacción se ha guardado correctamente.');
          this.handleSuccess();
        },
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
    this.alertService.error('Error', 'No se pudo guardar la transacción.');
  }
}
