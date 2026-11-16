import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { EMPTY, expand, reduce } from 'rxjs';
import { ApiService } from '../services/api.service';
import { CeldasService } from '../services/celdas.service';
import { Celda, CeldaActualizar, CeldaCrear } from '../models/celda';
import { DashboardResumen } from '../models/dashboard';
import { ErrorApi } from '../models/vehiculo';

const nonBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };
type Field = 'codigo' | 'tipo';
type ZoneFilter = 'TODAS' | 'A' | 'M' | 'P';
type StateFilter = 'TODAS' | 'LIBRE' | 'OCUPADA' | 'MANTENIMIENTO';

@Component({
  selector: 'app-celdas',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './celdas.html',
  styleUrl: './celdas.css',
})
export class Celdas {
  private readonly api = inject(CeldasService);
  private readonly dashboardApi = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.group({
    codigo: this.fb.nonNullable.control('', nonBlank),
    tipo: this.fb.nonNullable.control('', nonBlank),
    estado: this.fb.nonNullable.control<'ACTIVA' | 'MANTENIMIENTO'>('ACTIVA'),
  });
  readonly vehicleTypes = ['AUTOMOVIL', 'MOTO', 'CAMIONETA'] as const;
  readonly items = signal<Celda[]>([]);
  readonly celdas = this.items;
  readonly total = computed(() => this.items().length);
  readonly busquedaCodigo = signal('');
  readonly filtroZona = signal<ZoneFilter>('TODAS');
  readonly filtroEstado = signal<StateFilter>('TODAS');
  readonly currentPage = signal(1);
  readonly limit = 10;
  readonly inventoryLimit = 100;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly busy = computed(() => this.loading() || this.saving());
  readonly showForm = signal(false);
  readonly editing = signal<number | null>(null);
  readonly dashboard = signal<DashboardResumen | null>(null);
  readonly occupancyLoading = signal(true);
  readonly listError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly activeCount = computed(() => this.items().filter((cell) => cell.estado === 'ACTIVA').length);
  readonly maintenanceCount = computed(() => this.items().filter((cell) => cell.estado === 'MANTENIMIENTO').length);
  readonly occupiedCount = computed(() => this.dashboard()?.celdas_ocupadas ?? null);
  readonly celdasFiltradas = computed(() => {
    const query = this.busquedaCodigo().trim().toLocaleUpperCase('es-CO');
    const selectedZone = this.filtroZona();
    const selectedState = this.filtroEstado();
    return this.celdas().filter((cell) => {
      const code = cell.codigo.toLocaleUpperCase('es-CO');
      const matchesSearch = !query || code.includes(query);
      const matchesZone = selectedZone === 'TODAS' || this.zone(cell) === selectedZone;
      const matchesState = selectedState === 'TODAS' || this.estadoParaFiltro(cell) === selectedState;
      return matchesSearch && matchesZone && matchesState;
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.celdasFiltradas().length / this.limit)));
  readonly celdasPaginadas = computed(() => {
    const start = (this.currentPage() - 1) * this.limit;
    return this.celdasFiltradas().slice(start, start + this.limit);
  });
  readonly filteredItems = this.celdasFiltradas;
  readonly visibleItems = this.celdasPaginadas;
  readonly visibleStart = computed(() => this.celdasFiltradas().length ? (this.currentPage() - 1) * this.limit + 1 : 0);
  readonly visibleEnd = computed(() => Math.min(this.currentPage() * this.limit, this.celdasFiltradas().length));
  readonly page = this.currentPage;
  readonly pages = this.totalPages;

  constructor() {
    this.load();
    this.loadDashboard();
  }

  load(): void {
    if (this.busy()) return;
    this.loading.set(true);
    this.listError.set('');
    this.api
      .list(0, this.inventoryLimit)
      .pipe(
        expand((page) => page.items.length > 0 && page.offset + page.items.length < page.total
          ? this.api.list(page.offset + page.items.length, this.inventoryLimit)
          : EMPTY),
        reduce((all, page) => all.concat(page.items), [] as Celda[]),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (cells) => {
          this.items.set(cells);
          this.currentPage.set(1);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.listError.set(this.errorMessage(error));
        },
      });
  }

