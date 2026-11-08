import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface TicketData {
  id?: number;
  placa_vehiculo: string;
  tipo_vehiculo: string;
  nombre_cliente?: string;
  codigo_cliente?: string;
  codigo_celda?: string;
  nombre_operador: string;
  tipo_ticket: 'INGRESO' | 'SALIDA' | 'MENSUALIDAD';
  valor?: number;
  metodo_pago?: string;
  fecha_pago?: string;
  fecha_fin?: string;
  es_mensualidad?: boolean;
}

@Component({
  selector: 'app-ticket-ingreso',
  standalone: true,
  imports: [],
  templateUrl: './ticket-ingreso.html',
  styleUrls: ['./ticket-ingreso.css']
})
export class TicketIngresoComponent {
  @Input() estancia: TicketData | null = null;
  @Output() alCerrar = new EventEmitter<void>();

  imprimirTicket(): void {
    const cleanup = () => document.body.classList.remove('ticket-printing');
    document.body.classList.add('ticket-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }

  formatCop(value: number | undefined): string {
    return value === undefined
      ? '—'
      : new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(value);
  }

  fechaPago(): string {
    if (!this.estancia?.fecha_pago) return '—';
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(this.estancia.fecha_pago));
  }

  horaPago(): string {
    if (!this.estancia?.fecha_pago) return '—';
    return new Intl.DateTimeFormat('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    }).format(new Date(this.estancia.fecha_pago));
  }

  cerrarModal(): void {
    this.alCerrar.emit();
  }
}
