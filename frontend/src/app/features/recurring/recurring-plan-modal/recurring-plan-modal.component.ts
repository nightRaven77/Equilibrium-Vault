import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ModalService } from '../../../core/services/modal.service';
import { FinanceService } from '../../../core/services/finance.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { RefreshService } from '../../../core/services/refresh.service';
import { Category, CreditCard, RecurringPaymentCreate, RecurringPaymentUpdate } from '../../../core/models/finance.model';

@Component({
  selector: 'app-recurring-plan-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './recurring-plan-modal.component.html'
})
export class RecurringPlanModalComponent implements OnInit {
  public modalService = inject(ModalService);
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);

  public isOpen = this.modalService.isRecurringPlanModalOpen;
  private planId = this.modalService.selectedRecurringPlanId;

  public categories = signal<Category[]>([]);
  public creditCards = signal<CreditCard[]>([]);
  public isSaving = signal<boolean>(false);
  public isEditing = signal<boolean>(false);

  public planForm = this.fb.group({
    name: ['', [Validators.required]],
    category_id: ['', [Validators.required]],
    credit_card_id: [''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    payment_method: ['credit_card', [Validators.required]],
    frequency: ['monthly', [Validators.required]],
    day_of_period: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    start_date: [new Date().toISOString().split('T')[0], [Validators.required]],
    notes: ['']
  });

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const id = this.planId();
      
      if (open) {
        if (id) {
          this.isEditing.set(true);
          this.loadPlan(id);
        } else {
          this.isEditing.set(false);
          this.planForm.reset({
            payment_method: 'credit_card',
            frequency: 'monthly',
            day_of_period: 1,
            start_date: new Date().toISOString().split('T')[0]
          });
        }
      }
    });
  }

  ngOnInit(): void {
    this.financeService.getCategories('expense').subscribe(cats => this.categories.set(cats));
    this.financeService.getCreditCards().subscribe(cards => this.creditCards.set(cards));
  }

  loadPlan(id: string) {
    this.recurringService.getRecurringPayments().subscribe(plans => {
      const plan = plans.find(p => p.id === id);
      if (plan) {
        this.planForm.patchValue({
          name: plan.name,
          category_id: plan.category_id,
          credit_card_id: plan.credit_card_id,
          amount: plan.amount,
          payment_method: plan.payment_method,
          frequency: plan.frequency,
          day_of_period: plan.day_of_period,
          start_date: plan.start_date,
          notes: plan.description
        });
      }
    });
  }

  close() {
    this.modalService.closeRecurringPlanModal();
  }

  onSubmit() {
    if (this.planForm.invalid) return;

    this.isSaving.set(true);
    const formValue = this.planForm.value;

    if (this.isEditing() && this.planId()) {
      const dto: RecurringPaymentUpdate = {
        name: formValue.name!,
        category_id: formValue.category_id!,
        credit_card_id: formValue.credit_card_id || null,
        amount: Number(formValue.amount),
        payment_method: formValue.payment_method!,
        frequency: formValue.frequency as any,
        day_of_period: Number(formValue.day_of_period),
        start_date: formValue.start_date!,
        description: formValue.notes || null,
      };

      this.recurringService.updateRecurringPayment(this.planId()!, dto).subscribe({
        next: () => {
          this.refreshService.triggerRefresh();
          this.isSaving.set(false);
          this.close();
        },
        error: (err) => {
          console.error(err);
          this.isSaving.set(false);
        }
      });
    } else {
      const dto: RecurringPaymentCreate = {
        name: formValue.name!,
        category_id: formValue.category_id!,
        credit_card_id: formValue.credit_card_id || null,
        amount: Number(formValue.amount),
        payment_method: formValue.payment_method!,
        frequency: formValue.frequency as any,
        day_of_period: Number(formValue.day_of_period),
        start_date: formValue.start_date!,
        description: formValue.notes || null,
      };

      this.recurringService.createRecurringPayment(dto).subscribe({
        next: () => {
          this.refreshService.triggerRefresh();
          this.isSaving.set(false);
          this.close();
        },
        error: (err) => {
          console.error(err);
          this.isSaving.set(false);
        }
      });
    }
  }

  deletePlan() {
    if (confirm('¿Estás seguro de eliminar esta suscripción?')) {
      if (this.planId()) {
        this.isSaving.set(true);
        this.recurringService.deleteRecurringPayment(this.planId()!).subscribe({
          next: () => {
            this.refreshService.triggerRefresh();
            this.isSaving.set(false);
            this.close();
          },
          error: (err) => {
            console.error(err);
            this.isSaving.set(false);
          }
        });
      }
    }
  }
}
