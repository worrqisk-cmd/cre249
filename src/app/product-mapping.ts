import { Product, ProductPhoto, ProductRow } from './data';

export function orderedProductPhotos(
  row: Pick<ProductRow, 'photos' | 'primary_photo'>,
): ProductPhoto[] {
  const ordered = [...row.photos];
  if (row.primary_photo > 0 && row.primary_photo < ordered.length) {
    ordered.unshift(ordered.splice(row.primary_photo, 1)[0]);
  }
  return ordered;
}

export function publicProduct(row: ProductRow, photos: ProductPhoto[], urls: string[]): Product {
  const main = photos[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category_id,
    fillings: row.fillings || [],
    price: row.price,
    priceUnit: row.price_unit,
    // Preserve slots so a failed URL cannot shift the cover or another photo's focus.
    photos: urls,
    focus: main
      ? { desktop: main.desktop || '50% 50%', mobile: main.mobile || '50% 50%' }
      : undefined,
    photoFocus: photos.map((photo) => ({
      desktop: photo.desktop || '50% 50%',
      mobile: photo.mobile || '50% 50%',
    })),
    sortOrder: row.sort_order,
    featured: row.featured,
    availability: row.availability,
  };
}
