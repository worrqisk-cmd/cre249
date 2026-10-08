import { describe, expect, it } from 'vitest';
import { Product } from './data';
import { showcaseProducts } from './product-presentation';
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
  availability: 'unconfirmed',
});
describe('showcase selection', () => {
  it('keeps the current three-photo composition when its products are selected', () => {
    const products = ['other', 'milka', 'assorti', 'kurnik'].map((slug) => product(slug));
    expect(showcaseProducts(products).map((p) => p.slug)).toEqual(['assorti', 'kurnik', 'milka']);
  });
  it('does not fill zero, one or two selections with unselected products', () => {
    expect(showcaseProducts([product('assorti', false)])).toEqual([]);
    expect(
      showcaseProducts([product('assorti', false), product('one')]).map((p) => p.slug),
    ).toEqual(['one']);
    expect(
      showcaseProducts([product('milka', false), product('two'), product('one')]).map(
        (p) => p.slug,
      ),
    ).toEqual(['two', 'one']);
  });
  it('limits overflow to three slots, retaining catalog order for other selected products', () => {
    const products = ['first', 'second', 'third', 'fourth'].map((slug) => product(slug));
    expect(showcaseProducts(products).map((p) => p.slug)).toEqual(['first', 'second', 'third']);
    products.unshift(product('kurnik'));
    expect(showcaseProducts(products).map((p) => p.slug)).toEqual(['kurnik', 'first', 'second']);
    expect(products).toHaveLength(5);
  });
});
