import { inject, Injectable } from '@angular/core';
import { Category, Product, SiteSettings } from './data';
import { CatalogPhotos } from './catalog-photos';
import { orderedProductPhotos, publicProduct } from './product-mapping';
import { SupabaseService } from './supabase';

export interface PublicCatalogData {
  products: Product[];
  categories: Category[];
  settings: SiteSettings | null;
}

@Injectable({ providedIn: 'root' })
export class PublicCatalogApi {
  private readonly client = inject(SupabaseService).client;
  private readonly photos = inject(CatalogPhotos);

  async load(): Promise<PublicCatalogData> {
    const [products, categories, settings] = await Promise.all([
      this.client
        .from('products')
        .select('*')
        .eq('published', true)
        .order('sort_order')
        .order('slug'),
      this.client.from('categories').select('*').eq('is_public', true).order('sort_order'),
      this.client.from('site_settings').select('*').eq('id', true).maybeSingle(),
    ]);
    if (products.error || categories.error || settings.error) {
      throw products.error || categories.error || settings.error;
    }
    const mapped = await Promise.all(
      (products.data || []).map(async (row) => {
        const ordered = orderedProductPhotos(row);
        const urls = await Promise.all(ordered.map((photo) => this.photos.url(photo)));
        return publicProduct(row, ordered, urls);
      }),
    );
    return { products: mapped, categories: categories.data || [], settings: settings.data };
  }
}
