import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si existe un token válido en nuestro "bolsillo" (Signal), dejamos pasar.
  if (authService.currentToken()) {
    return true;
  }

  // Si no está autorizado, lo devolvemos obligatoriamente a la página de login
  return router.createUrlTree(['/auth/login']);
};
