import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { timeout } from 'rxjs';
import { Usuario, UsuarioActualizar, UsuarioCrear, UsuariosPagina } from '../models/usuario';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/usuarios';

  list(offset = 0, limit = 20, search?: string, rol?: string, activo?: boolean | null) {
    let params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    if (rol && rol !== 'TODOS') {
      params = params.set('rol', rol);
    }
    if (activo !== null && activo !== undefined) {
      params = params.set('activo', activo.toString());
    }

    return this.http.get<UsuariosPagina>(this.endpoint, { params }).pipe(timeout(15000));
  }

  get(id: number) {
    return this.http.get<Usuario>(`${this.endpoint}/${id}`).pipe(timeout(15000));
  }

  create(data: UsuarioCrear) {
    return this.http.post<Usuario>(this.endpoint, data).pipe(timeout(15000));
  }

  update(id: number, data: UsuarioActualizar) {
    return this.http.patch<Usuario>(`${this.endpoint}/${id}`, data).pipe(timeout(15000));
  }

  deactivate(id: number) {
    return this.http.delete<Usuario>(`${this.endpoint}/${id}`).pipe(timeout(15000));
  }

  toggleActivo(id: number, activo: boolean) {
    return this.update(id, { activo });
  }
}
