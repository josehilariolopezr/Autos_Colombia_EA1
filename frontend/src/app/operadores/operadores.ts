import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { EMPTY, expand, reduce } from 'rxjs';
import { OperadoresService } from '../services/operadores.service';
import { Operador, OperadorActualizar, OperadorCrear } from '../models/operador';
import { ErrorApi } from '../models/vehiculo';

const nonBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };
type Field = keyof OperadorCrear;
type StatusFilter = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

@Component({
  selector: 'app-operadores',
  imports: [ReactiveFormsModule],
  templateUrl: './operadores.html',
  styleUrl: './operadores.css',
})
export class Operadores {
  private readonly api = inject(OperadoresService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control('', nonBlank),
    telefono: this.fb.nonNullable.control('', nonBlank),
    activo: this.fb.nonNullable.control(true),
  });
  readonly items = signal<Operador[]>([]);
  readonly offset = signal(0);
  readonly limit = 10;
  readonly inventoryLimit = 100;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly busy = computed(() => this.loading() || this.saving());
  readonly showForm = signal(false);
  readonly editing = signal<number | null>(null);
  readonly pendingStatus = signal<Operador | null>(null);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('TODOS');
  readonly listError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly total = computed(() => this.items().length);
  readonly activeCount = computed(() => this.items().filter((operator) => operator.activo).length);
  readonly inactiveCount = computed(() => this.items().filter((operator) => !operator.activo).length);
  readonly filteredItems = computed(() => {
    const query = this.searchTerm().trim().toLocaleUpperCase('es-CO');
    const filter = this.statusFilter();
    return this.items().filter((operator) => {
      const matchesQuery = !query
        || operator.nombre.toLocaleUpperCase('es-CO').includes(query)
        || operator.telefono.toLocaleUpperCase('es-CO').includes(query)
        || this.operatorCode(operator.id).includes(query);
      const matchesStatus = filter === 'TODOS' || (filter === 'ACTIVOS' ? operator.activo : !operator.activo);
      return matchesQuery && matchesStatus;
    });
  });
  readonly visibleItems = computed(() => this.filteredItems().slice(this.offset(), this.offset() + this.limit));
  readonly visibleStart = computed(() => this.filteredItems().length ? this.offset() + 1 : 0);
  readonly visibleEnd = computed(() => Math.min(this.offset() + this.limit, this.filteredItems().length));
  readonly page = computed(() => Math.floor(this.offset() / this.limit) + 1);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / this.limit)));

  constructor() {
    this.load();
  }

  load(): void {
    if (this.busy()) return;
    this.loading.set(true);
    this.listError.set('');
    this.api.list(0, this.inventoryLimit, true)
      .pipe(
        expand((page) => page.offset + page.items.length < page.total
          ? this.api.list(page.offset + page.items.length, this.inventoryLimit, true)
          : EMPTY),
        reduce((all, page) => all.concat(page.items), [] as Operador[]),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.offset.set(0);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.listError.set(this.errorMessage(error));
        },
      });
  }

  setSearch(value: string): void {
    this.searchTerm.set(value);
    this.offset.set(0);
  }

  setStatusFilter(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.offset.set(0);
  }

  operatorCode(id: number): string {
    return `OP-${id.toString().padStart(3, '0')}`;
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  newOperator(): void {
    if (this.busy()) return;
    this.form.reset({ nombre: '', telefono: '', activo: true });
    this.editing.set(null);
    this.showForm.set(true);
    this.pendingStatus.set(null);
    this.actionError.set('');
    this.success.set('');
  }

  edit(operator: Operador): void {
    if (this.busy()) return;
    this.loading.set(true);
    this.actionError.set('');
    this.success.set('');
    this.pendingStatus.set(null);
    this.api.get(operator.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.loading.set(false);
        this.editing.set(data.id);
        this.form.reset({ nombre: data.nombre, telefono: data.telefono, activo: data.activo });
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
    this.pendingStatus.set(null);
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
      this.actionError.set('Revisa los campos señalados antes de guardar el operador.');
      return;
    }
    const value = this.form.getRawValue();
    const payload: OperadorCrear = { nombre: value.nombre.trim(), telefono: value.telefono.trim() };
    this.saving.set(true);
    this.actionError.set('');
    this.success.set('');
    const id = this.editing();
    const request = id === null
      ? this.api.create(payload)
      : this.api.update(id, { ...payload, activo: value.activo } satisfies OperadorActualizar);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (operator) => {
        this.saving.set(false);
        this.showForm.set(false);
        this.success.set(`Operador ${operator.nombre} ${id === null ? 'registrado' : 'actualizado'} correctamente.`);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.actionError.set(this.errorMessage(error));
        const body = error.error as ErrorApi | null;
        if (error.status === 422 && Array.isArray(body?.detail)) {
          for (const issue of body.detail) {
            const field = issue.loc.at(-1);
            if (field === 'nombre' || field === 'telefono') {
              this.setFieldError(field, 'El servicio rechazó este valor. Revisa el campo.');
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

  requestStatusChange(operator: Operador): void {
    if (this.busy()) return;
    this.pendingStatus.set(operator);
    this.showForm.set(false);
    this.actionError.set('');
    this.success.set('');
  }

  confirmStatusChange(): void {
    const operator = this.pendingStatus();
    if (!operator || this.busy()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.api.update(operator.id, { activo: !operator.activo }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.pendingStatus.set(null);
        this.success.set(`Operador ${operator.nombre} ${operator.activo ? 'desactivado' : 'reactivado'}. El historial se conserva.`);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.actionError.set(error.error?.detail ?? this.errorMessage(error));
        if (error.status === 404) {
          this.pendingStatus.set(null);
          this.load();
        }
      },
    });
  }

  private errorMessage(error: HttpErrorResponse): string {
    if (error.status === 404) return 'El operador ya no existe. Actualiza el listado.';
    if (error.status === 409) return 'La operación entra en conflicto con los datos existentes.';
    if (error.status === 422) return 'Revisa los datos: hay campos que no cumplen las validaciones.';
    return 'No se pudo conectar con el servicio. Comprueba la conexión y actualiza el listado antes de reintentar.';
  }
}
