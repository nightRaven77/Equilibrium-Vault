import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ModalService } from '../../../core/services/modal.service';
import { FinanceService } from '../../../core/services/finance.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { RefreshService } from '../../../core/services/refresh.service';
import { AlertService } from '../../../core/services/alert.service';
import { Category, CreditCard, RecurringPaymentCreate, RecurringPaymentUpdate } from '../../../core/models/finance.model';

@Component({
  selector: 'app-recurring-plan-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recurring-plan-modal.component.html'
})
export class RecurringPlanModalComponent implements OnInit {
  public modalService = inject(ModalService);
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);

  public isOpen = this.modalService.isRecurringPlanModalOpen;
  private planId = this.modalService.selectedRecurringPlanId;

  public categories = signal<Category[]>([]);
  public creditCards = signal<CreditCard[]>([]);
  public isSaving = signal<boolean>(false);
  public isEditing = signal<boolean>(false);

  public planForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
    category_id: ['', Validators.required],
    credit_card_id: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    payment_method: ['credit_card', Validators.required],
    frequency: ['monthly', Validators.required],
    day_of_period: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    start_date: [new Date().toISOString().split('T')[0], Validators.required],
    end_date: [''],
    notes: [''],
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
            start_date: new Date().toISOString().split('T')[0],
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
    this.recurringService.getRecurringPayment(id).subscribe({
      next: (plan) => {
        this.planForm.patchValue({
          name: plan.name,
          category_id: plan.category_id,
          credit_card_id: plan.credit_card_id ?? '',
          amount: plan.amount,
          payment_method: plan.payment_method,
          frequency: plan.frequency,
          day_of_period: plan.day_of_period,
          start_date: plan.start_date,
          end_date: plan.end_date ?? '',
          notes: plan.description ?? '',
        });
      },
      error: () => this.alertService.error('Error', 'No se pudo cargar el plan.'),
    });
  }

  close() { this.modalService.closeRecurringPlanModal(); }

  onSubmit() {
    if (this.planForm.invalid) { this.planForm.markAllAsTouched(); return; }
    const v = this.planForm.value;
    this.isSaving.set(true);

    const base = {
      name: v.name!,
      category_id: v.category_id!,
      credit_card_id: v.credit_card_id || null,
      amount: Number(v.amount),
      payment_method: v.payment_method!,
      frequency: v.frequency as any,
      day_of_period: Number(v.day_of_period),
      start_date: v.start_date!,
      end_date: v.end_date || null,
      description: v.notes || null,
    };

    const action$ = this.isEditing() && this.planId()
      ? this.recurringService.updateRecurringPayment(this.planId()!, base as RecurringPaymentUpdate)
      : this.recurringService.createRecurringPayment(base as RecurringPaymentCreate);

    action$.subscribe({
      next: () => {
        this.alertService.success(
          this.isEditing() ? 'Actualizada' : '¡Creada!',
          this.isEditing() ? 'La suscripción fue actualizada.' : 'La suscripción fue creada y sus ocurrencias generadas.'
        );
        this.refreshService.triggerRefresh();
        this.isSaving.set(false);
        this.close();
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al guardar.';
        this.alertService.error('No se pudo guardar', msg);
      },
    });
  }

  deletePlan() {
    if (!this.planId()) return;
    this.alertService.confirm(
      '¿Eliminar suscripción?',
      'La suscripción se desactivará. El historial de pagos se conservará.',
    ).then(confirmed => {
      if (!confirmed) return;
      this.isSaving.set(true);
      this.recurringService.deleteRecurringPayment(this.planId()!).subscribe({
        next: () => {
          this.alertService.success('Eliminada', 'La suscripción fue eliminada.');
          this.refreshService.triggerRefresh();
          this.isSaving.set(false);
          this.close();
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al eliminar.';
          this.alertService.error('Error', msg);
        },
      });
    });
  }
}
