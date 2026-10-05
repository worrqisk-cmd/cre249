import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { ASSORTI_FILLINGS, buildMessage, PRODUCTS, waLink } from './data';

describe('public routes and catalog data', () => {
  it('keeps home, catalog, category and item as lazy routes', () => {
    expect(routes.slice(0, 4).map(route => route.path)).toEqual(['', 'catalog', 'catalog/:category', 'item/:slug']);
    expect(routes.slice(0, 4).every(route => typeof route.loadComponent === 'function')).toBe(true);
  });
  it('builds an encoded WhatsApp message with the selected filling', () => {
    const assorti = PRODUCTS.find(product => product.slug === 'assorti')!;
    expect(ASSORTI_FILLINGS).toContain('Клубника');
    const message = buildMessage(assorti, 'Клубника');
    expect(message).toContain('Пирог «Ассорти» (начинка: клубника)');
    expect(new URL(waLink(message)).searchParams.get('text')).toBe(message);
  });
  it('keeps slugs unique and hidden products out of the public set', () => {
    expect(new Set(PRODUCTS.map(product => product.slug)).size).toBe(PRODUCTS.length);
    expect(PRODUCTS.filter(product => !product.hidden).length).toBe(14);
  });
});
