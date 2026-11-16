import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar Sesión | Autos Colombia',
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
  {
    path: '',
    pathMatch: 'full',
    title: 'Vista General | Autos Colombia',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'control-acceso',
    title: 'Control de acceso | Autos Colombia',
    canActivate: [authGuard],
    loadComponent: () => import('./control-acceso/control-acceso').then((m) => m.ControlAcceso),
  },
  {
    path: 'clientes',
    title: 'Clientes y novedades | Autos Colombia',
    canActivate: [authGuard],
    loadComponent: () => import('./clientes/clientes').then((m) => m.Clientes),
  },
  {
    path: 'gestion/operadores',
    title: 'Operadores | Autos Colombia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () => import('./operadores/operadores').then((m) => m.Operadores),
  },
  {
    path: 'gestion/celdas',
    title: 'Celdas | Autos Colombia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () => import('./celdas/celdas').then((m) => m.Celdas),
  },
  {
    path: 'gestion/vehiculos',
    title: 'Vehículos | Autos Colombia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () => import('./vehiculos/vehiculos').then((m) => m.Vehiculos),
  },
  {
    path: 'usuarios',
    title: 'Usuarios y Accesos | Autos Colombia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () => import('./usuarios/usuarios').then((m) => m.Usuarios),
  },
  {
    path: 'reportes',
    title: 'Reportes | Autos Colombia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () => import('./reportes/reportes').then((m) => m.Reportes),
  },
  {
    path: 'configuracion',
    title: 'Configuración | Autos Colombia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () => import('./configuracion/configuracion').then((m) => m.Configuracion),
  },
  { path: '**', redirectTo: '' },
];
