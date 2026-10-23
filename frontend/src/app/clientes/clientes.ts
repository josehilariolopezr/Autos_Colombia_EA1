import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { Cliente } from '../models/vehiculo';

@Component({ selector: 'app-clientes', imports: [RouterLink], templateUrl: './clientes.html', styleUrl: './clientes.css' })
export class Clientes {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tab = signal<'clientes' | 'novedades'>('clientes');
  protected readonly query = signal('');
  protected readonly page = signal(1);
  protected readonly showNew = signal(false);
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
}
