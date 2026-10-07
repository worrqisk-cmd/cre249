import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  linkedSignal,
} from '@angular/core';
import { form, FormField, required, validate, submit } from '@angular/forms/signals';
import { FieldErrors } from './field-errors';
import { animate } from 'animejs';
import { photoFrame } from './photo-frame';
import { PhotoFlight } from './photo-flight';
import { buildMessage, formatPrice, Product, waLink, webpSet } from './data';
import { CatalogStore } from './catalog-store';
import { NavigationState } from './navigation-state';
@Component({
  selector: 'app-product-dialog',
  standalone: true,
  imports: [FormField, FieldErrors],
  templateUrl: './product-dialog.html',
  styleUrl: './product-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDialog implements AfterViewInit {
  readonly standalone = input(false);
  readonly product = input<Product | null>(null);
  readonly missing = input(false);
  readonly closeRequested = output<void>();
  readonly variant = linkedSignal<string | null>(() => {
    this.product();
    return null;
  });
  readonly composing = linkedSignal(() => {
    this.product();
    return false;
  });
  readonly messageModel = linkedSignal(() => {
    this.product();
    return { text: '' };
  });
  readonly messageForm = form(this.messageModel, (p) => {
    required(p.text, { message: 'Введите сообщение.' });
    validate(p.text, ({ value }) =>
      !value() || value().trim() ? undefined : { kind: 'blank', message: 'Введите сообщение.' },
    );
  });
  readonly message = computed(() => this.messageModel().text);
  readonly copyError = signal('');
  readonly copied = linkedSignal(() => {
    this.product();
    return false;
  });
  readonly selectedPhoto = linkedSignal(() =>
    Math.max(0, this.product()?.photos.indexOf(this.nav.flight?.photo || '') ?? 0),
  );
  readonly description = computed(() => {
    const p = this.product();
    // Replace only the unsupported archive promise, preserving subsequent owner edits.
    return p?.slug === 'assorti' &&
      p.description === 'Сладкий пирог, в котором можно сочетать разные начинки.'
      ? 'Сладкий пирог. Выберите одну начинку для обращения; возможность сочетать несколько уточните у Миланы.'
      : p?.description || '';
  });
  // One frame per product, based on the tallest photo, independent of selection.
  readonly galleryRatio = signal(0.75);
  readonly layoutReady = signal(false);
  readonly photoReady = signal(false);
  readonly currentPhoto = computed(() => this.product()?.photos[this.selectedPhoto()] || '');
  readonly currentFocus = computed(
    () =>
      this.product()?.photoFocus[this.selectedPhoto()] || {
        desktop: '50% 50%',
        mobile: '50% 50%',
      },
  );
  private catalog = inject(CatalogStore);
  readonly price = formatPrice;
  readonly webpSet = webpSet;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroy = inject(DestroyRef);
  private nav = inject(NavigationState);
  private closing = false;
  private flyingImage: PhotoFlight | null = null;
  private animations: ReturnType<typeof animate>[] = [];
  private viewport = typeof window === 'undefined' ? null : window.visualViewport;
  private updateViewport = () => {
    const viewport = this.viewport;
    if (!viewport) return;
    this.host.nativeElement.style.setProperty('--visual-height', `${viewport.height}px`);
    this.host.nativeElement.style.setProperty('--visual-top', `${viewport.offsetTop}px`);
  };
  private onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
    }
    if (event.key === 'Tab' && !this.standalone()) {
      const items = [
        ...this.host.nativeElement.querySelectorAll<HTMLElement>('button,a[href],textarea'),
      ].filter((x) => !x.hasAttribute('disabled') && getComputedStyle(x).visibility !== 'hidden');
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    }
  };
  ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    if (this.standalone()) {
      // Keep the prerendered page's reserved portrait frame stable before and after hydration.
      // Modal galleries can measure their product-specific frame before revealing content.
      this.layoutReady.set(true);
      this.photoReady.set(true);
      document.addEventListener('keydown', this.onKey);
      this.destroy.onDestroy(() => document.removeEventListener('keydown', this.onKey));
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.updateViewport();
    this.viewport?.addEventListener('resize', this.updateViewport);
    this.viewport?.addEventListener('scroll', this.updateViewport);
    document.querySelector('.catalog-page')?.setAttribute('inert', '');
    document.querySelector('header')?.setAttribute('inert', '');
    document.querySelector('.contacts')?.setAttribute('inert', '');
    document.addEventListener('keydown', this.onKey);
    this.host.nativeElement
      .querySelector<HTMLButtonElement>('.dialog-close')
      ?.focus({ preventScroll: true });
    void this.openGallery();
    this.destroy.onDestroy(() => {
      this.viewport?.removeEventListener('resize', this.updateViewport);
      this.viewport?.removeEventListener('scroll', this.updateViewport);
      document.querySelector('.catalog-page')?.removeAttribute('inert');
      document.removeEventListener('keydown', this.onKey);
      document.body.style.overflow = previousOverflow;
      document.querySelector('header')?.removeAttribute('inert');
      document.querySelector('.contacts')?.removeAttribute('inert');
      this.animations.forEach((animation) => animation.cancel());
      this.flyingImage?.remove();
      const target = this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');
      if (target) target.style.visibility = '';
    });
  }
  private async prepareGallery() {
    const photos = this.product()?.photos || [];
    const ratios = await Promise.all(
      photos.map(
        (src) =>
          new Promise<number>((resolve) => {
            const image = new Image();
            // A secondary request must never indefinitely block the decoded primary photo.
            // Unknown dimensions reserve the maximum allowed portrait frame and stay frozen.
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
    // Apply the product's fixed frame before measuring the flight destination.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  private async openGallery() {
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.dialog-panel');
    const backdrop = this.host.nativeElement.querySelector<HTMLElement>('.dialog-backdrop');
    const content = this.host.nativeElement.querySelector<HTMLElement>(
      '.dialog-content, .dialog-missing',
    );
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Start the shell entrance immediately; do not replay it after photo downloads.
    if (!reduced) {
      if (panel)
        this.animations.push(animate(panel, { opacity: [0, 1], duration: 340, ease: 'out(2)' }));
      if (backdrop)
        this.animations.push(animate(backdrop, { opacity: [0, 1], duration: 360, ease: 'out(2)' }));
    }
    await this.prepareGallery();
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
        /* Preserve the browser's failed-image state. */
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
      // The decoded real image and the copy now have identical clip and bitmap geometry.
      requestAnimationFrame(() => {
        if (this.closing || this.destroy.destroyed || this.flyingImage !== flight) return;
        flight.remove();
        this.flyingImage = null;
        this.photoReady.set(true);
      });
    });
  }
  requestClose() {
    if (this.closing) return;
    this.closing = true;
    const done = () => this.closeRequested.emit();
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
          // Keep the matched copy above the restored catalog until scroll/focus restoration renders.
          this.nav.returningPhoto = flight.element;
          this.flyingImage = null;
          done();
        },
        this.currentPhoto() === origin.photo ? undefined : origin.src,
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
  compose() {
    const p = this.product();
    if (!p) return;
    this.messageForm().reset({ text: buildMessage(p, this.variant() || undefined) });
    this.copyError.set('');
    this.composing.set(true);
    setTimeout(() => {
      const textarea = this.host.nativeElement.querySelector('textarea');
      textarea?.focus({ preventScroll: true });
      textarea?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }, 0);
  }
  select(v: string) {
    const p = this.product();
    const previous = this.variant();
    this.variant.set(previous === v ? null : v);
    if (this.composing() && p) {
      const oldContext = p.title + (previous ? ` (начинка: ${previous.toLowerCase()})` : '');
      const nextContext =
        p.title + (this.variant() ? ` (начинка: ${this.variant()!.toLowerCase()})` : '');
      this.messageModel.update((model) => ({ text: model.text.replace(oldContext, nextContext) }));
      this.copied.set(false);
    }
  }
  selectPhoto(index: number) {
    if (this.photoReady()) this.selectedPhoto.set(index);
  }
  link() {
    const number = this.catalog.settings()?.whatsapp_number;
    return number && this.messageForm().valid() ? waLink(number, this.message()) : null;
  }
  async copy() {
    await submit(this.messageForm, async () => {
      this.copyError.set('');
      try {
        await navigator.clipboard.writeText(this.message());
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1800);
      } catch {
        this.copyError.set('Не удалось скопировать. Выделите сообщение и скопируйте его вручную.');
        this.host.nativeElement.querySelector('textarea')?.select();
      }
    });
  }
}
