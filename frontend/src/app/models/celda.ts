export interface CeldaCrear {
  codigo: string;
  tipo: string;
  estado?: 'ACTIVA' | 'MANTENIMIENTO';
}
export type CeldaActualizar = Partial<CeldaCrear>;
export interface Celda extends CeldaCrear {
  id: number;
  estado: 'ACTIVA' | 'MANTENIMIENTO';
}
export interface CeldasPagina {
  items: Celda[];
  total: number;
  offset: number;
  limit: number;
}
