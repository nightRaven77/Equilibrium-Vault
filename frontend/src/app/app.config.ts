import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // <-- Encendemos el motor HTTP global y le añadimos nuestro interceptor
    provideHttpClient(withInterceptors([authInterceptor])), 
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    provideEchartsCore({ echarts })
  ]
};
