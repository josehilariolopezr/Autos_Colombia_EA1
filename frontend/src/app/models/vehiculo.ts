export const TIPOS_VEHICULO = ['MOTO', 'AUTOMOVIL', 'CAMIONETA'] as const;
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];
export interface ClienteVehiculo {
  id: number;
  codigo: string;
  nombre: string;
  telefono: string;
  vencimiento: string | null;
}
export interface VehiculoCrear {
  placa: string;
  color: string;
  modelo: number;
  marca: string;
  tipo: TipoVehiculo;
}
export type VehiculoActualizar = Partial<VehiculoCrear>;
export interface Vehiculo extends VehiculoCrear {
  id: number;
  cliente_id: number | null;
  cliente: ClienteVehiculo | null;
}
export interface VehiculosPagina {
  items: Vehiculo[];
  total: number;
  offset: number;
  limit: number;
}
export interface ErrorValidacion {
  loc: (string | number)[];
  msg: string;
  type: string;
}
export interface ErrorApi {
  detail?: string | ErrorValidacion[];
}
export interface Cliente extends ClienteVehiculo {
  placa: string | null;
  estado: 'Al día' | 'Por vencer' | 'Vencido' | 'Sin mensualidad';
}
export interface ClientesPagina {
  items: Cliente[];
  total: number;
  offset: number;
  limit: number;
}
