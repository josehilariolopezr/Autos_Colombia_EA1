import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { CeldasService } from '../services/celdas.service';
import { Celda, CeldaActualizar, CeldaCrear } from '../models/celda';
import { DashboardResumen } from '../models/dashboard';
import { ErrorApi } from '../models/vehiculo';

const nonBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };
type Field = 'codigo' | 'tipo';
type CellFilter = 'TODAS' | 'A' | 'M' | 'P' | 'MANTENIMIENTO';

@Component({
  selector: 'app-celdas',
  imports: [ReactiveFormsModule],
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
  readonly total = computed(() => this.items().length);
  readonly offset = signal(0);
  readonly limit = 10;
  readonly inventoryLimit = 100;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly busy = computed(() => this.loading() || this.saving());
  readonly showForm = signal(false);
  readonly editing = signal<number | null>(null);
  readonly searchTerm = signal('');
  readonly filter = signal<CellFilter>('TODAS');
  readonly dashboard = signal<DashboardResumen | null>(null);
  readonly occupancyLoading = signal(true);
  readonly listError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly activeCount = computed(() => this.items().filter((cell) => cell.estado === 'ACTIVA').length);
  readonly maintenanceCount = computed(() => this.items().filter((cell) => cell.estado === 'MANTENIMIENTO').length);
  readonly occupiedCount = computed(() => this.dashboard()?.celdas_ocupadas ?? null);
  readonly filteredItems = computed(() => {
    const query = this.searchTerm().trim().toLocaleUpperCase('es-CO');
    const currentFilter = this.filter();
    return this.items().filter((cell) => {
      const code = cell.codigo.toLocaleUpperCase('es-CO');
      const matchesSearch = !query || code.includes(query);
      const matchesFilter = currentFilter === 'TODAS'
        || (currentFilter === 'MANTENIMIENTO' ? cell.estado === 'MANTENIMIENTO' : code.startsWith(`${currentFilter}-`));
      return matchesSearch && matchesFilter;
    });
  });
  readonly visibleItems = computed(() => this.filteredItems().slice(this.offset(), this.offset() + this.limit));
  readonly visibleStart = computed(() => this.filteredItems().length ? this.offset() + 1 : 0);
  readonly visibleEnd = computed(() => Math.min(this.offset() + this.limit, this.filteredItems().length));
  readonly page = computed(() => Math.floor(this.offset() / this.limit) + 1);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / this.limit)));

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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data.items);
          this.offset.set(0);
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

  setSearch(value: string): void {
    this.searchTerm.set(value);
    this.offset.set(0);
  }

  setFilter(value: CellFilter): void {
    this.filter.set(value);
    this.offset.set(0);
  }

  zone(cell: Celda): string {
    const prefix = cell.codigo.split('-', 1)[0]?.toUpperCase();
    return prefix === 'A' || prefix === 'M' || prefix === 'P' ? prefix : 'OTRA';
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
