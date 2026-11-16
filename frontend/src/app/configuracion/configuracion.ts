import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ApiService } from '../services/api.service';
import { TARIFAS_MENSUALES } from '../models/vehiculo';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
})
export class Configuracion {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly status = signal<'cargando' | 'disponible' | 'error'>('cargando');
  protected readonly checkedAt = signal('');
  protected readonly tarifas = [
    { tipo: 'Moto', value: TARIFAS_MENSUALES.MOTO },
    { tipo: 'Automóvil', value: TARIFAS_MENSUALES.AUTOMOVIL },
    { tipo: 'Camioneta', value: TARIFAS_MENSUALES.CAMIONETA },
  ];

  constructor() { this.checkStatus(); }

  protected checkStatus(): void {
    this.status.set('cargando');
    forkJoin({ health: this.api.health(), dashboard: this.api.dashboardSummary() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ health }) => {
          this.status.set(health?.status === 'ok' ? 'disponible' : 'error');
          this.checkedAt.set(new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date()));
        },
        error: () => this.status.set('error'),
      });
  }

  protected cop(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  }
}
