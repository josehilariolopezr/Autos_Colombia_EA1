export interface DashboardVehiculo {
  placa: string;
  tipo: string;
  cliente?: { id: number; codigo: string; nombre: string; telefono: string; vencimiento: string | null } | null;
}

export interface DashboardCelda {
  id: number;
  codigo: string;
  tipo: string;
  zona: 'A' | 'M' | 'P' | 'OTRA';
  estado: 'DISPONIBLE' | 'OCUPADA';
  mensualidad: boolean | null;
  vehiculo: DashboardVehiculo | null;
  entrada: string | null;
}

export interface DashboardResumen {
  total_celdas: number;
  celdas_disponibles: number;
  celdas_ocupadas: number;
  estancias_activas: number;
  mensualidades_activas: number | null;
  recaudacion_hoy: number | null;
  variacion_recaudacion_pct: number | null;
  variacion_ocupadas_24h: number;
  celdas: DashboardCelda[];
}
