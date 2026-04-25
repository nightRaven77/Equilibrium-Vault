import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

// ─────────────────────────────────────────────
//  Instancia base con el tema Obsidian
// ─────────────────────────────────────────────
const ObsidianAlert = Swal.mixin({
  background: '#1C1B1B',
  color: '#E6E0E9',
  confirmButtonColor: '#47EAED',
  cancelButtonColor: 'rgba(255,255,255,0.08)',
  customClass: {
    popup: 'obsidian-popup',
    confirmButton: 'obsidian-btn-confirm',
    cancelButton: 'obsidian-btn-cancel',
  },
});

// Instancia de Toast (no bloquea la UI)
const ObsidianToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  background: '#2B2A2A',
  color: '#E6E0E9',
  customClass: {
    popup: 'obsidian-toast',
  },
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  /** Toast verde de confirmación */
  success(title: string, text?: string) {
    ObsidianToast.fire({ icon: 'success', title, text });
  }

  /** Toast rojo de error */
  error(title: string, text?: string) {
    ObsidianToast.fire({ icon: 'error', title, text, timer: 5000 });
  }

  /** Toast amarillo de advertencia */
  warning(title: string, text?: string) {
    ObsidianToast.fire({ icon: 'warning', title, text });
  }

  /** Toast azul informativo */
  info(title: string, text?: string) {
    ObsidianToast.fire({ icon: 'info', title, text });
  }

  /** Modal de confirmación destructiva (eliminar, etc.) */
  confirm(title: string, text: string, confirmText = 'Sí, eliminar'): Promise<SweetAlertResult> {
    return ObsidianAlert.fire({
      icon: 'warning',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
  }

  /** Modal de decisión con acción adicional (ej. redirigir a otra sección) */
  decision(title: string, text: string, confirmText: string, cancelText: string): Promise<SweetAlertResult> {
    return ObsidianAlert.fire({
      icon: 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
    });
  }
}
