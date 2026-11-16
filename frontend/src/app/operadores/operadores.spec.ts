import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Operadores } from './operadores';

describe('Gestión de operadores', () => {
  let fixture: ComponentFixture<Operadores>;
  let http: HttpTestingController;
  const operator = { id: 1, nombre: 'Prueba Ana', telefono: '+57 00123', activo: true };
  const page = { items: [operator], total: 1, offset: 0, limit: 10 };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Operadores],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Operadores);
    fixture.detectChanges();
    http.expectOne('/operadores?offset=0&limit=100&incluir_inactivos=true').flush(page);
  });
  afterEach(() => http.verify());

  it('crea desde el HTML, recorta textos y conserva prefijos sin duplicar envíos', () => {
    const c = fixture.componentInstance;
    c.newOperator();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('#telefono')!.type).toBe('tel');
    for (const [key, value] of Object.entries({
      nombre: ' Prueba Ana ',
      telefono: ' +57 00123 ',
    })) {
      const input = root.querySelector<HTMLInputElement>(`#${key}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    c.save();
    const request = http.expectOne({ method: 'POST', url: '/operadores' });
    expect(request.request.body).toEqual({ nombre: 'Prueba Ana', telefono: '+57 00123' });
    request.flush(operator);
    http.expectOne('/operadores?offset=0&limit=100&incluir_inactivos=true').flush(page);
    expect(c.success()).toContain('registrado');
  });

  it('rechaza espacios y permite corregir errores 422 de un campo', () => {
    const c = fixture.componentInstance;
    c.newOperator();
    c.form.setValue({ nombre: ' \t', telefono: ' ', activo: true });
    c.save();
    expect(c.fieldError('nombre')).toContain('obligatorio');
    expect(c.fieldError('telefono')).toContain('obligatorio');
    http.expectNone('/operadores');
    c.form.setValue({ nombre: 'Prueba Ana', telefono: '00123', activo: true });
    c.save();
    http
      .expectOne('/operadores')
      .flush(
        { detail: [{ loc: ['body', 'telefono'], msg: 'Inválido' }] },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    expect(c.fieldError('telefono')).toContain('rechazó');
    c.form.controls.telefono.setValue('00045');
    expect(c.form.valid).toBe(true);
  });

  it('consulta antes de editar, guarda con PATCH sin id y conserva ceros', () => {
    const c = fixture.componentInstance;
    c.edit(operator);
    http.expectOne('/operadores/1').flush(operator);
    c.form.controls.telefono.setValue(' 00045 ');
    c.save();
    const request = http.expectOne({ method: 'PATCH', url: '/operadores/1' });
    expect(request.request.body).toEqual({ nombre: operator.nombre, telefono: '00045', activo: true });
    request.flush({ ...operator, telefono: '00045' });
    http.expectOne('/operadores?offset=0&limit=100&incluir_inactivos=true').flush(page);
    expect(c.success()).toContain('actualizado');
  });

  it('permite cambiar estado del operador', () => {
    const c = fixture.componentInstance;
    c.requestStatusChange(operator);
    expect(c.pendingStatus()).toEqual(operator);
    c.confirmStatusChange();
    const req = http.expectOne({ method: 'PATCH', url: '/operadores/1' });
    expect(req.request.body).toEqual({ activo: false });
    req.flush({ ...operator, activo: false });
    http.expectOne('/operadores?offset=0&limit=100&incluir_inactivos=true').flush({
      items: [{ ...operator, activo: false }],
      total: 1,
      offset: 0,
      limit: 10,
    });
    expect(c.success()).toContain('desactivado');
  });

  it('muestra fallos de conexión y permite reintentar', () => {
    const c = fixture.componentInstance;
    c.load();
    http.expectOne('/operadores?offset=0&limit=100&incluir_inactivos=true').error(new ProgressEvent('error'));
    expect(c.listError()).toContain('No se pudo conectar');
    c.load();
    http.expectOne('/operadores?offset=0&limit=100&incluir_inactivos=true').flush(page);
  });
});
