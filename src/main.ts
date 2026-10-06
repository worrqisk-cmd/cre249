import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { SITE_CONFIG, SiteConfig } from './app/site-config';

async function start() {
  const response = await fetch(new URL('site-config.json', document.baseURI), { cache: 'no-store' });
  if (!response.ok) throw new Error('Public site configuration is unavailable');
  const config = await response.json() as SiteConfig;
  if (new URL(config.supabaseUrl).hostname !== 'bvlcyhcuneaphuletnqz.supabase.co') throw new Error('Unexpected Supabase project');
  await bootstrapApplication(App, { ...appConfig, providers: [...appConfig.providers, { provide: SITE_CONFIG, useValue: config }] });
}

start().catch(() => {
  document.querySelector('app-root')!.textContent = 'Не удалось загрузить настройки сайта. Обновите страницу позже.';
});
