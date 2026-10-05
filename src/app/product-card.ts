import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Product, formatPrice, webpSet } from './data';
import { NavigationState } from './navigation-state';
@Component({selector:'app-product-card', standalone:true, imports:[RouterLink], template:`
<a class="product-card" [routerLink]="'/item/'+product().slug" [attr.data-product-slug]="product().slug" (click)="open($event)">
  <div class="product-image" [class.placeholder]="!product().photos.length">
    @if (product().photos[0]) { <picture><source type="image/webp" [attr.srcset]="webpSet(product().photos[0])" sizes="(max-width: 700px) 50vw, (max-width: 1000px) 50vw, 25vw"><img [src]="product().photos[0]" [alt]="product().title" width="960" height="1280" loading="lazy" decoding="async" [style.--focus-mobile]="product().focus?.mobile || '50% 50%'" [style.--focus-desktop]="product().focus?.desktop || '50% 50%'"></picture> }
    @else { <span>Фото изделия пока нет</span> }
    <span class="view-hint">Смотреть ↗</span>
  </div>
  <div class="product-meta"><h3>{{product().title}}</h3><p>{{price(product())}}</p></div>
</a>`, changeDetection:ChangeDetectionStrategy.OnPush})
export class ProductCard {
 readonly product = input.required<Product>();
 readonly price = formatPrice;
 readonly webpSet = webpSet;
 private router = inject(Router);
 private nav = inject(NavigationState);
 open(event: MouseEvent) { this.nav.open(this.product().slug, this.router.url, (event.currentTarget as HTMLElement).querySelector('img')); }
}
