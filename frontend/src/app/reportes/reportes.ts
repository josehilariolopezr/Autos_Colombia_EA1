import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { DashboardResumen } from '../models/dashboard';
import { EstanciaReciente } from '../models/estancia';
import { ApiService } from '../services/api.service';
import { EstanciasService } from '../services/estancias.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private readonly api = inject(ApiService);
  private readonly staysApi = inject(EstanciasService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly summary = signal<DashboardResumen | null>(null);
  protected readonly stays = signal<EstanciaReciente[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  constructor() { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ summary: this.api.dashboardSummary(), stays: this.staysApi.recientes(20) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (data) => { this.summary.set(data.summary); this.stays.set(data.stays); this.loading.set(false); },
        error: () => { this.loading.set(false); this.error.set('No se pudieron consultar los reportes. Verifica la API y la base de datos.'); },
      });
  }

  protected cop(value: number | null): string {
    return value === null ? '—' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value));
  }
}
