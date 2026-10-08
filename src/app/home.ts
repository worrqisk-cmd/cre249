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
import { PHOTOS, webpSet } from './data';
import { CatalogStore } from './catalog-store';
import { ProductCard } from './product-card';
import { NavigationState } from './navigation-state';
import { HomeIntro } from './home-intro';
import { HomeIntroState } from './home-intro-state';
import { homePresentation } from './product-presentation';
@Component({
  standalone: true,
  imports: [RouterLink, ProductCard, HomeIntro],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements AfterViewInit {
  private readonly nav = inject(NavigationState);
  readonly intro = inject(HomeIntroState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  readonly catalog = inject(CatalogStore);
  private animations: ReturnType<typeof animate>[] = [];
  readonly photos = PHOTOS;
  readonly webpSet = webpSet;
  readonly showcase = homePresentation;
  readonly products = computed(() => {
    const all = this.catalog.products();
    const preferred = ['assorti', 'kurnik', 'milka'].flatMap((slug) =>
      all.filter((p) => p.slug === slug),
    );
    return [...preferred, ...all.filter((p) => !preferred.includes(p))].slice(0, 3);
  });
  readonly whatsapp = this.catalog.whatsapp;
  readonly delivery = this.catalog.delivery;
  constructor() {
    void this.catalog.load();
  }
  ngAfterViewInit(): void {
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
