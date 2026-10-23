import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardCelda, DashboardResumen } from '../models/dashboard';
import { createDemoDashboard } from '../demo-dashboard';
import { ApiService } from '../services/api.service';

type CellFilter = 'TODAS' | 'LIBRES' | 'OCUPADAS' | 'MENSUALIDAD';
type ZoneFilter = 'TODAS' | 'A' | 'M' | 'P' | 'OTRA';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly summary = signal<DashboardResumen | null>(null);
  protected readonly demoMode = signal(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly showAll = signal(false);
  protected readonly filter = signal<CellFilter>('TODAS');
  protected readonly zone = signal<ZoneFilter>('TODAS');

  protected readonly filteredCells = computed(() => {
    const cells = this.summary()?.celdas ?? [];
    const filter = this.filter();
    const zone = this.zone();
    return cells.filter((cell) => {
      const matchesFilter = filter === 'TODAS'
        || (filter === 'LIBRES' && cell.estado === 'DISPONIBLE')
        || (filter === 'OCUPADAS' && cell.estado === 'OCUPADA' && cell.mensualidad !== true)
        || (filter === 'MENSUALIDAD' && cell.mensualidad === true);
      return matchesFilter && (zone === 'TODAS' || cell.zona === zone);
    });
  });
  protected readonly visibleCells = computed(() =>
    this.showAll() ? this.filteredCells() : this.filteredCells().slice(0, 18),
  );
  protected readonly freeCount = computed(() => this.summary()?.celdas_disponibles ?? 0);
  protected readonly occupiedCount = computed(() => {
    const data = this.summary();
    return data ? data.celdas_ocupadas - (data.mensualidades_activas ?? 0) : 0;
  });
  protected readonly monthlyCount = computed(() => this.summary()?.mensualidades_activas);
  protected readonly percentAvailable = computed(() => {
    const data = this.summary();
    return data?.total_celdas ? Math.round((data.celdas_disponibles / data.total_celdas) * 100) : 0;
  });
  protected readonly countLabel = computed(() =>
    `Mostrando ${this.visibleCells().length} de ${this.filteredCells().length} celdas`,
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    if (this.demoMode()) {
      this.summary.set(createDemoDashboard());
      this.loading.set(false);
      return;
    }
    this.api.dashboardSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.summary.set(data); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  protected setFilter(filter: CellFilter): void {
    this.filter.set(filter);
    this.showAll.set(false);
  }

  protected setZone(value: string): void {
    this.zone.set(value as ZoneFilter);
    this.showAll.set(false);
  }

  protected progressWidth(): number {
    return this.percentAvailable();
  }

  protected readonly entryTime = (value: string | null): string => value
    ? new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(value))
    : '';

  protected readonly variationText = (value: number): string => value > 0
    ? 'más que ayer'
    : value < 0 ? 'menos que ayer' : 'igual que ayer';

  protected readonly currency = (value: number | null): string => value === null
    ? 'Por configurar'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

  protected readonly duration = (cell: DashboardCelda): string =>
    cell.entrada ? this.entryTime(cell.entrada) : 'En parqueadero';
}
