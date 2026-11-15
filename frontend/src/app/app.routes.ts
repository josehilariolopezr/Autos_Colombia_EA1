import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'control-acceso',
    title: 'Control de acceso | Autos Colombia',
    loadComponent: () => import('./control-acceso/control-acceso').then((m) => m.ControlAcceso),
  },
  {
    path: 'clientes',
    title: 'Clientes y novedades | Autos Colombia',
    loadComponent: () => import('./clientes/clientes').then((m) => m.Clientes),
  },
  {
    path: 'gestion/operadores',
    title: 'Operadores | Autos Colombia',
    loadComponent: () => import('./operadores/operadores').then((m) => m.Operadores),
  },
  {
    path: 'gestion/celdas',
    title: 'Celdas | Autos Colombia',
    loadComponent: () => import('./celdas/celdas').then((m) => m.Celdas),
  },
  {
    path: 'reportes',
    title: 'Reportes | Autos Colombia',
    loadComponent: () => import('./reportes/reportes').then((m) => m.Reportes),
  },
  {
    path: 'configuracion',
    title: 'Configuración | Autos Colombia',
    loadComponent: () => import('./configuracion/configuracion').then((m) => m.Configuracion),
  },
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home').then((m) => m.Home) },
  {
    path: 'gestion/vehiculos',
    title: 'Vehículos | Autos Colombia',
    loadComponent: () => import('./vehiculos/vehiculos').then((m) => m.Vehiculos),
  },
  { path: '**', redirectTo: '' },
];
