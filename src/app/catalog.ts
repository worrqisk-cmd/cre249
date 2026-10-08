import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryId } from './data';
import { CatalogStore } from './catalog-store';
import { NavigationState } from './navigation-state';
import { ProductCard } from './product-card';
import { ProductDialog } from './product-dialog';
@Component({
  standalone: true,
  imports: [RouterLink, ProductCard, ProductDialog],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  readonly catalog = inject(CatalogStore);
  readonly nav = inject(NavigationState);
  readonly categories = computed(() => [{ id: 'all', label: 'Все' }, ...this.catalog.categories()]);
  readonly category = signal<CategoryId>('all');
  readonly slug = signal<string | null>(null);
  readonly dialog = computed(
    () => this.catalog.products().find((product) => product.slug === this.slug()) || null,
  );
  readonly standalone = computed(() => !!this.slug() && !this.nav.openedSlugs.has(this.slug()!));
  readonly missing = computed(() => !!this.slug() && !this.dialog());
  readonly state = this.catalog.state;
  readonly indicator = signal({ left: 0, top: 0, width: 0 });
  readonly products = computed(() =>
    this.catalog
      .products()
      .filter((p) => this.category() === 'all' || p.category === this.category())
      .sort((a, b) => Number(!!b.photos.length) - Number(!!a.photos.length)),
  );
  private sub = this.route.paramMap.subscribe((params) => {
    const categoryId = params.get('category');
    const slug = params.get('slug');
    if (categoryId) this.nav.category.set(categoryId);
    this.category.set(categoryId || this.nav.category());
    this.slug.set(slug);
    if (slug && this.nav.openedSlugs.has(slug)) this.nav.itemOrigin.set(slug);
    if (typeof window !== 'undefined')
      requestAnimationFrame(() => {
        if (!this.destroy.destroyed) this.moveIndicator();
      });
  });
  constructor() {
    void this.catalog.load();
    this.destroy.onDestroy(() => this.sub.unsubscribe());
  }
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => this.moveIndicator());
    const categories = this.host.nativeElement.querySelector('.category-list');
    if (categories && typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(() => this.moveIndicator());
      resize.observe(categories);
      this.destroy.onDestroy(() => resize.disconnect());
    }
  }
  choose(categoryId: CategoryId): void {
    this.nav.category.set(categoryId);
    this.category.set(categoryId);
    requestAnimationFrame(() => this.moveIndicator());
    void this.router.navigateByUrl(categoryId === 'all' ? '/catalog' : `/catalog/${categoryId}`);
  }
  private moveIndicator(): void {
    const active = this.host.nativeElement.querySelector<HTMLElement>(
      '.category-list button.active',
    );
    if (active)
      this.indicator.set({
        left: active.offsetLeft,
        top: active.offsetTop + active.offsetHeight + 4,
        width: active.offsetWidth,
      });
  }
  close(): void {
    if (!this.standalone()) {
      history.back();
    } else
      this.router.navigateByUrl(
        this.nav.category() === 'all' ? '/catalog' : `/catalog/${this.nav.category()}`,
      );
  }
  retry(): void {
    void this.catalog.load();
  }
}
