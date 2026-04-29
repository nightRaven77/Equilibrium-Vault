import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { NotFoundComponent } from './core/components/not-found/not-found.component';
import { CreditCardsComponent } from './features/credit-cards/credit-cards.component';
import { SavingsComponent } from './features/savings/savings.component';
import { CouplesComponent } from './features/couples/couples.component';
import { RecurringComponent } from './features/recurring/recurring.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { LayoutComponent } from './core/components/layout/layout.component';
import { ProfileComponent } from './features/profile/profile.component';

export const routes: Routes = [
  // 1. Redirección inicial limpia
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // 2. Rutas públicas de acceso
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },

  // 3. Cascarón principal protegido (Layout + Sidebar + Topbar)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'credit-cards', component: CreditCardsComponent },
      { path: 'savings', component: SavingsComponent },
      { path: 'couples', component: CouplesComponent },
      { path: 'recurring', component: RecurringComponent },
      { path: 'calendar', component: CalendarComponent },
      { path: 'transactions', component: TransactionsComponent },
      { path: 'profile', component: ProfileComponent },
      
      // Si el usuario está logueado pero la ruta no existe, la ve DENTRO del layout
      { path: '**', component: NotFoundComponent },
    ],
  },

  // 4. Catch-all de seguridad para usuarios no logueados
  { path: '**', redirectTo: '/auth/login' },
];
