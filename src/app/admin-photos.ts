import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { CatalogPhotos } from './catalog-photos';
import { ProductPhoto } from './data';

export function validUpload(file: File): boolean {
  return (
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 8 * 1024 * 1024
  );
}

/** Keep the same file after removal; a deleted cover falls back to the first remaining photo. */
export function primaryPhotoIndex(
  photos: ProductPhoto[],
  primary: ProductPhoto | undefined,
): number {
  if (!primary) return 0;
  const index = photos.findIndex(
    (photo) =>
      photo === primary ||
      (!!primary.path && photo.path === primary.path) ||
      (!!primary.static && photo.static === primary.static),
  );
  return Math.max(0, index);
}

/** Жизненный цикл файлов одного редактора; состояние не разделяется между страницами. */
@Injectable()
export class AdminPhotos {
  private readonly storage = inject(CatalogPhotos);
  private readonly destroy = inject(DestroyRef);
  readonly previews = signal<string[]>([]);
  readonly uploading = signal(false);
  private readonly pendingRemovals = new Set<string>();
  private readonly uncommittedUploads = new Set<string>();
  private previewVersion = 0;

  beginEdit(photos: ProductPhoto[]): void {
    this.pendingRemovals.clear();
    this.uncommittedUploads.clear();
    this.previews.set([]);
    void this.updatePreviews(photos);
  }

  async updatePreviews(photos: ProductPhoto[]): Promise<void> {
    const version = ++this.previewVersion;
    const urls = await Promise.all(photos.map((photo) => this.storage.url(photo).catch(() => '')));
    // Быстрая смена изделия не должна принять запоздавшие URL предыдущего редактора.
    if (!this.destroy.destroyed && version === this.previewVersion) this.previews.set(urls);
  }

  async upload(
    file: File,
    productId: string,
    photos: ProductPhoto[],
    replaceIndex?: number,
  ): Promise<ProductPhoto[]> {
    this.uploading.set(true);
    try {
      const photo = await this.storage.upload(productId, file);
      if (photo.path) this.uncommittedUploads.add(photo.path);
      const next = [...photos];
      if (replaceIndex === undefined) next.push(photo);
      else {
        const previous = next[replaceIndex];
        if (previous?.path) this.pendingRemovals.add(previous.path);
        next[replaceIndex] = {
          ...photo,
          desktop: previous?.desktop || photo.desktop,
          mobile: previous?.mobile || photo.mobile,
        };
      }
      await this.updatePreviews(next);
      return next;
    } finally {
      this.uploading.set(false);
    }
  }

  remove(photos: ProductPhoto[], index: number): ProductPhoto[] {
    const next = [...photos];
    const [removed] = next.splice(index, 1);
    if (removed?.path) {
      if (this.uncommittedUploads.delete(removed.path)) {
        void this.storage.remove([removed.path]).catch(() => {});
      } else this.pendingRemovals.add(removed.path);
    }
    this.previewVersion++;
    this.previews.update((urls) => urls.filter((_, photoIndex) => photoIndex !== index));
    return next;
  }

  async discard(): Promise<void> {
    const paths = [...this.uncommittedUploads];
    this.uncommittedUploads.clear();
    this.pendingRemovals.clear();
    await this.storage.remove(paths);
  }

  async commit(): Promise<boolean> {
    // Старые файлы удаляются только после успешной записи photos в products.
    // Ошибка очистки не превращает уже сохранённое изделие в неудачную отправку.
    this.uncommittedUploads.clear();
    const obsolete = [...this.pendingRemovals];
    this.pendingRemovals.clear();
    try {
      await this.storage.remove(obsolete);
      return true;
    } catch {
      return false;
    }
  }
}
