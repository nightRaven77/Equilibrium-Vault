import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private alertService = inject(AlertService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  public user = this.authService.currentUser;

  public isUploading = signal(false);
  public isUpdatingName = signal(false);
  public isUpdatingPassword = signal(false);

  public nameForm = this.fb.group({
    fullName: [this.user()?.full_name || '', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]]
  });

  public passwordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.alertService.warning('Formato inválido', 'Por favor selecciona una imagen válida.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.alertService.warning('Archivo muy grande', 'La imagen no debe superar los 5MB.');
      return;
    }

    this.isUploading.set(true);
    this.authService.uploadAvatar(file).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        this.alertService.success('Avatar actualizado', res.message);
      },
      error: (err) => {
        this.isUploading.set(false);
        const msg = err.error?.detail ?? 'Error al subir el avatar';
        this.alertService.error('Error', msg);
      }
    });
  }

  updateName() {
    if (this.nameForm.invalid) return;
    this.isUpdatingName.set(true);
    const newName = this.nameForm.value.fullName!;

    this.authService.updateProfile(newName).subscribe({
      next: (res) => {
        this.isUpdatingName.set(false);
        this.alertService.success('Nombre actualizado', res.message);
      },
      error: (err) => {
        this.isUpdatingName.set(false);
        const msg = err.error?.detail ?? 'Error al actualizar el nombre';
        this.alertService.error('Error', msg);
      }
    });
  }

  updatePassword() {
    if (this.passwordForm.invalid) return;
    this.isUpdatingPassword.set(true);
    const newPassword = this.passwordForm.value.password!;

    this.authService.updatePassword(newPassword).subscribe({
      next: (res) => {
        this.isUpdatingPassword.set(false);
        this.passwordForm.reset();
        this.alertService.success('Contraseña actualizada', res.message);
      },
      error: (err) => {
        this.isUpdatingPassword.set(false);
        const msg = err.error?.detail ?? 'Error al actualizar la contraseña';
        this.alertService.error('Error', msg);
      }
    });
  }
}
