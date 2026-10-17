import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Inyectamos nuestro servicio de autenticación y el router
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // 2. Extraemos el token actual de nuestro Signal
  const token = authService.currentToken();

  // 3. Si existe un token, "clonamos" la petición original y le inyectamos la credencial
  let clonedRequest = req;
  if (token) {
    clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Dejamos que la petición siga su camino, pero interceptamos posibles errores
  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // 1. Si el 401 proviene del endpoint de login o de refresh, cerramos sesión inmediatamente sin reintentar
      if (error.status === 401 && (req.url.includes('/auth/login') || req.url.includes('/auth/refresh'))) {
        authService.logout();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      // 2. Si es cualquier otro 401 (token expirado), delegamos al mutex concurrente de AuthService
      if (error.status === 401) {
        return authService.handleTokenRefresh(req, next).pipe(
          catchError((refreshErr) => {
            router.navigate(['/auth/login']);
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
