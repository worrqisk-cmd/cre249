import { PhotoFrame, photoFrame } from "./photo-frame";
import { Injectable, signal } from "@angular/core";
@Injectable({ providedIn: "root" })
export class NavigationState {
  readonly openedSlugs = new Set<string>();
  returningPhoto: HTMLElement | null = null;
  flight: {
    frame: PhotoFrame;
    restingFrame: PhotoFrame;
    src: string;
    photo?: string;
  } | null = null;
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
    this.openedSlugs.add(slug);
    this.scrollY.set(window.scrollY);
    this.itemOrigin.set(slug);
    this.priorUrl.set(url);
    this.flight = image
      ? {
          frame: photoFrame(image),
          restingFrame: photoFrame(image, true),
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
      const returning = this.returningPhoto;
      requestAnimationFrame(() => {
        returning?.remove();
        if (this.returningPhoto === returning) this.returningPhoto = null;
      });
    });
  }
}
