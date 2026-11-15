export interface NovedadCrear {
  vehiculo_id: number;
  estancia_id: number | null;
  operador_id: number;
  descripcion: string;
}

export interface Novedad {
  id: number;
  vehiculo_id: number;
  estancia_id: number | null;
  operador_id: number;
  descripcion: string;
  fecha_registro: string;
  placa: string;
  nombre_operador: string;
}
