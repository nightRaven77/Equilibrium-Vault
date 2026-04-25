import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { FinanceService } from '../../services/finance.service';
import { RefreshService } from '../../services/refresh.service';
import { AlertService } from '../../services/alert.service';

const ICON_OPTIONS = ['💰', '🏠', '🚗', '✈️', '🎓', '💻', '❤️', '🏖️', '🛍️', '🏥', '🎯', '📱', '🔧', '🌍', '🎮', '🍔', '💪', '🐾', '🎵', '💎'];
const COLOR_OPTIONS = ['#47EAED', '#ffb876', '#a78bfa', '#f472b6', '#34d399', '#60a5fa', '#f87171', '#fbbf24'];
const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
  { value: 'weekly', label: 'Semanal' },
];

@Component({
  selector: 'app-saving-goal-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (modalService.isSavingGoalModalOpen()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" (click)="close()">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-lg bg-[#1C1B1B] border border-[#3B4949]/30 rounded-2xl shadow-2xl p-8 z-10 overflow-y-auto max-h-[90vh]" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="flex justify-between items-center mb-8">
            <div>
              <h2 class="text-2xl font-headline font-bold tracking-tighter text-on-surface">
                {{ isEditMode() ? 'Edit Goal' : 'New Goal' }}
              </h2>
              <p class="text-[10px] font-label text-primary tracking-widest uppercase">
                {{ isEditMode() ? 'Modify Objective' : 'Define Objective' }}
              </p>
            </div>
            <button (click)="close()" class="text-on-surface-variant hover:text-error transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <form [formGroup]="goalForm" (ngSubmit)="onSubmit()" class="space-y-5">

            <!-- Icon & Color -->
            <div class="space-y-2">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Icono & Color</label>
              <div class="flex gap-4 items-start">
                <!-- Icon Picker -->
                <div class="flex flex-wrap gap-2 flex-1">
                  @for (icon of iconOptions; track icon) {
                    <button type="button"
                      (click)="selectIcon(icon)"
                      class="w-9 h-9 rounded-lg flex items-center justify-center border transition-all text-lg"
                      [class]="goalForm.value.icon === icon
                        ? 'border-primary bg-primary/20'
                        : 'border-outline-variant/20 bg-surface-container hover:border-primary/50'">
                      {{ icon }}
                    </button>
                  }
                </div>
                <!-- Color Picker -->
                <div class="flex flex-col gap-2">
                  @for (color of colorOptions; track color) {
                    <button type="button"
                      (click)="selectColor(color)"
                      class="w-6 h-6 rounded-full border-2 transition-all"
                      [style.backgroundColor]="color"
                      [class]="goalForm.value.color === color ? 'border-white scale-125' : 'border-transparent'">
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Name -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Nombre de la Meta *</label>
              <input formControlName="name" type="text" placeholder="Ej. Fondo de emergencia"
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
              @if (goalForm.get('name')?.invalid && goalForm.get('name')?.touched) {
                <p class="text-error text-[10px]">El nombre es requerido (máx. 100 caracteres).</p>
              }
            </div>

            <!-- Target Amount + Currency -->
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2 space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Objetivo *</label>
                <input formControlName="target_amount" type="number" step="0.01" min="1" placeholder="0.00"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Moneda</label>
                <select formControlName="currency"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors">
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <!-- Annual Rate + Frequency -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Tasa Anual %</label>
                <input formControlName="annual_rate_pct" type="number" step="0.01" min="0" max="100" placeholder="0.00"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Frecuencia</label>
                <select formControlName="compounding_frequency"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors">
                  @for (f of frequencyOptions; track f.value) {
                    <option [value]="f.value">{{ f.label }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Target Date -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Fecha Límite (Opcional)</label>
              <input formControlName="target_date" type="date" [min]="minDate"
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors" />
            </div>

            <!-- Description -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Descripción (Opcional)</label>
              <textarea formControlName="description" rows="2" placeholder="Notas adicionales..."
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors resize-none"></textarea>
            </div>

            <!-- Status (edit mode only) -->
            @if (isEditMode()) {
              <div class="space-y-1">
                <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Estado</label>
                <select formControlName="status"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors">
                  <option value="active">Activo</option>
                  <option value="paused">Pausado</option>
                </select>
              </div>
            }

            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              <button type="button" (click)="close()"
                class="flex-1 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-label text-xs tracking-widest uppercase hover:bg-surface-container-high transition-colors">
                Cancelar
              </button>
              <button type="submit" [disabled]="isLoading()"
                class="flex-2 flex-1 py-3 rounded-xl bg-primary text-on-primary font-label text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50 status-glow">
                {{ isLoading() ? 'Guardando...' : (isEditMode() ? 'Actualizar' : 'Crear Meta') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class SavingGoalModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  public goalForm!: FormGroup;
  public isLoading = signal(false);
  public isEditMode = signal(false);

  readonly iconOptions = ICON_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;
  readonly frequencyOptions = FREQUENCY_OPTIONS;
  readonly minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  constructor() {
    effect(() => {
      const goalId = this.modalService.selectedSavingGoalId();
      if (goalId && this.modalService.isSavingGoalModalOpen()) {
        this.loadGoalData(goalId);
      } else if (this.goalForm && !this.modalService.isSavingGoalModalOpen()) {
        this.goalForm.reset(this.defaultValues());
        this.isEditMode.set(false);
      }
    });
  }

  ngOnInit() {
    this.goalForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: [null],
      target_amount: [null, [Validators.required, Validators.min(1)]],
      currency: ['MXN'],
      annual_rate_pct: [0, [Validators.min(0), Validators.max(100)]],
      compounding_frequency: ['monthly', Validators.required],
      target_date: [null],
      icon: ['savings'],
      color: ['#47EAED'],
      status: ['active'],
    });
  }

  private defaultValues() {
    return { name: '', description: null, target_amount: null, currency: 'MXN', annual_rate_pct: 0, compounding_frequency: 'monthly', target_date: null, icon: '💰', color: '#47EAED', status: 'active' };
  }

  private loadGoalData(id: string) {
    this.isEditMode.set(true);
    this.financeService.getSavings().subscribe({
      next: (goals) => {
        const goal = goals.find(g => g.id === id);
        if (goal) this.goalForm.patchValue(goal);
      }
    });
  }

  selectIcon(icon: string) { this.goalForm.patchValue({ icon }); }
  selectColor(color: string) { this.goalForm.patchValue({ color }); }

  close() { this.modalService.closeSavingGoalModal(); }

  onSubmit() {
    if (this.goalForm.invalid) { this.goalForm.markAllAsTouched(); return; }
    this.isLoading.set(true);
    const data = { ...this.goalForm.value };
    if (!data.target_date) delete data.target_date;
    if (!data.description) delete data.description;

    const goalId = this.modalService.selectedSavingGoalId();
    const request$ = this.isEditMode() && goalId
      ? this.financeService.updateSavingGoal(goalId, data)
      : this.financeService.createSavingGoal(data);

    request$.subscribe({
      next: () => {
        this.alertService.success('¡Listo!', this.isEditMode() ? 'Meta actualizada.' : 'Meta de ahorro creada.');
        this.refreshService.triggerRefresh();
        this.isLoading.set(false);
        this.close();
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.detail?.message ?? 'Ocurrió un error. Intenta de nuevo.';
        this.alertService.error('No se pudo guardar', msg);
      }
    });
  }
}
