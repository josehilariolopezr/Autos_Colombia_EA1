import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { timeout } from 'rxjs';
import { Novedad, NovedadCrear } from '../models/novedad';
import { API_BASE_URL } from './api.service';

@Injectable({ providedIn: 'root' })
export class NovedadesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/novedades`;

  list(placa?: string) {
    return this.http.get<Novedad[]>(this.url, { params: placa ? { placa } : {} }).pipe(timeout(15000));
  }

  create(data: NovedadCrear) {
    return this.http.post<Novedad>(this.url, data).pipe(timeout(15000));
  }
}
