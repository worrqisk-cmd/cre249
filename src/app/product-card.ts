import {
  ChangeDetectionStrategy,
  Component,
  input,
  inject,
  computed,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { Product, formatPrice, webpSet } from "./data";
import { NavigationState } from "./navigation-state";
@Component({
  selector: "app-product-card",
  standalone: true,
  imports: [RouterLink],
  template: ` <a
    class="product-card"
    [routerLink]="'/item/' + product().slug"
    [attr.data-product-slug]="product().slug"
    (click)="open($event)"
  >
    <div
      class="product-image"
      [class.placeholder]="!photo()"
      [class.photo-contained]="presentation()?.fit === 'contain'"
    >
      @if (photo()) {
        <picture
          ><source
            type="image/webp"
            [attr.srcset]="webpSet(photo())"
            [attr.sizes]="
              presentation()
                ? priority()
                  ? '(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) 33vw, 25vw'
                  : '(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw'
                : '(max-width: 1000px) 50vw, 25vw'
            " />
          <img
            [src]="photo()"
            [alt]="product().title"
            width="960"
            height="1280"
            [attr.loading]="priority() ? 'eager' : 'lazy'"
            [attr.fetchpriority]="priority() ? 'high' : null"
            decoding="async"
            [style.--focus-mobile]="
              presentation()?.mobile || product().focus?.mobile || '50% 50%'
            "
            [style.--focus-desktop]="
              presentation()?.desktop || product().focus?.desktop || '50% 50%'
            "
        /></picture>
      } @else {
        <span class="placeholder-copy"
          ><span aria-hidden="true">◇</span>Фото изделия пока нет</span
        >
      }
      <span class="view-hint">Смотреть ↗</span>
    </div>
    <div class="product-meta">
      <h3>{{ product().title }}</h3>
      <p
        class="product-price"
        [class.price-confirmed]="
          product().price !== null && !!product().priceUnit
        "
      >
        {{ price(product()) }}
      </p>
    </div>
  </a>`,
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
  }>();
  readonly photo = computed(
    () => this.presentation()?.photo || this.product().photos[0] || "",
  );
  readonly price = formatPrice;
  readonly webpSet = webpSet;
  private router = inject(Router);
  private nav = inject(NavigationState);
  open(event: MouseEvent) {
    this.nav.open(
      this.product().slug,
      this.router.url,
      (event.currentTarget as HTMLElement).querySelector("img"),
      this.photo(),
    );
  }
}
