import { PathSerializer } from "./path-serializer";
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from "@angular/core";
import { provideRouter, UrlSerializer } from "@angular/router";
import { routes } from "./app.routes";
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    { provide: UrlSerializer, useClass: PathSerializer },
  ],
};
