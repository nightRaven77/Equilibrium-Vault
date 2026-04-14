import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { NotFoundComponent } from './core/components/not-found/not-found.component';
import { CreditCardsComponent } from './features/credit-cards/credit-cards.component';
import { SavingsComponent } from './features/savings/savings.component';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  { path: 'auth/login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard], // <-- Aquí aplicamos el Guardián a esta ruta
  },
  {
    path: 'credit-cards',
    component: CreditCardsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'savings',
    component: SavingsComponent,
    canActivate: [authGuard],
  },
  {
    path: '**',
    component: NotFoundComponent
  }
];
