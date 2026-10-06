import { Routes } from '@angular/router';
export const previewRoutes: Routes = ['a', 'b', 'c'].map(variant => ({
  path: `design/${variant}`,
  data: { variant },
  loadComponent: () => import('./home-preview').then(m => m.HomePreview),
}));
