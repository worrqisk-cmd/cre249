import { Product } from './data';

export interface CardPresentation {
  photo?: string;
  desktop: string;
  mobile: string;
  fit: 'cover' | 'contain';
  ratio?: number;
}

/** Up to six showcase slots; unselected products never fill empty slots. */
export function showcaseProducts(products: Product[]): Product[] {
  return products
    .filter((product) => product.featured && product.photos.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, 6);
}

export function homePresentation(product: Product): CardPresentation | undefined {
  if (product.slug === 'assorti') {
    const photo = product.photos.find((source) => source === 'photos/archive_063_assorti.jpg');
    if (photo) return { photo, desktop: '50% 55%', mobile: '50% 65%', fit: 'cover' };
  }
  if (product.slug === 'kurnik') return { desktop: '50% 100%', mobile: '50% 90%', fit: 'cover' };
  if (product.slug === 'milka') return { desktop: '50% 50%', mobile: '50% 55%', fit: 'contain' };
  return undefined;
}

export function catalogPresentation(
  product: Pick<Product, 'slug' | 'photos'>,
): CardPresentation | undefined {
  if (product.slug === 'myasnoy') return { desktop: '50% 80%', mobile: '50% 80%', fit: 'cover' };
  if (product.slug === 'kurnik') return { desktop: '50% 100%', mobile: '50% 100%', fit: 'cover' };
  if (product.slug === 'slivochno-karamelny') {
    const photo = product.photos.find(
      (source) => source === 'photos/archive_085_slivochno-karamelny.jpg',
    );
    return { photo, desktop: '50% 50%', mobile: '50% 50%', fit: 'contain', ratio: 1 };
  }
  if (product.slug === 'kuraga-oreh') {
    return { desktop: '50% 50%', mobile: '50% 50%', fit: 'contain', ratio: 1078 / 632 };
  }
  return undefined;
}
