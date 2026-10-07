import { PhotoFrame, photoFrame } from './photo-frame';
import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class NavigationState {
  readonly openedSlugs = new Set<string>();
  returningPhoto: HTMLElement | null = null;
  flight: {
    frame: PhotoFrame;
    restingFrame: PhotoFrame;
    src: string;
    photo?: string;
  } | null = null;
  readonly category = signal('all');
  readonly scrollY = signal(0);
  readonly itemOrigin = signal<string | null>(null);
  open(slug: string, image?: HTMLImageElement | null, photo?: string): void {
    // Снимаем рамки до навигации: при возврате нужна геометрия покоя без hover.
    this.openedSlugs.add(slug);
    this.scrollY.set(window.scrollY);
    this.itemOrigin.set(slug);
    this.flight = image
      ? {
          frame: photoFrame(image),
          restingFrame: photoFrame(image, true),
          src: image.currentSrc || image.src,
          photo,
        }
      : null;
  }
  restoreFocus(): void {
    const slug = this.itemOrigin();
    if (!slug) return;
    const flight = this.flight;
    requestAnimationFrame(() => {
      // Запоздавший callback закрытия не должен вернуть фокус после нового открытия.
      if (this.itemOrigin() !== slug || this.flight !== flight) return;
      // Reuse сохраняет DOM каталога. Для возврата с главной восстанавливаем scroll
      // отдельно; preventScroll не даёт focus запустить второй скачок.
      if (window.scrollY !== this.scrollY())
        window.scrollTo({ top: this.scrollY(), behavior: 'instant' });
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
