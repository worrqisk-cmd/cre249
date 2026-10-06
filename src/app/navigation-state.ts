import { Injectable, signal } from "@angular/core";
@Injectable({ providedIn: "root" })
export class NavigationState {
  flight: { rect: DOMRect; src: string; photo?: string } | null = null;
  readonly category = signal("all");
  readonly scrollY = signal(0);
  readonly itemOrigin = signal<string | null>(null);
  readonly priorUrl = signal<string | null>(null);
  open(
    slug: string,
    url: string,
    image?: HTMLImageElement | null,
    photo?: string,
  ) {
    this.scrollY.set(window.scrollY);
    this.itemOrigin.set(slug);
    this.priorUrl.set(url);
    this.flight = image
      ? {
          rect: image.getBoundingClientRect(),
          src: image.currentSrc || image.src,
          photo,
        }
      : null;
  }
  restoreFocus() {
    const slug = this.itemOrigin();
    if (!slug) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: this.scrollY(), behavior: "instant" });
      document
        .querySelector<HTMLElement>(`[data-product-slug="${slug}"]`)
        ?.focus({ preventScroll: true });
      this.itemOrigin.set(null);
    });
  }
}
