import { provideClientHydration } from '@angular/platform-browser';
import { PathSerializer } from './path-serializer';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, RouteReuseStrategy, UrlSerializer } from '@angular/router';
import { CatalogRouteReuse } from './catalog-route-reuse';
import { routes } from './app.routes';
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideClientHydration(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: CatalogRouteReuse },
    { provide: UrlSerializer, useClass: PathSerializer },
  ],
};
