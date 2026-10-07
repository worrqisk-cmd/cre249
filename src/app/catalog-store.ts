import { computed, inject, Injectable, signal, InjectionToken } from '@angular/core';
import { Category, Product, ProductPhoto, ProductRow, SiteSettings } from './data';
import { PHOTO_BUCKET, SupabaseService } from './supabase';

export const STATIC_CATALOG = new InjectionToken<{
  products: Product[];
  categories: Category[];
  settings: SiteSettings;
}>('static catalog');

@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private supabase = inject(SupabaseService).client;
  readonly state = signal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly settings = signal<SiteSettings | null>(null);
  readonly featured = computed(() =>
    this.products()
      .filter((product) => product.featured)
      .slice(0, 8),
  );
  private inFlight: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshAt = 0;

  constructor() {
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
    this.inFlight = this.fetchAll().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  private async fetchAll() {
    try {
      const [products, categories, settings] = await Promise.all([
        this.supabase
          .from('products')
          .select('*')
          .eq('published', true)
          .order('sort_order')
          .order('slug'),
        this.supabase.from('categories').select('*').eq('is_public', true).order('sort_order'),
        this.supabase.from('site_settings').select('*').eq('id', true).maybeSingle(),
      ]);
      if (products.error || categories.error || settings.error)
        throw products.error || categories.error || settings.error;
      const mapped = await Promise.all(
        ((products.data || []) as ProductRow[]).map((row) => this.mapProduct(row)),
      );
      this.products.set(mapped);
      this.categories.set((categories.data || []) as Category[]);
      this.settings.set(settings.data as SiteSettings | null);
      this.state.set('ok');
      this.refreshAt = Date.now() + 8 * 60_000;
      this.scheduleRefresh();
    } catch {
      this.products.set([]);
      this.categories.set([]);
      this.settings.set(null);
      this.state.set('error');
    }
  }

  private scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () => {
        if (document.visibilityState === 'visible' && !document.querySelector('.dialog-panel'))
          void this.load(true);
        else this.refreshTimer = setTimeout(() => this.scheduleRefresh(), 30_000);
      },
      Math.max(1000, this.refreshAt - Date.now()),
    );
  }

  private async mapProduct(row: ProductRow): Promise<Product> {
    const ordered = [...row.photos];
    if (row.primary_photo > 0 && row.primary_photo < ordered.length) {
      ordered.unshift(ordered.splice(row.primary_photo, 1)[0]);
    }
    const photos = await Promise.all(ordered.map((photo) => this.photoUrl(photo)));
    const main = ordered[0];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category_id,
      fillings: row.fillings || [],
      price: row.price,
      priceUnit: row.price_unit,
      photos: photos.filter(Boolean),
      focus: main
        ? { desktop: main.desktop || '50% 50%', mobile: main.mobile || '50% 50%' }
        : undefined,
      photoFocus: ordered.map((photo) => ({
        desktop: photo.desktop || '50% 50%',
        mobile: photo.mobile || '50% 50%',
      })),
      featured: row.featured,
      availability: row.availability,
    };
  }

  async photoUrl(photo: ProductPhoto): Promise<string> {
    if (photo.static) return photo.static;
    if (!photo.path) return '';
    const { data, error } = await this.supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(photo.path, 600);
    if (error || !data) throw error || new Error('Photo is unavailable');
    return data.signedUrl;
  }
}
