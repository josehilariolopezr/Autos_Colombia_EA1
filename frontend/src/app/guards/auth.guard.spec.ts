import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './auth.guard';

@Component({ standalone: true, template: '' })
class GuardTestPage {}

describe('roleGuard', () => {
  let currentRole: 'ADMINISTRADOR' | 'OPERADOR';

  beforeEach(() => {
    currentRole = 'OPERADOR';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: GuardTestPage },
          {
            path: 'gestion/celdas',
            component: GuardTestPage,
            canActivate: [roleGuard],
            data: { roles: ['ADMINISTRADOR'] },
          },
        ]),
        {
          provide: AuthService,
          useValue: { getToken: () => 'token', userRole: () => currentRole },
        },
      ],
    });
  });

  it('redirige al operador que intenta abrir una ruta administrativa', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/gestion/celdas');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/');
  });

  it('permite al administrador abrir una ruta administrativa', async () => {
    currentRole = 'ADMINISTRADOR';
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/gestion/celdas');

    expect(TestBed.inject(Router).url).toBe('/gestion/celdas');
  });
});
