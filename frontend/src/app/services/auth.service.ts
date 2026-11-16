import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { LoginSolicitud, TokenRespuesta, Usuario } from '../models/usuario';

const TOKEN_KEY = 'autos_colombia_token';
const USER_KEY = 'autos_colombia_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(this.readInitialToken());
  readonly currentUser = signal<Usuario | null>(this.readInitialUser());

  readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.rol ?? null);
  readonly isAdmin = computed(() => this.currentUser()?.rol === 'ADMINISTRADOR');
  readonly isOperador = computed(() => this.currentUser()?.rol === 'OPERADOR');

  constructor() {
    if (this.token()) {
      this.refreshMe().subscribe({
        error: () => this.clearSession(),
      });
    }
  }

  login(credentials: LoginSolicitud) {
    return this.http.post<TokenRespuesta>('/auth/login', credentials).pipe(
      tap((response) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(TOKEN_KEY, response.access_token);
          localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
        }
        this.token.set(response.access_token);
        this.currentUser.set(response.usuario);
      })
    );
  }

  refreshMe() {
    return this.http.get<Usuario>('/auth/me').pipe(
      tap((usuario) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(USER_KEY, JSON.stringify(usuario));
        }
        this.currentUser.set(usuario);
      })
    );
  }

  logout() {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.token.set(null);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return this.token();
  }

  private readInitialToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }

  private readInitialUser(): Usuario | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(USER_KEY);
      if (stored) {
        try {
          return JSON.parse(stored) as Usuario;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
