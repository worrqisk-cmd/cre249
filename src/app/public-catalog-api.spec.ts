import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Product, ProductPhoto, ProductRow } from './data';
import { PublicCatalogApi } from './public-catalog-api';
import { CatalogPhotos } from './catalog-photos';
import { SupabaseService } from './supabase';
const product = (slug: string, featured = true): Product => ({
  id: slug,
  slug,
  title: slug,
  description: '',
  category: 'cakes',
  fillings: [],
  price: null,
  priceUnit: null,
  photos: [],
  photoFocus: [],
  featured,
  sortOrder: 1,
  availability: 'unconfirmed',
});
const photo = (path: string, focus = '50% 50%'): ProductPhoto => ({
  path,
  desktop: focus,
  mobile: focus,
});
const row = (slug: string, photos: ProductPhoto[], primary_photo = 0): ProductRow => ({
  ...product(slug),
  category_id: 'cakes',
  price_unit: null,
  photos,
  primary_photo,
  sort_order: 1,
  published: true,
  updated_at: '2026-10-08T00:00:00Z',
});

function provideApi(
  rows: ProductRow[],
  url: (photo: ProductPhoto) => Promise<string>,
  error: object | null = null,
) {
  const result = (data: unknown, failure: object | null = null) =>
    Object.assign(Promise.resolve({ data, error: failure }), {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    });
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SupabaseService,
        useValue: {
          client: {
            from: (table: string) =>
              table === 'products'
                ? result(rows, error)
                : table === 'categories'
                  ? result([{ id: 'cakes' }])
                  : result({ id: true }),
          },
        },
      },
      { provide: CatalogPhotos, useValue: { url } },
    ],
  });
  return TestBed.inject(PublicCatalogApi);
}

describe('partial photo failures', () => {
  it('isolates a Storage 429, preserves slots/focus/cover, and signs at most four at once without retries', async () => {
    let active = 0,
      maximum = 0;
    const urls = vi.fn(async (item: ProductPhoto) => {
      maximum = Math.max(maximum, ++active);
      await Promise.resolve();
      active--;
      if (item.path === 'bad') throw { status: 429, message: 'SlowDown' };
      return item.static || `https://photos.invalid/${item.path}`;
    });
    const api = provideApi(
      [
        row('mixed', [photo('good', '10% 20%'), photo('bad', '80% 90%')], 1),
        row(
          'other',
          ['1', '2', '3', '4', '5', '6'].map((path) => photo(path)),
        ),
        row('empty', []),
      ],
      urls,
    );
    const data = await api.load();
    expect(data.products).toHaveLength(3);
    expect(data.products[0].photos).toEqual(['', 'https://photos.invalid/good']);
    expect(data.products[0].photoFocus.map((f) => f.desktop)).toEqual(['80% 90%', '10% 20%']);
    expect(data.products[0].focus?.desktop).toBe('80% 90%');
    expect(data.products[1].photos).toHaveLength(6);
    expect(data.products[2].photos).toEqual([]);
    expect(data.categories).toHaveLength(1);
    expect(data.settings).toEqual({ id: true });
    expect(maximum).toBe(4);
    expect(urls).toHaveBeenCalledTimes(8);
    expect(urls.mock.calls.filter(([item]) => item.path === 'bad')).toHaveLength(1);
  });
  it('recovers a photo on a later explicit load, without changing its slot', async () => {
    const urls = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValue('recovered');
    const api = provideApi([row('one', [photo('one')])], urls);
    expect((await api.load()).products[0].photos).toEqual(['']);
    expect((await api.load()).products[0].photos).toEqual(['recovered']);
    expect(urls).toHaveBeenCalledTimes(2);
  });
  it('still rejects a failed data query instead of disguising it as an empty catalog', async () => {
    const urls = vi.fn();
    const error = { message: 'REST unavailable' };
    const api = provideApi([], urls, error);
    await expect(api.load()).rejects.toEqual(error);
    expect(urls).not.toHaveBeenCalled();
  });
});
