import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8447/cre249/';
const uid = '7ff37aab-19f3-46c0-8842-a28381902bca';
const user = { id: uid, email: 'mind.style11@gmail.com', aud: 'authenticated', role: 'authenticated' };
const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'signature'].join('.');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let saves = 0;
try {
  await page.route('**/auth/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user,
    }) });
    if (url.pathname.endsWith('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    return route.continue();
  });
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (table === 'products' && route.request().method() !== 'GET') {
      saves++;
      const record = JSON.parse(route.request().postData());
      await new Promise(resolve => setTimeout(resolve, 180));
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]) });
    }
    const body = table === 'products' ? [] : table === 'categories'
      ? [{ id: 'cakes', label: 'Торты', sort_order: 1, is_public: true }]
      : { id: true, city: 'Москва', whatsapp_number: null, telegram_username: null, delivery_text: '' };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}#/admin/login`);
  await page.getByLabel('Логин').fill('milana');
  await page.getByLabel('Пароль').fill('test-only');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('**/#/admin');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await page.getByLabel('Название').fill('Тестовый торт');
  await page.getByLabel('Slug').fill('test-cake');
  await page.getByRole('button', { name: 'Сохранить изделие' }).dblclick();
  await page.getByText('Изделие сохранено.').waitFor();
  assert.equal(saves, 1, 'double save must issue one mutation');
  await page.getByLabel('Описание').fill('Несохранённый текст');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: /Посмотреть каталог/ }).click();
  assert.match(page.url(), /#\/admin$/, 'discard cancellation retains editor');
  console.log('Admin form browser checks passed: owner login, one save on double click, unsaved guard.');
} finally { await page.close(); await browser.close(); }
