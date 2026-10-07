import { inject, Injectable } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  BaseRouteReuseStrategy,
} from "@angular/router";

import { NavigationState } from "./navigation-state";

/** A product opened from the catalog is an overlay on the same catalog DOM. */
@Injectable()
export class CatalogRouteReuse extends BaseRouteReuseStrategy {
  private readonly nav = inject(NavigationState);

  private isCatalogView(route: ActivatedRouteSnapshot): boolean {
    const slug = route.paramMap.get("slug");
    return (
      route.routeConfig?.data?.["preserveCatalog"] === true &&
      (!slug || this.nav.openedSlugs.has(slug))
    );
  }
  override shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    current: ActivatedRouteSnapshot,
  ): boolean {
    return (
      (this.isCatalogView(future) && this.isCatalogView(current)) ||
      super.shouldReuseRoute(future, current)
    );
  }
}
