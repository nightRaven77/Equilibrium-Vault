import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { FinanceService } from '../../services/finance.service';
import { RefreshService } from '../../services/refresh.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-card-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './card-modal.component.html',
})
export class CardModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);
  private alertService = inject(AlertService);
  public modalService = inject(ModalService);

  public cardForm!: FormGroup;
  public isLoading = signal<boolean>(false);
  public isEditMode = signal<boolean>(false);

  constructor() {
    // Reaccionar cuando se abre el modal para cargar datos si es edición
    effect(() => {
      const cardId = this.modalService.selectedCardId();
      if (cardId && this.modalService.isCardModalOpen()) {
        this.loadCardData(cardId);
      } else if (this.cardForm) {
        this.cardForm.reset(this.getEmptyFormData());
        this.isEditMode.set(false);
      }
    });
  }

  ngOnInit() {
    this.initForm();
  }

  private initForm() {
    this.cardForm = this.fb.group({
      bank_name: ['', [Validators.required, Validators.maxLength(50)]],
      alias: ['', [Validators.maxLength(50)]],
      last_four: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      credit_limit: [null, [Validators.required, Validators.min(1)]],
      cutoff_day: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      payment_due_days: [20, [Validators.required, Validators.min(1), Validators.max(60)]],
      min_payment_pct: [5, [Validators.required, Validators.min(0), Validators.max(100)]],
      annual_rate_pct: [0, [Validators.required, Validators.min(0)]],
      is_active: [true],
    });
  }

  private getEmptyFormData() {
    return {
      bank_name: '',
      alias: '',
      last_four: '',
      credit_limit: null,
      cutoff_day: 1,
      payment_due_days: 20,
      min_payment_pct: 5,
      annual_rate_pct: 0,
      is_active: true,
    };
  }

  private loadCardData(id: string) {
    this.isLoading.set(true);
    this.isEditMode.set(true);
    this.financeService.getCreditCards().subscribe({
      next: (cards) => {
        const card = cards.find(c => c.id === id);
        if (card) {
          this.cardForm.patchValue(card);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading card:', err);
        this.isLoading.set(false);
      }
    });
  }

  close() {
    this.modalService.closeCardModal();
  }

  onSubmit() {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const cardId = this.modalService.selectedCardId();
    const data = this.cardForm.value;

    if (this.isEditMode() && cardId) {
      this.financeService.updateCreditCard(cardId, data).subscribe({
        next: () => this.handleSuccess(),
        error: (err) => this.handleError(err),
      });
    } else {
      this.financeService.createCreditCard(data).subscribe({
        next: () => this.handleSuccess(),
        error: (err) => this.handleError(err),
      });
    }
  }

  private handleSuccess(message = 'Los cambios han sido guardados correctamente.') {
    this.isLoading.set(false);
    this.refreshService.triggerRefresh();
    this.alertService.success('¡Listo!', message);
    this.close();
  }

  private handleError(err: any) {
    this.isLoading.set(false);
    console.error('Error saving card:', err);
    
    if (err.status === 400 && err.error && err.error.detail && err.error.detail.message) {
      this.alertService.error('No se pudo guardar', err.error.detail.message);
    } else {
      this.alertService.error('Error inesperado', 'Ocurrió un error al guardar la tarjeta. Por favor, intenta de nuevo.');
    }
  }

  deleteCard() {
    const cardId = this.modalService.selectedCardId();
    if (!cardId) return;
    
    this.alertService.confirm(
      '¿Eliminar tarjeta?',
      'Esta acción ocultará la tarjeta permanentemente.'
    ).then(result => {
      if (!result.isConfirmed) return;
      
      this.isLoading.set(true);
      this.financeService.deleteCreditCard(cardId).subscribe({
        next: () => this.handleSuccess('La tarjeta ha sido eliminada.'),
        error: (err) => {
          console.error('Error deleting card:', err);
          if (err.status === 404 || err.status === 204 || err.status === 200) {
            this.handleSuccess('La tarjeta ha sido eliminada.');
          } else {
            this.isLoading.set(false);
            const message = err.error?.detail?.message ?? 'Ocurrió un error inesperado.';
            this.alertService.error('No se pudo eliminar', message);
          }
        },
      });
    });
  }
}
