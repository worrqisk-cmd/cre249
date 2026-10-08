import { inject, Injectable } from '@angular/core';
import { ProductPhoto } from './data';
import { PHOTO_BUCKET, SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class CatalogPhotos {
  private readonly bucket = inject(SupabaseService).client.storage.from(PHOTO_BUCKET);

  async url(photo: ProductPhoto): Promise<string> {
    if (photo.static) return photo.static;
    if (!photo.path) return '';
    const { data, error } = await this.bucket.createSignedUrl(photo.path, 600);
    if (error || !data) throw error || new Error('Photo is unavailable');
    return data.signedUrl;
  }

  async upload(productId: string, file: File): Promise<ProductPhoto> {
    const extension =
      file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `products/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.bucket.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return { path, desktop: '50% 50%', mobile: '50% 50%' };
  }

  async remove(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.bucket.remove(paths);
    if (error) throw error;
  }
}
