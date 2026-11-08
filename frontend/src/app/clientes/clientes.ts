import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { Cliente, ClienteCrear, PagoMensualidad, Vehiculo } from '../models/vehiculo';
import { OperadoresService } from '../services/operadores.service';
import { Operador } from '../models/operador';
import { TicketData, TicketIngresoComponent } from '../componentes/ticket-ingreso/ticket-ingreso';

@Component({ selector: 'app-clientes', imports: [RouterLink, TicketIngresoComponent], templateUrl: './clientes.html', styleUrl: './clientes.css' })
export class Clientes {
  private readonly api = inject(ApiService);
  private readonly operatorsApi = inject(OperadoresService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tab = signal<'clientes' | 'novedades'>('clientes');
  protected readonly query = signal('');
  protected readonly page = signal(1);
  protected readonly showNew = signal(false);
  protected readonly newName = signal('');
  protected readonly newPhone = signal('');
  protected readonly newPlate = signal('');
  protected readonly createBusy = signal(false);
  protected readonly createError = signal('');
  protected readonly createSuccess = signal('');
  protected readonly actionSuccess = signal('');
  protected readonly associationClient = signal<Cliente | null>(null);
  protected readonly availableVehicles = signal<import('../models/vehiculo').Vehiculo[]>([]);
  protected readonly selectedVehicleId = signal<number | null>(null);
  protected readonly vehiclesLoading = signal(false);
  protected readonly associationBusy = signal(false);
  protected readonly associationError = signal('');
  protected readonly historyClient = signal<Cliente | null>(null);
  protected readonly paymentHistory = signal<PagoMensualidad[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly monthlyClient = signal<Cliente | null>(null);
  protected readonly operators = signal<Operador[]>([]);
  protected readonly operatorsLoading = signal(false);
  protected readonly operatorId = signal<number | null>(null);
  protected readonly paymentMethod = signal<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'>('EFECTIVO');
  protected readonly paymentBusy = signal(false);
  protected readonly paymentError = signal('');
  protected readonly ticket = signal<TicketData | null>(null);
  protected readonly showTicket = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  private readonly clients = signal<Cliente[]>([]);
  protected readonly list = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('es');
    return this.clients().filter((client) =>
      `${client.nombre} ${client.placa ?? ''} ${client.codigo}`.toLocaleLowerCase('es').includes(query),
    );
  });
  protected readonly rows = computed(() => this.list().slice((this.page() - 1) * 5, this.page() * 5));
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.list().length / 5)));
  protected readonly novedades = [
    { title: 'Vehículo en celda no asignada', plate: 'LWM-614', detail: 'Zona A · A-09', time: 'Hoy, 10:32 a. m.', state: 'Pendiente' },
    { title: 'Cliente solicita actualizar sus datos', plate: 'HTN-390', detail: 'Felipe Duarte', time: 'Hoy, 9:18 a. m.', state: 'En revisión' },
    { title: 'Daño reportado en celda M-12', plate: '—', detail: 'Zona de motos', time: 'Ayer, 4:42 p. m.', state: 'Pendiente' },
  ];

  constructor() { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.clients(0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => { this.clients.set(page.items); this.loading.set(false); },
      error: () => { this.loadError.set('No pudimos cargar los clientes desde la API.'); this.loading.set(false); },
    });
  }

  protected search(value: string): void { this.query.set(value); this.page.set(1); }
  protected initials(name: string): string { return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase(); }
  protected dueDate(value: string | null): string {
    return value ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(`${value}T12:00:00`)) : '—';
  }

  protected monthlyValue(client: Cliente): number {
    return client.tipo_vehiculo === 'MOTO' ? 30000 : 60000;
  }

  protected formatCop(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatPaymentDate(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(value));
  }

  protected openPaymentHistory(client: Cliente): void {
    this.historyClient.set(client);
    this.historyError.set('');
    this.paymentHistory.set([]);
    this.historyLoading.set(true);
    this.api.monthlyPayments(client.id, 0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (payments) => {
        this.paymentHistory.set(payments);
        this.historyLoading.set(false);
      },
      error: (error: { error?: { detail?: string } }) => {
        this.historyLoading.set(false);
        this.historyError.set(error.error?.detail ?? 'No se pudo cargar el historial de pagos.');
      },
    });
  }

  protected reprintPayment(payment: PagoMensualidad): void {
    this.ticket.set({
      id: payment.id,
      placa_vehiculo: payment.placa,
      tipo_vehiculo: payment.tipo_vehiculo,
      nombre_cliente: payment.nombre_cliente,
      codigo_cliente: payment.codigo_cliente,
      nombre_operador: payment.nombre_operador,
      tipo_ticket: 'MENSUALIDAD',
      valor: payment.valor,
      metodo_pago: payment.metodo_pago,
      fecha_pago: payment.fecha_pago,
      fecha_fin: this.dueDate(payment.fecha_fin),
      es_mensualidad: true,
    });
    this.historyClient.set(null);
    this.showTicket.set(true);
  }

  protected openVehicleAssociation(client: Cliente): void {
    this.associationClient.set(client);
    this.selectedVehicleId.set(null);
    this.associationError.set('');
    this.vehiclesLoading.set(true);
    this.api.list(0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.availableVehicles.set(page.items.filter((vehicle) => vehicle.cliente_id === null));
        this.vehiclesLoading.set(false);
        if (!page.items.some((vehicle) => vehicle.cliente_id === null)) {
          this.associationError.set('No hay vehículos libres. Registra el vehículo primero o desvincúlalo de su cliente actual.');
        }
      },
      error: () => {
        this.vehiclesLoading.set(false);
        this.associationError.set('No se pudieron consultar los vehículos disponibles.');
      },
    });
  }

  protected linkVehicle(): void {
    const client = this.associationClient();
    const vehicleId = this.selectedVehicleId();
    if (!client || vehicleId === null || this.associationBusy()) return;
    this.associationBusy.set(true);
    this.associationError.set('');
    this.api.update(vehicleId, { cliente_id: client.id }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.associationBusy.set(false);
        this.associationClient.set(null);
        this.actionSuccess.set(`Placa asociada a ${client.nombre}. Ya puedes registrar su mensualidad.`);
        this.load();
      },
      error: (error: { error?: { detail?: string } }) => {
        this.associationBusy.set(false);
        this.associationError.set(error.error?.detail ?? 'No se pudo asociar la placa.');
      },
    });
  }

  protected registerClient(): void {
    const nombre = this.newName().trim();
    const telefono = this.newPhone().trim();
    const placa = this.newPlate().trim().toUpperCase();
    if (!nombre || !telefono || this.createBusy()) {
      this.createError.set('Ingresa el nombre y el teléfono del cliente.');
      return;
    }
    this.createBusy.set(true);
    this.createError.set('');
    const data: ClienteCrear = { nombre, telefono, placa: placa || null };
    this.api.createClient(data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (client) => {
        this.createBusy.set(false);
        this.showNew.set(false);
        this.newName.set('');
        this.newPhone.set('');
        this.newPlate.set('');
        this.page.set(1);
        this.createSuccess.set(`Cliente ${client.codigo} registrado correctamente.`);
        this.load();
      },
      error: (error: { error?: { detail?: string } }) => {
        this.createBusy.set(false);
        this.createError.set(error.error?.detail ?? 'No se pudo registrar el cliente.');
      },
    });
  }

  protected openMonthlyPayment(client: Cliente): void {
    if (!client.placa) return;
    this.monthlyClient.set(client);
    this.paymentError.set('');
    this.operatorId.set(null);
    this.operatorsLoading.set(true);
    this.operatorsApi.list(0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.operators.set(page.items);
        this.operatorsLoading.set(false);
        if (!page.items.length) this.paymentError.set('No hay operadores registrados. Registra un operador antes de recibir pagos.');
      },
      error: () => {
        this.operatorsLoading.set(false);
        this.paymentError.set('No se pudieron cargar los operadores. Intenta de nuevo.');
      },
    });
  }

  protected registerMonthlyPayment(): void {
    const client = this.monthlyClient();
    const operatorId = this.operatorId();
    if (!client?.placa || operatorId === null || this.paymentBusy()) return;
    this.paymentBusy.set(true);
    this.paymentError.set('');
    this.api.payMonthly(client.id, {
      placa: client.placa,
      operador_id: operatorId,
      metodo_pago: this.paymentMethod(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (payment) => {
        this.paymentBusy.set(false);
        this.monthlyClient.set(null);
        this.ticket.set({
          id: payment.id,
          placa_vehiculo: payment.placa,
          tipo_vehiculo: payment.tipo_vehiculo,
          nombre_cliente: payment.nombre_cliente,
          codigo_cliente: payment.codigo_cliente,
          nombre_operador: payment.nombre_operador,
          tipo_ticket: 'MENSUALIDAD',
          valor: payment.valor,
          metodo_pago: payment.metodo_pago,
          fecha_pago: payment.fecha_pago,
          fecha_fin: this.dueDate(payment.fecha_fin),
          es_mensualidad: true,
        });
        this.showTicket.set(true);
        this.actionSuccess.set(`Pago de ${this.formatCop(payment.valor)} registrado. El estado del cliente se actualizó.`);
        this.load();
      },
      error: (error: { error?: { detail?: string } }) => {
        this.paymentBusy.set(false);
        this.paymentError.set(error.error?.detail ?? 'No se pudo registrar el pago. Verifica que el backend esté conectado y que la migración 0004 esté aplicada.');
      },
    });
  }
}
