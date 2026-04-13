import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Inyectamos nuestro servicio de autenticación
  const authService = inject(AuthService);
  
  // 2. Extraemos el token actual de nuestro Signal
  const token = authService.currentToken();

  // 3. Si existe un token, "clonamos" la petición original y le inyectamos la credencial
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Dejamos que la petición siga su camino, pero ahora va "armada" con el Token
    return next(clonedRequest);
  }

  // Si no hay token (ej. el usuario apenas va a iniciar sesión), la dejamos pasar normal
  return next(req);
};
