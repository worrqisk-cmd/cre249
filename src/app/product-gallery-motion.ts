import { DestroyRef, ElementRef, inject, Injectable, signal } from '@angular/core';
import { animate } from 'animejs';
import { NavigationState } from './navigation-state';
import { PhotoFlight } from './photo-flight';
import { photoFrame } from './photo-frame';
import { webpSet } from './data';

/** Декодирование и движение галереи; размеры и длительности сохранены. */
@Injectable()
export class ProductGalleryMotion {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  private readonly nav = inject(NavigationState);
  readonly galleryRatio = signal(0.75);
  readonly layoutReady = signal(false);
  readonly photoReady = signal(false);
  private closing = false;
  private flyingImage: PhotoFlight | null = null;
  private animations: ReturnType<typeof animate>[] = [];

  constructor() {
    this.destroy.onDestroy(() => {
      this.animations.forEach((animation) => animation.cancel());
      this.flyingImage?.remove();
      const target = this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');
      if (target) target.style.visibility = '';
    });
  }

  showStandalone(): void {
    // Prerender уже зарезервировал портретную рамку: при клиентском bootstrap
    // сохраняем её. Настоящая Angular hydration в текущем appConfig не включена.
    this.layoutReady.set(true);
    this.photoReady.set(true);
  }
  private async prepareGallery(photos: string[]): Promise<void> {
    const ratios = await Promise.all(
      photos.map(
        (src) =>
          new Promise<number>((resolve) => {
            const image = new Image();
            // Второе фото не должно бесконечно блокировать основное. При таймауте
            // резервируем максимальную портретную рамку и больше не меняем её.
            const timeout = setTimeout(() => finish(0.5), 1500);
            const finish = (ratio: number) => {
              clearTimeout(timeout);
              image.onload = image.onerror = null;
              resolve(ratio);
            };
            image.onload = () => finish(image.naturalWidth / image.naturalHeight);
            image.onerror = () => finish(0.5);
            image.src = webpSet(src) ? src.replace(/\.jpg$/, '-480.webp') : src;
          }),
      ),
    );
    if (this.destroy.destroyed || this.closing) return;
    if (ratios.length) this.galleryRatio.set(Math.max(0.5, Math.min(...ratios)));
    // Ждём применения рамки к DOM, прежде чем измерять назначение копии.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  async open(photos: string[]): Promise<void> {
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.dialog-panel');
    const backdrop = this.host.nativeElement.querySelector<HTMLElement>('.dialog-backdrop');
    const content = this.host.nativeElement.querySelector<HTMLElement>(
      '.dialog-content, .dialog-missing',
    );
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Оболочка появляется сразу; завершение скачивания фото не перезапускает вход.
    if (!reduced) {
      if (panel)
        this.animations.push(animate(panel, { opacity: [0, 1], duration: 340, ease: 'out(2)' }));
      if (backdrop)
        this.animations.push(animate(backdrop, { opacity: [0, 1], duration: 360, ease: 'out(2)' }));
    }
    await this.prepareGallery(photos);
    if (this.destroy.destroyed || this.closing) return;
    const target = this.host.nativeElement.querySelector<HTMLImageElement>(
      '.dialog-photo picture img',
    );
    if (target) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          target.decode(),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 1500);
          }),
        ]);
      } catch {
        // Ошибка декодирования оставляет штатное состояние img и не блокирует диалог.
      } finally {
        clearTimeout(timer);
      }
    }
    if (this.destroy.destroyed || this.closing) return;
    this.layoutReady.set(true);
    if (reduced) {
      this.photoReady.set(true);
      return;
    }
    if (content)
      this.animations.push(
        animate(content, {
          opacity: [0, 1],
          translateX: [10, 0],
          duration: 340,
          ease: 'out(2)',
        }),
      );
    const origin = this.nav.flight;
    if (!origin || !target?.naturalWidth) {
      this.photoReady.set(true);
      return;
    }
    const flight = new PhotoFlight(origin.src, origin.frame);
    this.flyingImage = flight;
    target.style.visibility = 'hidden';
    flight.move(photoFrame(target), 410, () => {
      if (this.closing || this.destroy.destroyed || this.flyingImage !== flight) return;
      target.style.visibility = '';
      // Передаём изображение настоящему img после совпадения рамки и bitmap.
      // Дополнительный кадр не даёт исчезнуть копии раньше отрисовки img.
      requestAnimationFrame(() => {
        if (this.closing || this.destroy.destroyed || this.flyingImage !== flight) return;
        flight.remove();
        this.flyingImage = null;
        this.photoReady.set(true);
      });
    });
  }
  close(done: () => void, currentPhoto: string): void {
    if (this.closing) return;
    this.closing = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.dialog-panel');
    const backdrop = this.host.nativeElement.querySelector<HTMLElement>('.dialog-backdrop');
    const target = this.host.nativeElement.querySelector<HTMLImageElement>(
      '.dialog-photo picture img',
    );
    const origin = this.nav.flight;
    // Быстрые повторные действия не должны завершить старый вход поверх закрытия.
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
    if (backdrop)
      this.animations.push(animate(backdrop, { opacity: 0, duration: 330, ease: 'inOut(2)' }));
    if (origin && target?.naturalWidth) {
      const flight =
        this.flyingImage || new PhotoFlight(target.currentSrc || target.src, photoFrame(target));
      this.flyingImage = flight;
      target.style.visibility = 'hidden';
      if (panel)
        this.animations.push(animate(panel, { opacity: 0, duration: 310, ease: 'inOut(2)' }));
      const cardImage = document.querySelector<HTMLImageElement>(
        `[data-product-slug="${this.nav.itemOrigin()}"] img`,
      );
      flight.move(
        cardImage ? photoFrame(cardImage, true) : origin.restingFrame,
        330,
        () => {
          // Копия остаётся над каталогом до кадра восстановления scroll/focus;
          // NavigationState удалит её только после появления исходной карточки.
          this.nav.returningPhoto = flight.element;
          this.flyingImage = null;
          done();
        },
        currentPhoto === origin.photo ? undefined : origin.src,
      );
    } else if (panel)
      this.animations.push(
        animate(panel, {
          opacity: 0,
          duration: 310,
          ease: 'inOut(2)',
          onComplete: done,
        }),
      );
    else done();
  }
}
