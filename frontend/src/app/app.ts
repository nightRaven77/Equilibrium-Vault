import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `,
  styles: [],
})
export class App implements OnInit {
  protected readonly title = signal('frontend');
  private swUpdate = inject(SwUpdate);

  ngOnInit() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          if (confirm('Una nueva versión de la aplicación está disponible. ¿Deseas recargar la página para actualizar?')) {
            window.location.reload();
          }
        });
    }
  }
}
