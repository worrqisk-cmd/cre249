import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { publicDescription } from './data';
import { CatalogStore } from './catalog-store';
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogStore);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private url = signal('/');
  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.url.set(event.urlAfterRedirects);
    });
    effect(() => {
      const path = this.url().split(/[?#]/)[0].replace(/\/$/, '') || '/';
      const product = this.catalog.products().find((p) => path === `/item/${p.slug}`);
      const category = this.catalog.categories().find((c) => path === `/catalog/${c.id}`);
      const service =
        path.startsWith('/admin') ||
        (!product && !category && !['/', '/catalog'].includes(path)) ||
        (path.startsWith('/item/') && !product);
      const name =
        product?.title ||
        category?.label ||
        (path.startsWith('/catalog')
          ? 'Каталог домашней выпечки'
          : service
            ? 'Служебная страница'
            : 'Домашняя выпечка в Москве');
      this.title.setTitle(`${name} — Выпечка у Миланы`);
      this.meta.updateTag({
        name: 'description',
        content: product
          ? `${product.title}. ${publicDescription(product)} Обсудите заказ с Миланой в WhatsApp.`
          : category
            ? `${category.label} от Миланы в Москве. Выберите изделие и обсудите заказ в WhatsApp.`
            : path.startsWith('/catalog')
              ? 'Каталог пирогов, тортов и десертов Миланы в Москве. Начинки и заказ в WhatsApp.'
              : 'Домашние пироги, торты и десерты Миланы в Москве. Выберите изделие и обсудите заказ в WhatsApp.',
      });
      this.meta.updateTag({
        name: 'robots',
        // Клиентский fallback не превращает ответ Pages 404 в индексируемый HTTP 200.
        content:
          service || this.document.querySelector('meta[name="app-http-status"][content="404"]')
            ? 'noindex, nofollow'
            : 'index, follow',
      });
      let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = this.document.createElement('link');
        link.rel = 'canonical';
        this.document.head.appendChild(link);
      }
      link.href = `https://milana-pechet.ru${path === '/' ? '/' : path + '/'}`;
    });
  }
}
