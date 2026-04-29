import { Component, inject, signal, effect, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { TransactionModalComponent } from '../transaction-modal/transaction-modal.component';
import { CardModalComponent } from '../card-modal/card-modal.component';
import { SavingGoalModalComponent } from '../saving-goal-modal/saving-goal-modal.component';
import { SavingTxModalComponent } from '../saving-tx-modal/saving-tx-modal.component';
import { CoupleTxModalComponent } from '../couple-tx-modal/couple-tx-modal.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TransactionModalComponent, CardModalComponent, SavingGoalModalComponent, SavingTxModalComponent, CoupleTxModalComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private router = inject(Router);

  // Signal para controlar el sidebar en móviles
  public isSidebarOpen = signal<boolean>(false);

  constructor() {
    // Cerrar el sidebar automáticamente al navegar (solo en móviles)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeSidebar();
    });
  }

  // Getter para usar en el template
  get isModalOpen() {
    return this.modalService.isTransactionModalOpen();
  }

  get currentUser() {
    return this.authService.currentUser;
  }

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  openTransactionModal() {
    this.modalService.openTransactionModal();
    this.closeSidebar(); // Cerramos el sidebar si se abre el modal
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
