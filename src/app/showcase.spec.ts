import { describe, expect, it } from 'vitest';
import { Product } from './data';
import { showcaseProducts } from './product-presentation';
const product = (slug: string, sortOrder = 1, featured = true): Product => ({
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
  sortOrder,
  featured,
  availability: 'unconfirmed',
});
describe('showcase selection', () => {
  it('selects by owner order regardless of input order or specific product names', () => {
    const products = [
      product('assorti', 100),
      product('kurnik', 90),
      product('milka', 80),
      product('third', 3),
      product('first', 1),
      product('second', 2),
    ];
    expect(showcaseProducts(products).map((p) => p.slug)).toEqual(['first', 'second', 'third']);
    expect(products.map((p) => p.slug)).toEqual([
      'assorti',
      'kurnik',
      'milka',
      'third',
      'first',
      'second',
    ]);
  });
  it('uses stable slug order for ties, including the third-place boundary', () => {
    const products = ['zeta', 'milka', 'alpha', 'assorti', 'kurnik'].map((slug) =>
      product(slug, 10),
    );
    expect(showcaseProducts(products).map((p) => p.slug)).toEqual(['alpha', 'assorti', 'kurnik']);
    expect(showcaseProducts([...products].reverse()).map((p) => p.slug)).toEqual([
      'alpha',
      'assorti',
      'kurnik',
    ]);
  });
  it('does not fill zero, one or two selections with unselected products', () => {
    expect(showcaseProducts([product('assorti', 1, false)])).toEqual([]);
    expect(
      showcaseProducts([product('assorti', 1, false), product('one')]).map((p) => p.slug),
    ).toEqual(['one']);
    expect(
      showcaseProducts([product('milka', 0, false), product('two', 2), product('one', 1)]).map(
        (p) => p.slug,
      ),
    ).toEqual(['one', 'two']);
  });
  it('respects negative and zero owner order while excluding unselected products', () => {
    expect(
      showcaseProducts([
        product('positive', 5),
        product('zero', 0),
        product('negative', -10),
        product('unselected', -20, false),
      ]).map((p) => p.slug),
    ).toEqual(['negative', 'zero', 'positive']);
  });
});
