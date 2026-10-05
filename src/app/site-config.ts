import { InjectionToken } from '@angular/core';

export interface SiteConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  adminUserId: string;
  adminLogin: string;
  adminEmail: string;
}

export const SITE_CONFIG = new InjectionToken<SiteConfig>('site config');
