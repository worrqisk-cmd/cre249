import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { shouldShowSiteCredit } from './app';
import { buildMessage, formatPrice, Product, waLink, webpSet } from './data';

const assorti: Product = {
  id: 'test-id',
  slug: 'assorti',
  title: 'Пирог «Ассорти»',
  description: '',
  category: 'sweet',
  fillings: ['Клубника'],
  price: null,
  priceUnit: null,
  photos: [],
  photoFocus: [],
  featured: true,
  sortOrder: 1,
  availability: 'unconfirmed',
};

describe('catalog behavior', () => {
  it('shows the site credit only on public pages, not admin or product dialogs', () => {
    expect(shouldShowSiteCredit('/')).toBe(true);
    expect(shouldShowSiteCredit('/catalog/sweet')).toBe(true);
    expect(shouldShowSiteCredit('/admin/login')).toBe(false);
    expect(shouldShowSiteCredit('/admin')).toBe(false);
    expect(shouldShowSiteCredit('/item/kurnik')).toBe(false);
  });
  it('keeps public and admin routes lazy', () => {
    expect(routes.map((route) => route.path)).toContain('admin/login');
    expect(routes.find((route) => route.path === 'admin')?.canActivate?.length).toBe(1);
    expect(
      routes
        .filter((route) => route.path !== '**')
        .every((route) => typeof route.loadComponent === 'function'),
    ).toBe(true);
  });
  it('builds a product-specific message without exposing a password or token', () => {
    const message = buildMessage(assorti, 'Клубника');
    expect(message).toContain('Пирог «Ассорти» (начинка: клубника)');
    expect(new URL(waLink('79642034835', message)).searchParams.get('text')).toBe(message);
  });
  it('shows a price only when its unit is confirmed', () => {
    expect(formatPrice(assorti)).toBe('Стоимость уточняйте');
    expect(formatPrice({ ...assorti, price: 1500 })).toBe('Стоимость уточняйте');
    expect(formatPrice({ ...assorti, price: 1500, priceUnit: 'кг' })).toContain('₽/кг');
  });
  it('uses local responsive assets only for bundled photographs', () => {
    expect(webpSet('photos/01_hero_medovik.jpg')).toContain('-480.webp');
    expect(webpSet('https://example.com/signed.jpg?token=abc')).toBeNull();
  });
});
