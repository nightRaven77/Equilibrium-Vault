import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  public currentToken = signal<string | null>(null);
  public currentUser = signal<UserProfile | null>(null);

  constructor() {
    const savedToken = localStorage.getItem('supabase_token');
    const savedUser = localStorage.getItem('supabase_user');
    if (savedToken) this.currentToken.set(savedToken);
    if (savedUser) {
      try { this.currentUser.set(JSON.parse(savedUser)); } catch { }
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res) => this._persistSession(res))
    );
  }

  register(email: string, password: string, fullName: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register`, {
      email, password, full_name: fullName
    }).pipe(
      tap((res) => { if (res.access_token) this._persistSession(res); })
    );
  }

  private _persistSession(res: LoginResponse) {
    if (!res.access_token) return;
    const profile: UserProfile = {
      id: res.user_id,
      email: res.email,
      full_name: res.full_name ?? null,
      avatar_url: res.avatar_url ?? null,
    };
    this.currentToken.set(res.access_token);
    this.currentUser.set(profile);
    localStorage.setItem('supabase_token', res.access_token);
    localStorage.setItem('supabase_user', JSON.stringify(profile));
  }

  logout() {
    this.currentToken.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }
}
