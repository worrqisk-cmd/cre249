import { Product } from './data';

export interface CardPresentation {
  photo?: string;
  desktop: string;
  mobile: string;
  fit: 'cover' | 'contain';
  ratio?: number;
}

/** Three existing showcase slots; unselected products never fill empty slots. */
export function showcaseProducts(products: Product[]): Product[] {
  const selected = products.filter((product) => product.featured);
  const preferred = ['assorti', 'kurnik', 'milka'].flatMap((slug) =>
    selected.filter((product) => product.slug === slug),
  );
  return [...preferred, ...selected.filter((product) => !preferred.includes(product))].slice(0, 3);
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
