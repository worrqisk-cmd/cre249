import { ChangeDetectionStrategy, Component, input, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Product, formatPrice, webpSet } from './data';
import { NavigationState } from './navigation-state';
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly priority = input(false);
  readonly presentation = input<{
    photo?: string;
    desktop: string;
    mobile: string;
    fit: string;
    ratio?: number;
  }>();
  readonly catalogFrame = computed(() => {
    const p = this.product();
    if (p.slug === 'slivochno-karamelny') {
      const photo = p.photos.find((src) => src === 'photos/archive_085_slivochno-karamelny.jpg');
      return {
        photo,
        desktop: '50% 50%',
        mobile: '50% 50%',
        fit: 'contain',
        ratio: 1,
      };
    }
    if (p.slug === 'kuraga-oreh')
      return {
        desktop: '50% 50%',
        mobile: '50% 50%',
        fit: 'contain',
        ratio: 1078 / 632,
      };
    return undefined;
  });
  readonly frame = computed(() => this.presentation() || this.catalogFrame());
  readonly photo = computed(() => this.frame()?.photo || this.product().photos[0] || '');
  readonly price = formatPrice;
  readonly webpSet = webpSet;
  private router = inject(Router);
  readonly nav = inject(NavigationState);
  open(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    this.nav.open(
      this.product().slug,
      this.router.url,
      (event.currentTarget as HTMLElement).querySelector('img'),
      this.photo(),
    );
  }
}
