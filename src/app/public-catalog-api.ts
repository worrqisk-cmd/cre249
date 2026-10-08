import { inject, Injectable } from '@angular/core';
import { Category, Product, ProductPhoto, SiteSettings } from './data';
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
    const rows = products.data || [];
    const ordered = rows.map(orderedProductPhotos);
    const urls = await this.photoUrls(ordered.flat());
    let offset = 0;
    const mapped = rows.map((row, index) => {
      const photos = ordered[index];
      const product = publicProduct(row, photos, urls.slice(offset, offset + photos.length));
      offset += photos.length;
      return product;
    });
    return { products: mapped, categories: categories.data || [], settings: settings.data };
  }

  private async photoUrls(photos: ProductPhoto[]): Promise<string[]> {
    const urls = Array<string>(photos.length).fill('');
    let next = 0;
    // One attempt per photo per refresh, at most four signing requests at once.
    // A Storage 429 is a missing slot, not a failed catalog or an automatic retry loop.
    const worker = async () => {
      while (next < photos.length) {
        const index = next++;
        try {
          urls[index] = await this.photos.url(photos[index]);
        } catch {
          urls[index] = '';
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, photos.length) }, worker));
    return urls;
  }
}
