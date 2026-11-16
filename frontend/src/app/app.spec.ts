import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthService } from './services/auth.service';

describe('Navegación', () => {
  it('ofrece acceso a la gestión de vehículos para usuario autenticado', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const authService = TestBed.inject(AuthService);
    authService.token.set('fake-token');
    authService.currentUser.set({
      id: 1,
      nombre: 'Administrador General',
      documento: '1000000001',
      correo: 'admin@autoscolombia.com',
      rol: 'ADMINISTRADOR',
      activo: true,
      operador_id: null,
      creado_en: '2026-01-01',
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('a[href="/gestion/vehiculos"]')
        ?.textContent,
    ).toBe('Vehículos');
  });

  it('muestra la opción de usuarios únicamente al rol ADMINISTRADOR', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const authService = TestBed.inject(AuthService);
    authService.token.set('fake-token');
    authService.currentUser.set({
      id: 2,
      nombre: 'Operador Uno',
      documento: '22222222',
      correo: 'op@autoscolombia.com',
      rol: 'OPERADOR',
      activo: true,
      operador_id: null,
      creado_en: '2026-01-01',
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const navItems = (fixture.nativeElement as HTMLElement).querySelectorAll('a.nav-item');
    const hasUsersLink = Array.from(navItems).some((el) => el.textContent?.includes('Usuarios'));
    expect(hasUsersLink).toBe(false);

    // Cambiar a ADMINISTRADOR
    authService.currentUser.set({
      id: 1,
      nombre: 'Admin General',
      documento: '11111111',
      correo: 'admin@autoscolombia.com',
      rol: 'ADMINISTRADOR',
      activo: true,
      operador_id: null,
      creado_en: '2026-01-01',
    });
    fixture.detectChanges();
    const updatedNavItems = (fixture.nativeElement as HTMLElement).querySelectorAll('a.nav-item');
    const hasUsersLinkAdmin = Array.from(updatedNavItems).some((el) => el.textContent?.includes('Usuarios'));
    expect(hasUsersLinkAdmin).toBe(true);
  });
});
