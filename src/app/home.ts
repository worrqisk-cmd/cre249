import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate } from 'animejs';
import {
  CONTACT_MESSAGE,
  DEFAULT_DELIVERY,
  PHOTOS,
  Product,
  PROTOTYPE_WHATSAPP,
  waLink,
  webpSet,
} from './data';
import { CatalogStore } from './catalog-store';
import { ProductCard } from './product-card';
import { NavigationState } from './navigation-state';
import { HomeIntro } from './home-intro';
import { HomeIntroState } from './home-intro-state';
@Component({
  standalone: true,
  imports: [RouterLink, ProductCard, HomeIntro],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements AfterViewInit {
  private nav = inject(NavigationState);
  readonly intro = inject(HomeIntroState);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroy = inject(DestroyRef);
  readonly catalog = inject(CatalogStore);
  private animations: ReturnType<typeof animate>[] = [];
  readonly photos = PHOTOS;
  readonly webpSet = webpSet;
  showcase(product: Product) {
    if (product.slug === 'assorti') {
      const photo = product.photos.find((photo) => photo === 'photos/archive_063_assorti.jpg');
      if (photo) return { photo, desktop: '50% 55%', mobile: '50% 65%', fit: 'cover' };
    }
    if (product.slug === 'kurnik') return { desktop: '50% 100%', mobile: '50% 90%', fit: 'cover' };
    if (product.slug === 'milka') return { desktop: '50% 50%', mobile: '50% 55%', fit: 'contain' };
    return undefined;
  }
  readonly products = computed(() => {
    const all = this.catalog.products();
    const preferred = ['assorti', 'kurnik', 'milka'].flatMap((slug) =>
      all.filter((p) => p.slug === slug),
    );
    return [...preferred, ...all.filter((p) => !preferred.includes(p))].slice(0, 3);
  });
  readonly contactNumber = computed(
    () =>
      this.catalog.settings()?.whatsapp_number ||
      (this.catalog.state() === 'error' ? PROTOTYPE_WHATSAPP : null),
  );
  readonly whatsapp = computed(() =>
    this.contactNumber() ? waLink(this.contactNumber()!, CONTACT_MESSAGE) : null,
  );
  readonly delivery = computed(() => this.catalog.settings()?.delivery_text || DEFAULT_DELIVERY);
  constructor() {
    void this.catalog.load();
  }
  ngAfterViewInit() {
    if (typeof window === 'undefined') return;
    if (this.nav.itemOrigin()) setTimeout(() => this.nav.restoreFocus(), 50);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.destroy.onDestroy(() => this.animations.forEach((animation) => animation.cancel()));
    if (reduced || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const children = entry.target.querySelectorAll<HTMLElement>('[data-reveal-child]');
            const targets = children.length ? [...children] : [entry.target as HTMLElement];
            targets.forEach((el, i) =>
              this.animations.push(
                animate(el, {
                  opacity: [0, 1],
                  translateY: [16, 0],
                  duration: 420,
                  delay: i * 70,
                  ease: 'out(3)',
                }),
              ),
            );
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' },
    );
    this.host.nativeElement.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    this.destroy.onDestroy(() => io.disconnect());
  }
}
