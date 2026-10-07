import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { SITE_CONFIG, SiteConfig } from './app/site-config';

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/')) location.reload();
});

async function start() {
  if (location.hash.startsWith('#/')) {
    const legacy = location.hash.slice(1);
    if (
      /^\/(?:catalog(?:\/[a-z0-9-]+)?|item\/[a-z0-9-]+|admin(?:\/login)?|)\/?(?:\?.*)?$/.test(
        legacy,
      )
    ) {
      const target = new URL(legacy.replace(/^\//, ''), document.baseURI);
      if (!target.pathname.endsWith('/')) target.pathname += '/';
      history.replaceState(null, '', target.pathname + target.search);
    }
  }
  const response = await fetch(new URL('site-config.json', document.baseURI), {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Public site configuration is unavailable');
  const config = (await response.json()) as SiteConfig;
  if (new URL(config.supabaseUrl).hostname !== 'bvlcyhcuneaphuletnqz.supabase.co')
    throw new Error('Unexpected Supabase project');
  await bootstrapApplication(App, {
    ...appConfig,
    providers: [...appConfig.providers, { provide: SITE_CONFIG, useValue: config }],
  });
}

start().catch(() => {
  document.documentElement.removeAttribute('data-home-intro');
  document.querySelector('app-root')!.textContent =
    'Не удалось загрузить настройки сайта. Обновите страницу позже.';
});
