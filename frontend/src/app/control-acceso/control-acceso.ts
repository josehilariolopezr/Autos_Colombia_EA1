import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Celda } from '../models/celda';
import { Operador } from '../models/operador';
import { EstadoVehiculo } from '../models/estancia';
import { EstanciasService } from '../services/estancias.service';

const nonBlank: ValidatorFn = (c) =>
  typeof c.value === 'string' && c.value.trim() ? null : { required: true };
const placa = (value: string) => value.trim().toUpperCase();

@Component({
  selector: 'app-control-acceso',
  imports: [ReactiveFormsModule],
  templateUrl: './control-acceso.html',
  styleUrl: './control-acceso.css',
})
export class ControlAcceso {
  readonly demoMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  readonly demoQuery = signal('JTR-428');
  readonly demoPayment = signal<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  readonly demoFinished = signal(false);
  private readonly api = inject(EstanciasService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private pendingCellId: number | null = null;
  private version = 0;
  readonly entrada = this.fb.group({
    placa: this.fb.nonNullable.control('', nonBlank),
    celda_id: this.fb.control<number | null>(null, Validators.required),
    operador_id: this.fb.control<number | null>(null, Validators.required),
  });
  readonly consulta = this.fb.group({
    placa: this.fb.nonNullable.control('', nonBlank),
    operador_id: this.fb.control<number | null>(null, Validators.required),
  });
  readonly celdas = signal<Celda[]>([]);
  readonly operadores = signal<Operador[]>([]);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');
  readonly saving = signal(false);
  readonly querying = signal(false);
  readonly busy = computed(() => this.saving() || this.querying());
  readonly estado = signal<EstadoVehiculo | null>(null);
  readonly errorEntrada = signal('');
  readonly errorConsulta = signal('');
  readonly exitoEntrada = signal('');
  readonly exitoSalida = signal('');

  constructor() {
    if (this.demoMode) return;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      const rawCell = params.get('celda_id');
      const cellId = rawCell && /^\d+$/.test(rawCell) ? Number(rawCell) : null;
      if (cellId !== null) {
        this.pendingCellId = cellId;
        this.applyPendingCell();
      }
      const vehiclePlate = params.get('placa')?.trim().toUpperCase();
      if (vehiclePlate) {
        this.consulta.controls.placa.setValue(vehiclePlate);
        this.buscar();
      }
    });
    this.consulta.controls.placa.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        this.version++;
        this.estado.set(null);
        this.errorConsulta.set('');
        this.exitoSalida.set('');
      });
    this.cargarCatalogos();
  }

  cargarCatalogos(): void {
    if (this.catalogLoading() || this.saving()) return;
    this.catalogLoading.set(true);
    this.catalogError.set('');
    this.entrada.controls.celda_id.reset();
    this.entrada.controls.operador_id.reset();
    this.consulta.controls.operador_id.reset();
    forkJoin({ celdas: this.api.celdas(), operadores: this.api.operadores() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => {
          this.celdas.set(data.celdas);
          this.operadores.set(data.operadores);
          this.applyPendingCell();
          this.catalogLoading.set(false);
        },
        error: () => {
          this.catalogLoading.set(false);
          this.celdas.set([]);
          this.operadores.set([]);
          this.catalogError.set(
            'No se pudieron cargar todas las opciones. Reintenta actualizar catálogos.',
          );
        },
      });
  }

  private applyPendingCell(): void {
    const id = this.pendingCellId;
    if (id !== null && this.celdas().some((cell) => cell.id === id)) {
      this.entrada.controls.celda_id.setValue(id);
      this.pendingCellId = null;
    }
  }

  registrarEntrada(): void {
    if (this.busy() || this.catalogLoading() || this.catalogError()) return;
    this.entrada.markAllAsTouched();
    if (this.entrada.invalid) return;
    const raw = this.entrada.getRawValue();
    const data = {
      placa: placa(raw.placa),
      celda_id: raw.celda_id!,
      operador_id: raw.operador_id!,
    };
    const codigo =
      this.celdas().find((c) => c.id === data.celda_id)?.codigo ?? String(data.celda_id);
    this.entrada.controls.placa.setValue(data.placa);
    this.saving.set(true);
    this.errorEntrada.set('');
    this.exitoEntrada.set('');
    this.version++;
    this.estado.set(null);
    this.api
      .entrada(data)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.exitoEntrada.set(
            `Entrada registrada: ${data.placa}, celda ${codigo}, ${this.fecha(result.entrada)}.`,
          );
        },
        error: (error) => {
          this.saving.set(false);
          this.errorEntrada.set(this.mensaje(error));
        },
      });
  }

  buscar(): void {
    if (this.busy()) return;
    this.consulta.controls.placa.markAsTouched();
    if (this.consulta.controls.placa.invalid) return;
    const value = placa(this.consulta.controls.placa.value);
    this.consulta.controls.placa.setValue(value, { emitEvent: false });
    const version = ++this.version;
    this.estado.set(null);
    this.errorConsulta.set('');
    this.querying.set(true);
    this.api
      .consultar(value)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.querying.set(false);
          if (version === this.version) this.estado.set(result);
        },
        error: (error) => {
          this.querying.set(false);
          if (version === this.version)
            this.errorConsulta.set(
              error.status === 404 ? 'Vehículo no registrado.' : this.mensaje(error),
            );
        },
      });
  }

  registrarSalida(): void {
    if (this.busy() || this.catalogLoading() || this.catalogError()) return;
    this.consulta.markAllAsTouched();
    const state = this.estado();
    const value = placa(this.consulta.controls.placa.value);
    if (
      this.consulta.invalid ||
      !state?.estancia ||
      !state.esta_dentro ||
      state.vehiculo.placa !== value
    )
      return;
    const version = this.version;
    this.saving.set(true);
    this.errorConsulta.set('');
    this.exitoSalida.set('');
    this.api
      .salida({ placa: value, operador_id: this.consulta.controls.operador_id.value! })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.estado.set(null);
          if (version !== this.version) return;
          this.exitoSalida.set(
            `Salida registrada: ${value}, celda ${state.estancia!.celda.codigo}, ${this.fecha(result.salida!)}.`,
          );
          this.buscar();
        },
        error: (error) => {
          this.saving.set(false);
          this.estado.set(null);
          if (version === this.version)
            this.errorConsulta.set(
              this.mensaje(error) + ' Consulta nuevamente antes de confirmar otra salida.',
            );
        },
      });
  }

  fecha(value: string): string {
    return (
      new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(value)) + ' (Bogotá)'
    );
  }

  duracion(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const remainder = minutes % 60;
    return days ? `${days} d ${hours} h` : hours ? `${hours} h ${remainder} min` : `${remainder} min`;
  }

  iniciales(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }

  fechaCorta(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeZone: 'America/Bogota',
    }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
  }

  hora(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    }).format(new Date(value));
  }

  private mensaje(error: HttpErrorResponse): string {
    if ([404, 409].includes(error.status) && typeof error.error?.detail === 'string')
      return error.error.detail;
    if (error.status === 422)
      return 'Datos inválidos. Revisa la placa y selecciona una celda y un operador válidos según la operación.';
    return 'No se pudo conectar con el servicio. Consulta el vehículo antes de reintentar: la operación podría haberse completado.';
  }
}
