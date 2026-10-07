import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8447/';
const uid = '7ff37aab-19f3-46c0-8842-a28381902bca';
const user = { id: uid, email: 'mind.style11@gmail.com', aud: 'authenticated', role: 'authenticated' };
const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'signature'].join('.');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(6000);
let saves = 0;
let failProduct = false;
let failSettings = false;
let failLogin = true;
let loginAttempts = 0;
let settingsAttempts = 0;
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
let settingsSave;
let savedProduct;
try {
  await page.route('**/auth/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) {
      loginAttempts++;
      if (failLogin) return route.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({message: 'Invalid login credentials'})});
    }
    if (url.pathname.endsWith('/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user,
    }) });
    if (url.pathname.endsWith('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    return route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
  });
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (table === 'products' && route.request().method() !== 'GET') {
      saves++;
      if (failProduct) return route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Test failure'})});
      const record = JSON.parse(route.request().postData());
      savedProduct = record;
      await new Promise(resolve => setTimeout(resolve, 180));
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...record, id: record.id || "existing-0", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    }
    if (table === 'site_settings' && route.request().method() !== 'GET') {
      settingsAttempts++;
      if (failSettings) return route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Test failure'})});
      settingsSave = JSON.parse(route.request().postData());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settingsSave) });
    }
    const existing = [10, 55, 40].map((sort_order, i) => ({ id: `existing-${i}`, slug: `existing-${i}`, title: `Существующее изделие ${i}`, description: '', category_id: 'cakes', fillings: [], price: null, price_unit: null, photos: i === 0 ? [{static: 'photos/01_hero_medovik.jpg', desktop: '50% 50%', mobile: '50% 50%'}] : [], primary_photo: 0, sort_order, featured: false, published: true, availability: 'unconfirmed', updated_at: '2026-10-08T00:00:00Z' }));
    const body = table === 'products' ? existing : table === 'categories'
      ? [{ id: 'cakes', label: 'Торты', sort_order: 1, is_public: true }]
      : { id: true, city: 'Москва', whatsapp_number: '+7 (964) 203-48-35', telegram_username: null, delivery_text: 'По договорённости' };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}#/admin/login`);
  await page.getByRole('button', {name: 'Войти'}).click();
  await page.getByText('Введите пароль.', {exact: true}).waitFor();
  assert.equal(loginAttempts, 0);
  await page.getByLabel('Логин').fill('milana');
  await page.getByLabel('Пароль').fill('test-only');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('Пароль').inputValue(), 'test-only');
  failLogin = false;
  await page.getByRole('button', {name: 'Войти'}).click();
  await page.waitForURL('**/admin/');
  assert.equal(loginAttempts, 2);
  await page.getByRole('button', { name: 'Настройки сайта' }).click();
  const phone = page.getByLabel('WhatsApp, номер телефона');
  assert.equal(await phone.inputValue(), '+7 (964) 203-48-35');
  await phone.fill('abc');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.getByText('Укажите телефон: от 7 до 15 цифр.').waitFor();
  assert.equal(settingsAttempts, 0);
  await phone.fill('+7 (999) 111-22-33');
  failSettings = true;
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await phone.inputValue(), '+7 (999) 111-22-33');
  failSettings = false;
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.getByText('Настройки сохранены.').waitFor();
  assert.equal(settingsSave.whatsapp_number, '+7 (999) 111-22-33');
  assert.equal(settingsSave.delivery_text, 'По договорённости');
  await page.getByRole('button', { name: 'Изделия' }).click();
  await page.getByRole('button', { name: 'Добавить' }).click();
  const order = page.getByLabel('Порядок показа');
  assert.equal(await order.inputValue(), '65', 'new product starts 10 after maximum current order');
  assert.equal(await page.getByText('Меньшее число — раньше в каталоге. Изделия с фото показываются первыми').count(), 1);
  await page.getByRole('button', { name: 'Сохранить изделие' }).click();
  await page.getByText('Укажите slug.', {exact: true}).waitFor();
  assert.equal(saves, 0);
  await order.fill('1.5');
  await order.blur();
  await page.getByText('Укажите целое число.').waitFor();
  await order.fill('7');
  await page.getByLabel('Название').fill('Тестовый торт');
  await page.getByLabel('Slug').fill('test-cake');
  await page.getByLabel('Цена, ₽').fill('-1');
  await page.getByRole('button', { name: 'Сохранить изделие' }).click();
  await page.getByText(/Укажите неотрицательную цену/).waitFor();
  assert.equal(saves, 0);
  await page.getByLabel('Цена, ₽').fill('123.45');
  await page.getByLabel('Начинки (по одной на строке)').fill('Ваниль\n\nШоколад\nВаниль');
  failProduct = true;
  await page.getByRole('button', { name: 'Сохранить изделие' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('Название').inputValue(), 'Тестовый торт');
  assert.equal(await page.getByLabel('Начинки (по одной на строке)').inputValue(), 'Ваниль\n\nШоколад\nВаниль');
  failProduct = false;
  await page.getByRole('button', { name: 'Сохранить изделие' }).dblclick();
  await page.getByText('Изделие сохранено.').waitFor();
  assert.equal(saves, 2, 'double save must issue one mutation');
  assert.equal(savedProduct.sort_order, 7, 'manual order is retained');
  assert.equal(savedProduct.price, 123.45);
  assert.deepEqual(savedProduct.fillings, ['Ваниль', 'Шоколад']);
  assert.equal(savedProduct.published, false);
  await page.getByRole('button', {name: /Существующее изделие 0/}).click();
  assert.equal(await page.getByLabel('Slug').inputValue(), 'existing-0');
  assert.equal(await page.getByLabel('Slug').getAttribute('readonly'), '');
  await page.getByLabel('Фокус на компьютере').fill('101% 50%');
  await page.getByRole('button', {name: 'Сохранить изделие'}).click();
  await page.getByText(/Укажите две позиции/).waitFor();
  assert.equal(saves, 2);
  await page.getByLabel('Фокус на компьютере').fill('25% 75%');
  await page.getByLabel('Опубликовано').uncheck();
  await page.getByLabel('Описание').fill('Редактирование');
  await page.getByRole('button', {name: 'Сохранить изделие'}).click();
  await page.getByText('Изделие сохранено.', {exact: true}).waitFor();
  assert.equal(savedProduct.slug, 'existing-0');
  assert.equal(savedProduct.published, false);
  assert.equal(savedProduct.photos[0].desktop, '25% 75%');
  assert.equal(savedProduct.photos[0].mobile, '50% 50%');
  await page.getByRole('button', {name: 'Добавить', exact: true}).click();
  assert.equal(await page.getByLabel('Название').inputValue(), '');
  assert.equal(await page.getByLabel('Цена, ₽').inputValue(), '');
  assert.notEqual(await page.getByLabel('Slug').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('app-field-errors small').count(), 0);
  await page.getByLabel('Описание').fill('Несохранённый текст');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: /Посмотреть каталог/ }).click();
  assert.match(page.url(), /\/admin\/$/, 'discard cancellation retains editor');
  assert.deepEqual(pageErrors, []);
  console.log('Signal Forms browser checks passed: invalid input, login error/retry, settings error/retry, product error/retry, duplicate submit, edit, new reset, payload and unsaved guard.');
} catch(error) { console.log(await page.locator('form').innerText()); console.log(pageErrors); throw error; } finally { await page.close(); await browser.close(); }
