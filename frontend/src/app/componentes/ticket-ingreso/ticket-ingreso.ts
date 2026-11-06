import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-ticket-ingreso',
  templateUrl: './ticket-ingreso.html',
  styleUrls: ['./ticket-ingreso.css']
})
export class TicketIngresoComponent {
  @Input() estancia: any;
  @Output() alCerrar = new EventEmitter<void>();

  imprimirTicket(): void {
    window.print();
  }

  cerrarModal(): void {
    this.alCerrar.emit();
  }
}