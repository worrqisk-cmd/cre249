import { Routes } from '@angular/router';
import { previewRoutes } from './preview.routes';
import { adminGuard, unsavedGuard } from './admin-guards';
export const routes: Routes = [
  ...previewRoutes,
  { path: '', loadComponent: () => import('./home').then(m => m.Home) },
  { path: 'catalog', loadComponent: () => import('./catalog').then(m => m.Catalog) },
  { path: 'catalog/:category', loadComponent: () => import('./catalog').then(m => m.Catalog) },
  { path: 'item/:slug', loadComponent: () => import('./catalog').then(m => m.Catalog) },
  { path: 'admin/login', loadComponent: () => import('./admin-login').then(m => m.AdminLogin) },
  { path: 'admin', canActivate: [adminGuard], canDeactivate: [unsavedGuard], loadComponent: () => import('./admin-panel').then(m => m.AdminPanel) },
  { path: '**', redirectTo: '' },
];
