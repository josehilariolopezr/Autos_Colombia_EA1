export type RolUsuario = 'ADMINISTRADOR' | 'OPERADOR';

export interface Usuario {
  id: number;
  nombre: string;
  documento: string;
  correo: string;
  rol: RolUsuario;
  activo: boolean;
  operador_id: number | null;
  creado_en: string;
}

export interface UsuarioCrear {
  nombre: string;
  documento: string;
  correo: string;
  password: string;
  rol: RolUsuario;
  operador_id?: number | null;
}

export interface UsuarioActualizar {
  nombre?: string;
  documento?: string;
  correo?: string;
  password?: string;
  rol?: RolUsuario;
  activo?: boolean;
  operador_id?: number | null;
}

export interface UsuariosPagina {
  items: Usuario[];
  total: number;
  offset: number;
  limit: number;
}

export interface LoginSolicitud {
  correo?: string;
  documento?: string;
  credencial?: string;
  password: string;
}

export interface TokenRespuesta {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}
