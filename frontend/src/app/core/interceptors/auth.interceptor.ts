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
      // Si el servidor responde que no estamos autorizados (token expirado/inválido)
      if (error.status === 401) {
        console.warn('Token expirado o inválido. Cerrando sesión automáticamente...');
        authService.logout();
        router.navigate(['/auth/login']);
      }
      // Repropagamos el error por si algún componente necesita manejarlo
      return throwError(() => error);
    })
  );
};
