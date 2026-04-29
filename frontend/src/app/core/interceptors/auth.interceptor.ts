import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap } from 'rxjs/operators';
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
      // Evitar bucle infinito si el error 401 viene del endpoint de refresh o login
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
        console.warn('Token expirado. Intentando refrescar sesión...');
        
        return authService.refreshToken().pipe(
          switchMap((res) => {
            // Reintentar la petición original con el nuevo token
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${res.access_token}` }
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => {
            console.error('Refresh token expirado o inválido. Cerrando sesión automáticamente...');
            authService.logout();
            router.navigate(['/auth/login']);
            return throwError(() => refreshErr);
          })
        );
      }
      
      // Si el servidor responde 401 en login o refresh, o si es otro error
      if (error.status === 401 && req.url.includes('/auth/refresh')) {
        authService.logout();
        router.navigate(['/auth/login']);
      }
      
      return throwError(() => error);
    })
  );
};
