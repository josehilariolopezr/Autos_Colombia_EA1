import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TokenRespuesta, Usuario } from '../models/usuario';
import { AuthService } from './auth.service';

class DummyLoginComponent {}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const mockUser: Usuario = {
    id: 1,
    nombre: 'Admin Prueba',
    documento: '1000000001',
    correo: 'admin@autoscolombia.com',
    rol: 'ADMINISTRADOR',
    activo: true,
    operador_id: null,
    creado_en: '2026-01-01T00:00:00Z',
  };

  const mockTokenResponse: TokenRespuesta = {
    access_token: 'fake-jwt-token-12345',
    token_type: 'bearer',
    usuario: mockUser,
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideRouter([{ path: 'login', component: DummyLoginComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('inicia sesión y almacena token y usuario en localStorage', () => {
    service.login({ credencial: 'admin@autoscolombia.com', password: 'Admin123*' }).subscribe((res) => {
      expect(res.access_token).toBe('fake-jwt-token-12345');
      expect(service.isAuthenticated()).toBe(true);
      expect(service.isAdmin()).toBe(true);
      expect(service.currentUser()?.nombre).toBe('Admin Prueba');
    });

    const req = http.expectOne('/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(localStorage.getItem('autos_colombia_token')).toBe('fake-jwt-token-12345');
  });

  it('cierra sesión y limpia el almacenamiento y señales', () => {
    service.token.set('token');
    service.currentUser.set(mockUser);
    localStorage.setItem('autos_colombia_token', 'token');

    service.logout();

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('autos_colombia_token')).toBeNull();
  });
});
