import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

// Aquí definimos qué forma de datos esperamos recibir del Backend (FastAPI).
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string; // ID único del usuario en Supabase
  email: string;
}

export interface UserProfile {
  id: string;
  email: string;
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
  public currentUser = signal<UserProfile | null>(null);

  constructor() {
    // Cuando el servicio "nace" (cuando abrimos la app), buscamos si ya había un token guardado en el navegador
    const savedToken = localStorage.getItem('supabase_token');
    const savedUser = localStorage.getItem('supabase_user');
    
    if (savedToken) {
      this.currentToken.set(savedToken);
    }
    if (savedUser) {
      this.currentUser.set(JSON.parse(savedUser));
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
          const userProfile: UserProfile = {
            id: response.user_id,
            email: response.email
          };

          // Guardamos el token y perfil en nuestros Signals reactivos
          this.currentToken.set(response.access_token);
          this.currentUser.set(userProfile);

          // Y lo guardamos en la memoria del navegador para que no se borre si damos F5
          localStorage.setItem('supabase_token', response.access_token);
          localStorage.setItem('supabase_user', JSON.stringify(userProfile));
        }
      })
    );
  }

  logout() {
    this.currentToken.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }
}
