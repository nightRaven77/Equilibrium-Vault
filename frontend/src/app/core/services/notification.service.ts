import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { AlertService } from './alert.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private swPush = inject(SwPush, { optional: true });
  private alertService = inject(AlertService);

  public isSupported = signal<boolean>(
    typeof window !== 'undefined' && 'Notification' in window
  );

  public permission = signal<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );

  constructor() {
    this.checkPermissionStatus();
  }

  private checkPermissionStatus() {
    if (this.isSupported()) {
      this.permission.set(Notification.permission);
    }
  }

  /**
   * Solicita permiso al usuario para enviar notificaciones web push y locales
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      this.alertService.show(
        'warning',
        'Tu navegador no soporta notificaciones nativas o Web Push.'
      );
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission.set(permission);

      if (permission === 'granted') {
        this.alertService.show(
          'success',
          '¡Notificaciones activadas! Recibirás alertas sobre cortes de tarjetas y vencimientos.'
        );
        this.showLocalNotification('Equilibrium Vault', {
          body: 'Notificaciones configuradas exitosamente.',
          icon: '/favicon-48x48.png',
        });
        return true;
      } else {
        this.alertService.show(
          'info',
          'Permiso de notificaciones denegado. Puedes cambiarlo en los ajustes de tu navegador.'
        );
        return false;
      }
    } catch (e) {
      console.error('Error al solicitar permisos de notificación:', e);
      return false;
    }
  }

  /**
   * Muestra una notificación local a través del Service Worker o la API de Notification
   */
  async showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.isSupported() || this.permission() !== 'granted') {
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/favicon-48x48.png',
          badge: '/favicon-16x16.png',
          ...options,
        });
      } else {
        new Notification(title, {
          icon: '/favicon-48x48.png',
          ...options,
        });
      }
    } catch (e) {
      console.error('Error mostrando notificación local:', e);
    }
  }
}
