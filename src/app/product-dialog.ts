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
  linkedSignal,
} from '@angular/core';
import { OrderMessage } from './order-message';
import { formatPrice, Product, webpSet } from './data';
import { NavigationState } from './navigation-state';
import { ProductGalleryMotion } from './product-gallery-motion';
import { ProductDialogEnvironment } from './product-dialog-environment';
@Component({
  selector: 'app-product-dialog',
  standalone: true,
  providers: [ProductGalleryMotion, ProductDialogEnvironment],
  imports: [OrderMessage],
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
  readonly selectedPhoto = linkedSignal(() => {
    const origin = this.nav.flight?.photo;
    // Without an origin, start with the cover, not the first unavailable URL slot.
    return origin ? Math.max(0, this.product()?.photos.indexOf(origin) ?? 0) : 0;
  });
  readonly description = computed(() => {
    const p = this.product();
    // Исправляем только неподтверждённую фразу архива, сохраняя новые правки владельца.
    return p?.slug === 'assorti' &&
      p.description === 'Сладкий пирог, в котором можно сочетать разные начинки.'
      ? 'Сладкий пирог. Выберите одну начинку для обращения; возможность сочетать несколько уточните у Миланы.'
      : p?.description || '';
  });
  // Одна рамка на изделие: смена фотографии не сдвигает содержимое галереи.
  private readonly gallery = inject(ProductGalleryMotion);
  readonly galleryRatio = this.gallery.galleryRatio;
  readonly layoutReady = this.gallery.layoutReady;
  readonly photoReady = this.gallery.photoReady;
  readonly currentPhoto = computed(() => this.product()?.photos[this.selectedPhoto()] || '');
  readonly failedPhotos = linkedSignal(() => {
    this.product();
    return new Set<string>();
  });
  photoUnavailable(photo: string): boolean {
    return !photo || this.failedPhotos().has(photo);
  }
  markPhotoUnavailable(photo: string): void {
    this.failedPhotos.update((failed) => new Set(failed).add(photo));
  }
  readonly currentFocus = computed(
    () =>
      this.product()?.photoFocus[this.selectedPhoto()] || {
        desktop: '50% 50%',
        mobile: '50% 50%',
      },
  );
  readonly price = formatPrice;
  readonly webpSet = webpSet;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  private readonly nav = inject(NavigationState);
  private readonly environment = inject(ProductDialogEnvironment);

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.environment.attach(this.standalone(), () => this.requestClose());
    if (this.standalone()) this.gallery.showStandalone();
    else void this.gallery.open(this.product()?.photos || []);
  }

  requestClose(): void {
    this.gallery.close(() => this.closeRequested.emit(), this.currentPhoto());
  }
  compose(): void {
    if (!this.product()) return;
    this.composing.set(true);
    setTimeout(() => {
      if (this.destroy.destroyed) return;
      const textarea = this.host.nativeElement.querySelector('textarea');
      textarea?.focus({ preventScroll: true });
      textarea?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }, 0);
  }

  select(variant: string): void {
    this.variant.set(this.variant() === variant ? null : variant);
  }
  selectPhoto(index: number): void {
    if (this.photoReady()) this.selectedPhoto.set(index);
  }
}
