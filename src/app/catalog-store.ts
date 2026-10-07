import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  CONTACT_MESSAGE,
  DEFAULT_DELIVERY,
  Product,
  SiteSettings,
  PROTOTYPE_WHATSAPP,
  telegramLink,
  waLink,
} from './data';
import { PublicCatalogApi, PublicCatalogData } from './public-catalog-api';

export const STATIC_CATALOG = new InjectionToken<PublicCatalogData & { settings: SiteSettings }>(
  'static catalog',
);

@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly api = inject(PublicCatalogApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly state = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  readonly products = signal<Product[]>([]);
  readonly categories = signal<PublicCatalogData['categories']>([]);
  readonly settings = signal<SiteSettings | null>(null);
  readonly contactNumber = computed(
    () =>
      this.settings()?.whatsapp_number || (this.state() === 'error' ? PROTOTYPE_WHATSAPP : null),
  );
  readonly whatsapp = computed(() => {
    const number = this.contactNumber();
    return number ? waLink(number, CONTACT_MESSAGE) : null;
  });
  readonly telegram = computed(() => {
    const username = this.settings()?.telegram_username;
    return username ? telegramLink(username) : null;
  });
  readonly delivery = computed(() => this.settings()?.delivery_text || DEFAULT_DELIVERY);
  private inFlight: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshAt = 0;

  constructor() {
    this.destroy.onDestroy(() => clearTimeout(this.refreshTimer));
    const snapshot = inject(STATIC_CATALOG, { optional: true });
    if (snapshot) {
      this.products.set(snapshot.products);
      this.categories.set(snapshot.categories);
      this.settings.set(snapshot.settings);
      this.state.set('ok');
      this.refreshAt = Infinity;
    }
  }

  load(force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!force && this.state() === 'ok' && Date.now() < this.refreshAt) return Promise.resolve();
    if (this.state() !== 'ok') this.state.set('loading');
    this.inFlight = this.fetchAll().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetchAll(): Promise<void> {
    try {
      const data = await this.api.load();
      if (this.destroy.destroyed) return;
      this.products.set(data.products);
      this.categories.set(data.categories);
      this.settings.set(data.settings);
      this.state.set('ok');
      this.refreshAt = Date.now() + 8 * 60_000;
      this.scheduleRefresh();
    } catch {
      if (this.destroy.destroyed) return;
      this.products.set([]);
      this.categories.set([]);
      this.settings.set(null);
      this.state.set('error');
    }
  }

  private scheduleRefresh(): void {
    if (!this.isBrowser || this.destroy.destroyed) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () => {
        // Во время изделия не пересобираем фон каталога и не меняем signed URL
        // под галереей. Проверяем маршрут, без зависимости store от CSS-классов DOM.
        const itemOpen = this.router.url.startsWith('/item/');
        if (document.visibilityState === 'visible' && !itemOpen) void this.load(true);
        else this.refreshTimer = setTimeout(() => this.scheduleRefresh(), 30_000);
      },
      Math.max(1000, this.refreshAt - Date.now()),
    );
  }
}
