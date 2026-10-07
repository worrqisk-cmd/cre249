import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8447/';
const browser = await chromium.launch({ headless: true });

async function scenario(name, productsStatus, products) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    const body = table === 'products' ? products : table === 'categories' ? [
      { id: 'cakes', label: 'Торты', sort_order: 1, is_public: true },
    ] : { id: true, city: 'Москва', whatsapp_number: null, telegram_username: null, delivery_text: '' };
    await route.fulfill({ status: table === 'products' ? productsStatus : 200,
      contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}#/catalog`);
  if (name === 'empty') {
    await page.getByRole('heading', { name: 'В этой категории пока пусто' }).waitFor();
    assert.equal(await page.locator('.product-card').count(), 0);
  } else if (name === 'error') {
    await page.getByRole('heading', { name: 'Каталог сейчас не загрузился' }).waitFor();
    assert.equal(await page.locator('.product-card').count(), 0);
    const href = await page.getByRole('link', { name: 'Написать в WhatsApp' }).getAttribute('href');
    assert.equal(new URL(href).pathname, '/79642034835');
    assert.match(new URL(href).searchParams.get('text'), /Хочу обсудить заказ выпечки/);
  } else {
    await page.locator('[data-product-slug="milka"]').waitFor();
    const request = page.waitForRequest(req => req.url().includes('/rest/v1/products'));
    await page.reload();
    const url = new URL((await request).url());
    assert.equal(url.searchParams.get('published'), 'eq.true');
    await page.goto(`${base}#/item/pechenochny`);
    await page.locator('.item-page').waitFor();
    assert.match(await page.locator('.item-page').innerText(), /недоступно/i);
  }
  assert.deepEqual(errors, [], `${name}: browser errors`);
  await page.close();
}

try {
  await scenario('empty', 200, []);
  await scenario('error', 503, { message: 'unavailable' });
  await scenario('hidden', 200, [{
    id: '00000000-0000-4000-8000-000000000001', slug: 'milka', title: 'Торт «Милка»',
    description: '', category_id: 'cakes', fillings: [], price: null, price_unit: null,
    photos: [], primary_photo: 0, sort_order: 1, featured: true, published: true,
    availability: 'unconfirmed',
  }]);
  const admin = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let passwordRequests = 0;
  await admin.route('**/auth/v1/user', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"no session"}' }));
  await admin.route('**/auth/v1/token**', route => { passwordRequests++; return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"invalid"}' }); });
  await admin.goto(`${base}#/admin`);
  await admin.waitForURL('**/admin/login/');
  await admin.getByLabel('Логин').fill('other');
  await admin.getByLabel('Пароль').fill('example-password');
  await admin.getByRole('button', { name: 'Войти' }).click();
  await admin.getByRole('alert').waitFor();
  assert.equal(passwordRequests, 0, 'unknown login must not request Supabase password endpoint');
  await admin.close();
  console.log('Catalog API browser checks passed: empty, error, published query, hidden direct link.');
} finally { await browser.close(); }
