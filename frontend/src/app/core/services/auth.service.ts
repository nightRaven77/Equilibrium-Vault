import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

// Aquí definimos qué forma de datos esperamos recibir del Backend (FastAPI).
// dicho de otra forma el dto del response que recibe del endpoint /auth/login
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user?: any;
}

/**
 * @Injectable le dice a Angular que esta clase es un SERVICIO.
 * 'providedIn: root' significa que esta herramienta existe de manera global en la app (Patrón Singleton).
 * Cualquier componente puede pedirla sin necesidad de crear una nueva instancia.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // inject() es la forma moderna en Angular de pedir dependencias. Aquí pedimos el cliente HTTP.
  //en palaras sencillas es la creación del objeto http para hacer peticiones al backend
  private http = inject(HttpClient);

  // Ahora tomamos la URL base de nuestro archivo de configuración global
  private apiUrl = `${environment.apiUrl}/auth`;

  // 'Signals': Esta es una memoria reactiva global. Toda la app sabrá si este valor cambia.
  public currentToken = signal<string | null>(null);

  constructor() {
    // Cuando el servicio "nace" (cuando abrimos la app), buscamos si ya había un token guardado en el navegador
    const savedToken = localStorage.getItem('supabase_token');
    if (savedToken) {
      this.currentToken.set(savedToken);
    }
  }

  /**
   * Método de Login
   * Se comunica con nuestro Backend por POST enviando las credenciales.
   */
  login(email: string, password: string): Observable<LoginResponse> {

    //Creamos el objeto con los campos necesarios para el envio de los datos
    const requestBody = {
      email: email,
      password: password
    };

    //hacemos la peticion al backend
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, requestBody).pipe(
      tap((response) => {
        // El 'tap' nos permite interceptar la respuesta y hacer algo con ella localemente antes de regresarla al componente
        if (response.access_token) {
          // Guardamos el token en nuestro Signal reactivo para que la app reaccione instantáneamente
          this.currentToken.set(response.access_token);
          // Y lo guardamos en la memoria del navegador para que no se borre si damos F5
          localStorage.setItem('supabase_token', response.access_token);
        }
      })
    );
  }

  logout() {
    this.currentToken.set(null);
    localStorage.removeItem('supabase_token');
  }
}
