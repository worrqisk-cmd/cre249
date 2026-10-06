import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AdminAuth } from './admin-auth';
import type { AdminPanel } from './admin-panel';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AdminAuth);
  const router = inject(Router);
  return await auth.isOwner() ? true : router.createUrlTree(['/admin/login']);
};

export const unsavedGuard: CanDeactivateFn<AdminPanel> = component => component.canLeave();
