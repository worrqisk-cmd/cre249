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
    [class.is-photo-origin]="nav.itemOrigin() === product().slug"
    [routerLink]="'/item/' + product().slug"
    [attr.data-product-slug]="product().slug"
    (click)="open($event)"
  >
    <div
      class="product-image"
      [class.placeholder]="!photo()"
      [class.photo-contained]="frame()?.fit === 'contain'"
      [class.photo-overview]="!presentation() && !!catalogFrame()"
      [style.--card-photo-ratio]="frame()?.ratio || null"
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
            [style.visibility]="
              nav.itemOrigin() === product().slug ? 'hidden' : null
            "
            [style.--focus-mobile]="
              frame()?.mobile || product().focus?.mobile || '50% 50%'
            "
            [style.--focus-desktop]="
              frame()?.desktop || product().focus?.desktop || '50% 50%'
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
    ratio?: number;
  }>();
  readonly catalogFrame = computed(() => {
    const p = this.product();
    if (p.slug === "slivochno-karamelny") {
      const photo = p.photos.find(
        (src) => src === "photos/archive_085_slivochno-karamelny.jpg",
      );
      return {
        photo,
        desktop: "50% 50%",
        mobile: "50% 50%",
        fit: "contain",
        ratio: 1,
      };
    }
    if (p.slug === "kuraga-oreh")
      return {
        desktop: "50% 50%",
        mobile: "50% 50%",
        fit: "contain",
        ratio: 1078 / 632,
      };
    return undefined;
  });
  readonly frame = computed(() => this.presentation() || this.catalogFrame());
  readonly photo = computed(
    () => this.frame()?.photo || this.product().photos[0] || "",
  );
  readonly price = formatPrice;
  readonly webpSet = webpSet;
  private router = inject(Router);
  readonly nav = inject(NavigationState);
  open(event: MouseEvent) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    this.nav.open(
      this.product().slug,
      this.router.url,
      (event.currentTarget as HTMLElement).querySelector("img"),
      this.photo(),
    );
  }
}
