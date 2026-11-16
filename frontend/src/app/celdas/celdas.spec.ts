import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Celdas } from './celdas';
import { DashboardResumen } from '../models/dashboard';

describe('Gestión de celdas', () => {
  let fixture: ComponentFixture<Celdas>;
  let http: HttpTestingController;
  const cell = { id: 1, codigo: 'A-01', tipo: 'AUTOMOVIL', estado: 'ACTIVA' as const };
  const dashboard = { celdas_ocupadas: 1, celdas: [{ id: 1, codigo: 'A-01', tipo: 'AUTOMOVIL', zona: 'A', estado: 'OCUPADA' }] } as DashboardResumen;

  const flushInitialRequests = (items = [cell]) => {
    http.expectOne('/celdas?offset=0&limit=100').flush({ items, total: items.length, offset: 0, limit: 100 });
    http.expectOne('/dashboard/resumen').flush(dashboard);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Celdas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Celdas);
    fixture.detectChanges();
    flushInitialRequests();
  });
  afterEach(() => http.verify());

  it('combina búsqueda, zona y estado, y reinicia la paginación al filtrar', () => {
    const component = fixture.componentInstance;
    component.celdas.set([
      cell,
      { id: 2, codigo: 'M-03', tipo: 'MOTO', estado: 'ACTIVA' },
      { id: 3, codigo: 'P-01', tipo: 'CAMIONETA', estado: 'MANTENIMIENTO' },
    ]);
    component.dashboard.set({
      ...dashboard,
      celdas: [
        { id: 1, codigo: 'A-01', tipo: 'AUTOMOVIL', zona: 'A', estado: 'OCUPADA' },
        { id: 2, codigo: 'M-03', tipo: 'MOTO', zona: 'M', estado: 'DISPONIBLE' },
      ],
    } as DashboardResumen);
    component.currentPage.set(3);
    component.actualizarBusqueda('m-03');
    component.seleccionarZona('M');
    component.seleccionarEstado('LIBRE');

    expect(component.currentPage()).toBe(1);
    expect(component.celdasFiltradas().map((item) => item.codigo)).toEqual(['M-03']);
    expect(component.celdasPaginadas()).toEqual(component.celdasFiltradas());
    component.limpiarFiltros();
    expect(component.celdasFiltradas()).toHaveLength(3);
  });

  it('crea una celda y recarga el inventario y la ocupación', () => {
    const component = fixture.componentInstance;
    component.newCell();
    component.form.setValue({ codigo: ' a-02 ', tipo: 'AUTOMOVIL', estado: 'ACTIVA' });
    component.save();
    const request = http.expectOne({ method: 'POST', url: '/celdas' });
    expect(request.request.body).toEqual({ codigo: 'A-02', tipo: 'AUTOMOVIL' });
    request.flush({ ...cell, codigo: 'A-02' });
    http.expectOne('/celdas?offset=0&limit=100').flush({ items: [cell], total: 1, offset: 0, limit: 100 });
    http.expectOne('/dashboard/resumen').flush(dashboard);
    expect(component.success()).toContain('registrada');
  });
});
