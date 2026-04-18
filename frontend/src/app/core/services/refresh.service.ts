import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  /**
   * Un simple contador que se incrementa cada vez que queremos que la app
   * refresque sus datos de la API.
   */
  private _refreshTrigger = signal<number>(0);
  public refreshTrigger = this._refreshTrigger.asReadonly();

  /**
   * Llama a esto después de crear, actualizar o eliminar datos significativos.
   */
  triggerRefresh() {
    this._refreshTrigger.update(val => val + 1);
  }
}
