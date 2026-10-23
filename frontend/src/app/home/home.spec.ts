import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Home as App } from './home';

describe('Home dashboard', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  const summary = {
    total_celdas: 2, celdas_disponibles: 1, celdas_ocupadas: 1, estancias_activas: 1,
    mensualidades_activas: null, recaudacion_hoy: null, variacion_recaudacion_pct: null,
    variacion_ocupadas_24h: 1,
    celdas: [
      { id: 1, codigo: 'A-01', tipo: 'AUTOMOVIL', zona: 'A' as const, estado: 'DISPONIBLE' as const, mensualidad: null, vehiculo: null, entrada: null },
      { id: 2, codigo: 'A-02', tipo: 'AUTOMOVIL', zona: 'A' as const, estado: 'OCUPADA' as const, mensualidad: null, vehiculo: { placa: 'ABC123', tipo: 'AUTOMOVIL' }, entrada: '2026-10-22T12:00:00Z' },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  function request() { return http.expectOne({ method: 'GET', url: '/dashboard/resumen' }); }

  it('loads actual occupancy and cell information', () => {
    const req = request();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando el estado');
    req.flush(summary);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Buenos días, Andrés');
    expect(element.textContent).toContain('de 2 celdas');
    expect(element.textContent).toContain('Estancias activas');
    expect(element.textContent).toContain('ABC123');
    expect(element.querySelector('.spot-card.occupied')).not.toBeNull();
    expect(element.textContent).toContain('1 más que ayer');
  });
  it('filters the cell list', () => {
    request().flush(summary);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.segmented button')[1].click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.spot-card').length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Disponible');
  });
  it('offers retry when the backend is unavailable', () => {
    request().flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pudimos cargar el resumen');
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    request().flush(summary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ABC123');
  });
});
