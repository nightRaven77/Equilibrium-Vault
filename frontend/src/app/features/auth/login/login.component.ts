import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService); // <-- 1. Inyectamos nuestro servicio
  private router = inject(Router);          // <-- 2. Inyectamos el enrutador para cambiar de página
  
  hidePassword = signal(true);
  isLoading = signal(false);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading.set(true); // Cambiamos estado visual a "cargando..."
      
      const { email, password } = this.loginForm.value;
      
      // 3. Llamamos al servicio real y nos "suscribimos" a su respuesta
      this.authService.login(email!, password!).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          console.log('Login real exitoso con Token:', response.access_token);
          // 4. Si es exitoso, navegamos al Dashboard
          this.router.navigate(['/dashboard']); 
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Error al iniciar sesión', err);
          alert('Credenciales incorrectas o error de servidor');
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
