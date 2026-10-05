import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./home').then(m => m.Home) },
  { path: 'catalog', loadComponent: () => import('./catalog').then(m => m.Catalog) },
  { path: 'catalog/:category', loadComponent: () => import('./catalog').then(m => m.Catalog) },
  { path: 'item/:slug', loadComponent: () => import('./catalog').then(m => m.Catalog) },
  { path: '**', redirectTo: '' },
];
