import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#141414] flex items-center justify-center p-4 relative overflow-hidden">

      <!-- Background glow -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div class="w-full max-w-md relative z-10">

        <!-- Logo -->
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-container-low border border-outline-variant/20 mb-4">
            <span class="material-symbols-outlined text-primary text-2xl">account_balance</span>
          </div>
          <h1 class="text-3xl font-headline font-bold tracking-tighter text-on-surface">Equilibrium Vault</h1>
          <p class="text-[11px] font-label text-primary tracking-[0.3em] uppercase mt-1">Create your account</p>
        </div>

        <!-- Card -->
        <div class="bg-[#1C1B1B] border border-[#3B4949]/30 rounded-2xl p-8 shadow-2xl">
          <h2 class="text-xl font-headline font-bold text-on-surface mb-1">Registrarse</h2>
          <p class="text-xs text-on-surface-variant tracking-wide mb-8">
            ¿Ya tienes cuenta?
            <a routerLink="/auth/login" class="text-primary hover:underline ml-1">Inicia sesión</a>
          </p>

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-4">

            <!-- Full name -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Nombre completo *</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">person</span>
                <input formControlName="full_name" type="text" placeholder="Tu nombre"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"/>
              </div>
              @if (registerForm.get('full_name')?.invalid && registerForm.get('full_name')?.touched) {
                <p class="text-error text-[10px]">Mínimo 2 caracteres.</p>
              }
            </div>

            <!-- Email -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Email *</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">mail</span>
                <input formControlName="email" type="email" placeholder="tu@email.com"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"/>
              </div>
              @if (registerForm.get('email')?.invalid && registerForm.get('email')?.touched) {
                <p class="text-error text-[10px]">Email inválido.</p>
              }
            </div>

            <!-- Password -->
            <div class="space-y-1">
              <label class="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Contraseña *</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">lock</span>
                <input formControlName="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Mínimo 8 caracteres"
                  class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-10 pr-12 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"/>
                <button type="button" (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors">
                  <span class="material-symbols-outlined text-[18px]">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
              @if (registerForm.get('password')?.invalid && registerForm.get('password')?.touched) {
                <p class="text-error text-[10px]">Mínimo 8 caracteres.</p>
              }
            </div>

            <!-- Password strength indicator -->
            @if (registerForm.get('password')?.value) {
              <div class="space-y-1">
                <div class="flex gap-1">
                  @for (i of [0,1,2,3]; track i) {
                    <div class="flex-1 h-1 rounded-full transition-all duration-300"
                         [class]="i < passwordStrength() ? strengthColor() : 'bg-surface-container-highest'">
                    </div>
                  }
                </div>
                <p class="text-[9px] font-label" [class]="strengthTextColor()">
                  {{ strengthLabel() }}
                </p>
              </div>
            }

            <!-- Error message -->
            @if (errorMessage()) {
              <div class="p-3 bg-error/10 border border-error/20 rounded-lg">
                <p class="text-error text-xs">{{ errorMessage() }}</p>
              </div>
            }

            <!-- Submit -->
            <button type="submit" [disabled]="isLoading()"
              class="w-full py-3.5 mt-2 rounded-xl bg-primary text-on-primary font-label font-bold text-sm tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50 status-glow active:scale-95">
              {{ isLoading() ? 'Creando cuenta...' : 'Crear Cuenta' }}
            </button>

          </form>
        </div>

        <!-- Footer -->
        <p class="text-center text-[10px] text-on-surface-variant/40 mt-6 tracking-widest uppercase">
          Equilibrium Vault · Financial Intelligence
        </p>
      </div>
    </div>
  `
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

  registerForm = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  passwordStrength() {
    const pw = this.registerForm.get('password')?.value ?? '';
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  strengthColor() {
    const s = this.passwordStrength();
    if (s <= 1) return 'bg-error';
    if (s === 2) return 'bg-[#ffb876]';
    if (s === 3) return 'bg-primary/60';
    return 'bg-primary';
  }

  strengthTextColor() {
    const s = this.passwordStrength();
    if (s <= 1) return 'text-error';
    if (s === 2) return 'text-[#ffb876]';
    return 'text-primary';
  }

  strengthLabel() {
    const s = this.passwordStrength();
    if (s <= 1) return 'Contraseña débil';
    if (s === 2) return 'Contraseña regular';
    if (s === 3) return 'Contraseña buena';
    return '✓ Contraseña fuerte';
  }

  onSubmit() {
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }
    this.isLoading.set(true);
    this.errorMessage.set('');
    const { email, password, full_name } = this.registerForm.value;

    this.authService.register(email!, password!, full_name!).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.access_token) {
          this.router.navigate(['/dashboard']);
        } else {
          // Confirmación de email requerida
          this.errorMessage.set('Cuenta creada. Revisa tu email para confirmar tu cuenta antes de iniciar sesión.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.detail?.message ?? err.error?.detail ?? 'Error al crear la cuenta.';
        this.errorMessage.set(msg);
      }
    });
  }
}
