import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { AlertService } from '../../core/services/alert.service';
import {
  Budget,
  BudgetCreate,
  BudgetUpdate,
  Category,
  Rule503020Response,
  RuleBucket,
} from '../../core/models/finance.model';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, ReactiveFormsModule],
  templateUrl: './budgets.component.html',
})
export class BudgetsComponent implements OnInit {
  private financeService = inject(FinanceService);
  private alertService = inject(AlertService);
  private fb = inject(FormBuilder);

  public budgets = signal<Budget[]>([]);
  public ruleSummary = signal<Rule503020Response | null>(null);
  public categories = signal<Category[]>([]);
  public isLoading = signal<boolean>(true);
  public isSubmitting = signal<boolean>(false);

  // Filtros
  public activeFilter = signal<'all' | RuleBucket>('all');

  // Modal
  public isModalOpen = signal<boolean>(false);
  public editingBudget = signal<Budget | null>(null);
  public budgetForm!: FormGroup;

  // KPIs
  public totalBudgeted = computed(() =>
    this.budgets().reduce((acc, b) => acc + Number(b.monthly_limit || 0), 0)
  );

  public totalSpent = computed(() =>
    this.budgets().reduce((acc, b) => acc + Number(b.spent_this_month || 0), 0)
  );

  public totalRemaining = computed(() =>
    Math.max(0, this.totalBudgeted() - this.totalSpent())
  );

  public overallPercentage = computed(() => {
    const budgeted = this.totalBudgeted();
    if (budgeted <= 0) return 0;
    return Math.min(100, Math.round((this.totalSpent() / budgeted) * 100));
  });

  public filteredBudgets = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.budgets();
    return this.budgets().filter((b) => b.rule_bucket === filter);
  });

  // Categorías que aún no tienen presupuesto asignado (para crear)
  public availableCategories = computed(() => {
    const assignedIds = new Set(this.budgets().map((b) => b.category_id));
    const editingId = this.editingBudget()?.category_id;
    return this.categories().filter((c) => !assignedIds.has(c.id) || c.id === editingId);
  });

  ngOnInit() {
    this.initForm();
    this.loadData();
  }

  private initForm() {
    this.budgetForm = this.fb.group({
      category_id: ['', [Validators.required]],
      monthly_limit: [null, [Validators.required, Validators.min(1)]],
      rule_bucket: ['needs', [Validators.required]],
    });
  }

  public loadData() {
    this.isLoading.set(true);
    this.financeService.getBudgets().subscribe({
      next: (data) => {
        this.budgets.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });

    this.financeService.get503020Summary().subscribe({
      next: (summary) => this.ruleSummary.set(summary),
    });

    this.financeService.getCategories('expense').subscribe({
      next: (cats) => this.categories.set(cats),
    });
  }

  public openCreateModal() {
    this.editingBudget.set(null);
    this.budgetForm.reset({
      category_id: '',
      monthly_limit: null,
      rule_bucket: 'needs',
    });
    this.isModalOpen.set(true);
  }

  public openEditModal(budget: Budget) {
    this.editingBudget.set(budget);
    this.budgetForm.patchValue({
      category_id: budget.category_id,
      monthly_limit: budget.monthly_limit,
      rule_bucket: budget.rule_bucket,
    });
    this.isModalOpen.set(true);
  }

  public closeModal() {
    this.isModalOpen.set(false);
    this.editingBudget.set(null);
  }

  public onSubmit() {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.budgetForm.value;
    const editing = this.editingBudget();

    if (editing) {
      const updateData: BudgetUpdate = {
        monthly_limit: formValue.monthly_limit,
        rule_bucket: formValue.rule_bucket,
      };
      this.financeService.updateBudget(editing.id, updateData).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.alertService.show('success', 'Presupuesto actualizado correctamente');
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.alertService.show('error', err.error?.detail || 'Error al actualizar presupuesto');
        },
      });
    } else {
      const createData: BudgetCreate = {
        category_id: formValue.category_id,
        monthly_limit: formValue.monthly_limit,
        rule_bucket: formValue.rule_bucket,
      };
      this.financeService.createBudget(createData).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.alertService.show('success', 'Presupuesto creado con éxito');
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.alertService.show('error', err.error?.detail || 'Error al crear presupuesto');
        },
      });
    }
  }

  public deleteBudget(budget: Budget) {
    const name = budget.category_name || 'este presupuesto';
    if (!confirm(`¿Deseas eliminar el presupuesto mensual de "${name}"?`)) {
      return;
    }

    this.financeService.deleteBudget(budget.id).subscribe({
      next: () => {
        this.alertService.show('success', 'Presupuesto eliminado');
        this.loadData();
      },
      error: (err) => {
        this.alertService.show('error', err.error?.detail || 'No se pudo eliminar el presupuesto');
      },
    });
  }

  public getBucketLabel(bucket: RuleBucket): string {
    switch (bucket) {
      case 'needs':
        return '50% Necesidades';
      case 'wants':
        return '30% Deseos';
      case 'savings':
        return '20% Ahorro';
      default:
        return bucket;
    }
  }

  public getBucketColor(bucket: RuleBucket): string {
    switch (bucket) {
      case 'needs':
        return '#47eaed';
      case 'wants':
        return '#ffa54a';
      case 'savings':
        return '#2ddbde';
      default:
        return '#859493';
    }
  }
}
