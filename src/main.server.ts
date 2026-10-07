import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, withRoutes, RenderMode, PrerenderFallback } from '@angular/ssr';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { SITE_CONFIG } from './app/site-config';
import { STATIC_CATALOG } from './app/catalog-store';
import { readFile } from 'node:fs/promises';
import { Product, Category, SiteSettings } from './app/data';
export default async (context: BootstrapContext) => {
  const snapshot = JSON.parse(await readFile('src/app/static-catalog.json', 'utf8')) as {
    products: Product[];
    categories: Category[];
    settings: SiteSettings;
  };
  const config = JSON.parse(await readFile('public/site-config.json', 'utf8'));
  return bootstrapApplication(
    App,
    {
      providers: [
        ...appConfig.providers,
        { provide: SITE_CONFIG, useValue: config },
        { provide: STATIC_CATALOG, useValue: snapshot },
        provideServerRendering(
          withRoutes([
            { path: '', renderMode: RenderMode.Prerender },
            { path: 'catalog', renderMode: RenderMode.Prerender },
            {
              path: 'catalog/:category',
              renderMode: RenderMode.Prerender,
              fallback: PrerenderFallback.None,
              getPrerenderParams: async () => snapshot.categories.map((c) => ({ category: c.id })),
            },
            {
              path: 'item/:slug',
              renderMode: RenderMode.Prerender,
              fallback: PrerenderFallback.None,
              getPrerenderParams: async () => snapshot.products.map((p) => ({ slug: p.slug })),
            },
            { path: '**', renderMode: RenderMode.Client },
          ]),
        ),
      ],
    },
    context,
  );
};
