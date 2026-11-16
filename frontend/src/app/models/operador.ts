export interface OperadorCrear {
  nombre: string;
  telefono: string;
}
export type OperadorActualizar = Partial<OperadorCrear> & { activo?: boolean };
export interface Operador extends OperadorCrear {
  id: number;
  activo: boolean;
}
export interface OperadoresPagina {
  items: Operador[];
  total: number;
  offset: number;
  limit: number;
}
