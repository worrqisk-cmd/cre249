import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:8447/';
const browser = await chromium.launch({ headless: true });
const product = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'new-runtime-only',
  title: 'Новый опубликованный товар',
  description: 'Описание',
  category_id: 'cakes',
  fillings: [],
  price: 100,
  price_unit: 'шт',
  photos: [],
  primary_photo: 0,
  sort_order: 1,
  featured: false,
  published: true,
  availability: 'available',
};
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let visible = true;
  await page.route('**/rest/v1/**', (route) => {
    const table = new URL(route.request().url()).pathname.split('/').at(-1);
    const body =
      table === 'products'
        ? visible
          ? [product]
          : []
        : table === 'categories'
          ? [{ id: 'cakes', label: 'Торты', sort_order: 1, is_public: true }]
          : {
              id: true,
              city: 'Москва',
              whatsapp_number: '79642034835',
              telegram_username: null,
              delivery_text: '',
            };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  assert.equal((await page.goto(`${base}item/${product.slug}/`)).status(), 404);
  await page.getByRole('heading', { name: product.title, exact: true }).waitFor();
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  assert.equal((await page.reload()).status(), 404);
  await page.getByRole('heading', { name: product.title, exact: true }).waitFor();
  visible = false;
  const paths = JSON.parse(await readFile('.static-paths.json', 'utf8'));
  const oldPath = paths.find((path) => path.startsWith('/item/'));
  if (oldPath) {
    const raw = await fetch(base + oldPath.slice(1));
    assert.equal(raw.status, 200);
    assert.match(await raw.text(), /<h1/); // Ранее опубликованный HTML остаётся до нового deploy.
    assert.equal((await page.goto(base + oldPath.slice(1))).status(), 200);
    await page
      .locator('.item-page')
      .filter({ hasText: /недоступно/i })
      .waitFor();
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  }
  assert.deepEqual(errors, []);
  console.log(
    'New slug: HTTP 404 + runtime product + reload; stale hidden page: HTTP 200 + unavailable after bootstrap; no JS errors',
  );
} finally {
  await browser.close();
}