  loadDashboard(): void {
    this.occupancyLoading.set(true);
    this.dashboardApi
      .dashboardSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.dashboard.set(summary);
          this.occupancyLoading.set(false);
        },
        error: () => {
          this.dashboard.set(null);
          this.occupancyLoading.set(false);
        },
      });
  }

  actualizarBusqueda(valor: string): void {
    this.busquedaCodigo.set(valor);
    this.currentPage.set(1);
  }

  seleccionarZona(zona: ZoneFilter): void {
    this.filtroZona.set(zona);
    this.currentPage.set(1);
  }

  seleccionarEstado(estado: StateFilter): void {
    this.filtroEstado.set(estado);
    this.currentPage.set(1);
  }

  limpiarFiltros(): void {
    this.busquedaCodigo.set('');
    this.filtroZona.set('TODAS');
    this.filtroEstado.set('TODAS');
    this.currentPage.set(1);
  }

  get filtrosActivos(): boolean {
    return !!this.busquedaCodigo().trim()
      || this.filtroZona() !== 'TODAS'
      || this.filtroEstado() !== 'TODAS';
  }

  cambiarPagina(direccion: -1 | 1): void {
    const pagina = this.currentPage() + direccion;
    if (pagina >= 1 && pagina <= this.totalPages()) this.currentPage.set(pagina);
  }

  zone(cell: Celda): string {
    const prefix = cell.codigo.split('-', 1)[0]?.toUpperCase();
    return prefix === 'A' || prefix === 'M' || prefix === 'P' ? prefix : 'OTRA';
  }

  private estadoParaFiltro(cell: Celda): StateFilter | null {
    if (cell.estado === 'MANTENIMIENTO') return 'MANTENIMIENTO';
    const status = this.dashboard()?.celdas.find((item) => item.codigo === cell.codigo)?.estado;
    if (status === 'OCUPADA') return 'OCUPADA';
    if (status === 'DISPONIBLE') return 'LIBRE';
    return null;
  }

  occupancy(cell: Celda): 'Ocupada' | 'Disponible' | 'Inhabilitada' | '—' {
    if (cell.estado === 'MANTENIMIENTO') return 'Inhabilitada';
    const status = this.dashboard()?.celdas.find((item) => item.codigo === cell.codigo)?.estado;
    if (status === 'OCUPADA') return 'Ocupada';
    if (status === 'DISPONIBLE') return 'Disponible';
    return '—';
  }

  newCell(): void {
    if (this.busy()) return;
    this.form.reset({ codigo: '', tipo: '', estado: 'ACTIVA' });
    this.editing.set(null);
    this.showForm.set(true);
    this.actionError.set('');
    this.success.set('');
  }

  edit(cell: Celda): void {
    if (this.busy()) return;
    this.loading.set(true);
    this.actionError.set('');
    this.success.set('');
    this.api
      .get(cell.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.loading.set(false);
          this.editing.set(data.id);
          this.form.reset({ codigo: data.codigo, tipo: data.tipo, estado: data.estado });
          this.showForm.set(true);
        },
        error: (error) => {
          this.loading.set(false);
          this.actionError.set(this.errorMessage(error));
        },
      });
  }

  cancel(): void {
    if (this.saving()) return;
    this.showForm.set(false);
    this.actionError.set('');
  }

  fieldError(field: Field): string {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) return '';
    if (control.errors['server']) return String(control.errors['server']);
    if (control.errors['required']) return 'Este campo es obligatorio y no puede estar vacío.';
    return 'Revisa este campo.';
  }

  save(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.actionError.set('Revisa los campos señalados antes de guardar la celda.');
      return;
    }
    const value = this.form.getRawValue();
    const payload: CeldaCrear = {
      codigo: value.codigo.trim().toUpperCase(),
      tipo: value.tipo,
    };
    this.saving.set(true);
    this.actionError.set('');
    this.success.set('');
    const id = this.editing();
    const request = id === null
      ? this.api.create(payload)
      : this.api.update(id, { ...payload, estado: value.estado } satisfies CeldaActualizar);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (cell) => {
        this.saving.set(false);
        this.showForm.set(false);
        this.success.set(`Celda ${cell.codigo} ${id === null ? 'registrada' : 'actualizada'} correctamente.`);
        this.load();
        this.loadDashboard();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.actionError.set(error.status === 409 && value.estado === 'MANTENIMIENTO'
          ? 'No es posible pasar a mantenimiento una celda con vehículo estacionado. Cierra la estancia primero.'
          : this.errorMessage(error));
        const body = error.error as ErrorApi | null;
        if (error.status === 422 && Array.isArray(body?.detail)) {
          for (const issue of body.detail) {
            const field = issue.loc.at(-1);
            if (typeof field === 'string' && Object.hasOwn(this.form.controls, field)) {
              this.setFieldError(field as Field, 'El servicio rechazó este valor. Revisa el campo.');
            }
          }
        }
      },
    });
  }

  private setFieldError(field: Field, message: string): void {
    this.form.controls[field].setErrors({ server: message });
    this.form.controls[field].markAsTouched();
  }

  toggleMaintenance(cell: Celda): void {
    if (this.busy()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.success.set('');
    const enabled = cell.estado !== 'MANTENIMIENTO';
    this.api.setMaintenance(cell.id, enabled).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.success.set(`Celda ${updated.codigo} ${enabled ? 'puesta en mantenimiento' : 'habilitada'} correctamente.`);
        this.load();
        this.loadDashboard();
      },
      error: (error) => {
        this.saving.set(false);
        this.actionError.set(error.status === 409
          ? 'No es posible pasar a mantenimiento una celda con vehículo estacionado. Cierra la estancia primero.'
          : this.errorMessage(error));
      },
    });
  }

  private errorMessage(error: HttpErrorResponse): string {
    if (error.status === 404) return 'La celda ya no existe. Actualiza el listado.';
    if (error.status === 409) return 'La operación entra en conflicto con los datos existentes.';
    if (error.status === 422) return 'Revisa los datos: hay campos que no cumplen las validaciones.';
    return 'No se pudo conectar con el servicio. Comprueba la conexión y actualiza el listado antes de reintentar.';
  }
}
