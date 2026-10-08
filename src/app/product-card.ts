import {
  ChangeDetectionStrategy,
  Component,
  input,
  inject,
  computed,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, formatPrice, webpSet } from './data';
import { NavigationState } from './navigation-state';
import { CardPresentation, catalogPresentation } from './product-presentation';
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
  readonly presentation = input<CardPresentation>();
  readonly catalogFrame = computed(() => catalogPresentation(this.product()));
  readonly imageSizes = computed(() => {
    if (!this.presentation()) return '(max-width: 1000px) 50vw, 25vw';
    return this.priority()
      ? '(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) 33vw, 25vw'
      : '(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw';
  });
  readonly isPhotoOrigin = computed(() => this.nav.itemOrigin() === this.product().slug);
  readonly frame = computed(() => this.presentation() || this.catalogFrame());
  readonly photo = computed(() => this.frame()?.photo || this.product().photos[0] || '');
  readonly photoFailed = linkedSignal(() => {
    this.photo();
    return false;
  });
  readonly price = formatPrice;
  readonly webpSet = webpSet;
  readonly nav = inject(NavigationState);
  open(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    this.nav.open(this.product().slug, event.currentTarget.querySelector('img'), this.photo());
  }
}
