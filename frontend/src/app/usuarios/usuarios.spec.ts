import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Usuario } from '../models/usuario';
import { Usuarios } from './usuarios';

describe('Usuarios Component', () => {
  let fixture: ComponentFixture<Usuarios>;
  let component: Usuarios;
  let http: HttpTestingController;

  const mockUser: Usuario = {
    id: 1,
    nombre: 'Ana Torres',
    documento: '10203040',
    correo: 'ana@autoscolombia.com',
    rol: 'OPERADOR',
    activo: true,
    operador_id: 1,
    creado_en: '2026-01-01T10:00:00Z',
  };

  const mockPage = {
    items: [mockUser],
    total: 1,
    offset: 0,
    limit: 10,
  };
  const mockAdmin: Usuario = { ...mockUser, rol: 'ADMINISTRADOR' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Usuarios);
    component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/usuarios').flush(mockPage);
  });

  afterEach(() => http.verify());

  it('carga la lista de usuarios inicialmente', () => {
    expect(component.usuarios().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.usuarios()[0].nombre).toBe('Ana Torres');
  });

  it('permite abrir modal de creación y enviar nuevo usuario', () => {
    component.openCreateModal();
    expect(component.showModal()).toBe(true);
    expect(component.isEditing()).toBe(false);

    component.userForm.patchValue({
      nombre: 'Carlos Perez',
      documento: '98765432',
      correo: 'carlos@autoscolombia.com',
      rol: 'OPERADOR',
      password: 'Password123*',
    });

    component.submitUser();

    const req = http.expectOne({ method: 'POST', url: '/usuarios' });
    expect(req.request.body.nombre).toBe('Carlos Perez');
    req.flush({ ...mockUser, id: 2, nombre: 'Carlos Perez' });

    http.expectOne((r) => r.url === '/usuarios').flush({
      ...mockPage,
      items: [mockUser, { ...mockUser, id: 2, nombre: 'Carlos Perez' }],
      total: 2,
    });

    expect(component.showModal()).toBe(false);
  });

  it('permite alternar estado activo/inactivo', () => {
    component.confirmToggleStatus(mockUser);
    expect(component.showDeactivateModal()).toBe(true);

    component.executeToggleStatus();

    const req = http.expectOne({ method: 'PATCH', url: '/usuarios/1' });
    expect(req.request.body).toEqual({ activo: false });
    req.flush({ ...mockUser, activo: false });

    http.expectOne((r) => r.url === '/usuarios').flush({
      ...mockPage,
      items: [{ ...mockUser, activo: false }],
    });

    expect(component.showDeactivateModal()).toBe(false);
  });

  it('bloquea la confirmación al intentar desactivar el último administrador activo', () => {
    component.usuarios.set([mockAdmin]);

    component.confirmToggleStatus(mockAdmin);

    expect(component.cantidadAdminsActivos()).toBe(1);
    expect(component.esUltimoAdminActivo(mockAdmin)).toBe(true);
    expect(component.showDeactivateModal()).toBe(false);
    expect(component.error()).toBe(
      'No es posible desactivar el único administrador activo del sistema.'
    );
  });

  it('permite abrir la confirmación si hay más de un administrador activo', () => {
    const anotherAdmin: Usuario = { ...mockAdmin, id: 2, correo: 'otro@autoscolombia.com' };
    component.usuarios.set([mockAdmin, anotherAdmin]);

    component.confirmToggleStatus(mockAdmin);

    expect(component.cantidadAdminsActivos()).toBe(2);
    expect(component.showDeactivateModal()).toBe(true);
  });

  it('muestra en el modal de desactivación el detalle del backend para HTTP 409', () => {
    const anotherAdmin: Usuario = { ...mockAdmin, id: 2, correo: 'otro@autoscolombia.com' };
    const detail = 'No es posible desactivar ni quitar el rol al único administrador activo del sistema.';
    component.usuarios.set([mockAdmin, anotherAdmin]);
    component.confirmToggleStatus(mockAdmin);
    component.executeToggleStatus();

    http.expectOne({ method: 'PATCH', url: '/usuarios/1' }).flush(
      { detail },
      { status: 409, statusText: 'Conflict' }
    );

    expect(component.showDeactivateModal()).toBe(true);
    expect(component.deactivateModalError()).toBe(detail);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(detail);
  });

  it('muestra en el modal de edición el detalle del backend para HTTP 409', () => {
    const detail = 'Conflicto al editar el usuario.';
    component.openEditModal(mockUser);
    component.submitUser();

    http.expectOne({ method: 'PATCH', url: '/usuarios/1' }).flush(
      { detail },
      { status: 409, statusText: 'Conflict' }
    );

    expect(component.modalError()).toBe(detail);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(detail);
  });
});
