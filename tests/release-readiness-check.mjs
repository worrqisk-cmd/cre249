import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8447/';
const config = JSON.parse(await readFile('public/site-config.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const image = await readFile('public/photos/01_hero_medovik.jpg');
const staticPhoto = (file, desktop = '50% 50%') => ({
  static: `photos/${file}.jpg`,
  desktop,
  mobile: desktop,
});
const pathPhoto = (path, desktop = '50% 50%') => ({ path, desktop, mobile: desktop });
const product = (slug, extra = {}) => ({
  id: slug,
  slug,
  title: `Изделие ${slug}`,
  description: '',
  category_id: 'cakes',
  fillings: [],
  price: null,
  price_unit: null,
  photos: [staticPhoto('01_hero_medovik')],
  primary_photo: 0,
  sort_order: 1,
  featured: true,
  published: true,
  availability: 'unconfirmed',
  updated_at: '2026-10-08T00:00:00Z',
  ...extra,
});
const settings = {
  id: true,
  city: 'Москва',
  whatsapp_number: '79642034835',
  telegram_username: null,
  delivery_text: '',
};
const categories = [{ id: 'cakes', label: 'Торты', sort_order: 1, is_public: true }];
const errors = [];
async function publicPage(width, rows, { badSign = [], badImage = [] } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  const signing = new Map();
  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ status: 401, json: { message: 'No mock session' } }),
  );
  await page.route('**/rest/v1/**', (route) => {
    assert.equal(route.request().method(), 'GET', 'public scenarios must never write');
    const table = new URL(route.request().url()).pathname.split('/').at(-1);
    const data =
      table === 'products'
        ? rows
            .filter((row) => row.published)
            .toSorted((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug))
        : table === 'categories'
          ? categories
          : settings;
    return route.fulfill({ status: 200, json: data });
  });
  await page.route('**/storage/v1/**', (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').at(-1);
    if (route.request().method() === 'POST') {
      assert.ok(url.pathname.includes('/object/sign/'), 'only mocked signing may use POST');
      signing.set(name, (signing.get(name) || 0) + 1);
      if (badSign.includes(name))
        return route.fulfill({
          status: 429,
          json: {
            statusCode: '429',
            error: 'SlowDown',
            message: 'Too many connections issued to the database',
          },
        });
      return route.fulfill({
        status: 200,
        json: { signedURL: `/object/sign/milana-catalog/${name}?token=mock` },
      });
    }
    assert.equal(route.request().method(), 'GET');
    return badImage.includes(name)
      ? route.fulfill({ status: 429, body: 'SlowDown' })
      : route.fulfill({ status: 200, contentType: 'image/jpeg', body: image });
  });
  async function goto(path) {
    const ready = page.waitForResponse((response) => response.url().includes('/rest/v1/products'));
    await page.goto(base + path);
    await ready;
    await page.waitForFunction(() => !document.querySelector('[role="status"]'));
  }
  return { page, signing, goto };
}
function slugs(page, selector) {
  return page
    .locator(selector)
    .evaluateAll((elements) => elements.map((el) => el.dataset.productSlug));
}
try {
  for (const width of [390, 1440]) {
    for (const [rows, expected] of [
      [[product('assorti', { featured: false }), product('kurnik', { featured: false })], []],
      [
        [
          product('assorti', { featured: false }),
          product('one'),
          product('hidden', { published: false }),
        ],
        ['one'],
      ],
      [
        [
          product('milka', { featured: false }),
          product('second', { sort_order: 2 }),
          product('first'),
        ],
        ['first', 'second'],
      ],
      [
        [
          product('other', { sort_order: 0 }),
          product('milka', { sort_order: 3 }),
          product('kurnik', { sort_order: 2 }),
          product('assorti', { sort_order: 1 }),
        ],
        ['other', 'assorti', 'kurnik'],
      ],
      [
        ['fourth', 'third', 'second', 'first'].map((slug, index) =>
          product(slug, { sort_order: 4 - index }),
        ),
        ['first', 'second', 'third'],
      ],
      [
        ['zeta', 'milka', 'alpha', 'assorti', 'kurnik'].map((slug) =>
          product(slug, { sort_order: 10 }),
        ),
        ['alpha', 'assorti', 'kurnik'],
      ],
    ]) {
      const { page, goto } = await publicPage(width, rows);
      await goto('');
      if (expected.length) await page.locator('#featured .product-card').first().waitFor();
      else await page.getByText('Всю выпечку смотрите в каталоге.', { exact: true }).waitFor();
      assert.deepEqual(await slugs(page, '#featured .product-card'), expected);
      assert.ok(await page.getByRole('link', { name: 'Выбрать выпечку' }).isVisible());
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.close();
    }
    const rows = [
      product('mixed', {
        photos: [
          pathPhoto('bad-sign.jpg', '10% 20%'),
          staticPhoto('archive_025_medovik', '80% 90%'),
        ],
      }),
      product('other'),
      product('bad-download', {
        photos: [
          pathPhoto('bad-image.jpg'),
          pathPhoto('bad-sign.jpg'),
          staticPhoto('01_hero_medovik'),
        ],
      }),
      product('bad-secondary', {
        photos: [staticPhoto('01_hero_medovik'), pathPhoto('bad-sign.jpg', '20% 30%')],
      }),
    ];
    rows.push(product('all-bad', { photos: [pathPhoto('bad-only.jpg')], featured: false }));
    const { page, goto, signing } = await publicPage(width, rows, {
      badSign: ['bad-sign.jpg', 'bad-only.jpg'],
      badImage: ['bad-image.jpg'],
    });
    await goto('catalog/');
    await page.locator('[data-product-slug="mixed"] .placeholder-copy').waitFor();
    assert.equal(await page.locator('.product-card').count(), 5);
    assert.match(
      await page.locator('[data-product-slug="mixed"]').innerText(),
      /Фото временно недоступно/,
    );
    await page.locator('[data-product-slug="bad-download"] .placeholder-copy').waitFor();
    assert.equal(
      await page.getByRole('heading', { name: 'Каталог сейчас не загрузился' }).count(),
      0,
    );
    const card = page.locator('[data-product-slug="mixed"]');
    await card.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await card.click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Фото 1 — недоступно', exact: true }).waitFor();
    assert.equal(
      await page.locator('.dialog-photo > .missing-photo').innerText(),
      'Фото временно недоступно',
    );
    assert.equal(await page.locator('.dialog-image-link').count(), 0);
    const missingBox = await page.locator('.dialog-photo > .missing-photo').boundingBox();
    await page.getByRole('button', { name: 'Фото 2', exact: true }).click();
    await page.waitForFunction(() => {
      const image = document.querySelector('.dialog-photo picture img');
      return image && getComputedStyle(image).objectPosition === '80% 90%';
    });
    assert.match(
      await page.locator('.dialog-photo picture img').getAttribute('src'),
      /archive_025_medovik/,
    );
    const photoBox = await page.locator('.dialog-image-link').boundingBox();
    assert.ok(
      Math.abs(photoBox.height - missingBox.height) < 1,
      'placeholder reserves the same gallery frame',
    );
    await page.getByRole('button', { name: 'Фото 1 — недоступно', exact: true }).click();
    await page.getByRole('button', { name: 'Обсудить заказ', exact: true }).click();
    await page.getByLabel('Сообщение Милане').fill('Заказ без фотографии');
    assert.match(
      await page.getByRole('link', { name: 'Открыть WhatsApp' }).getAttribute('href'),
      /79642034835/,
    );
    await page.keyboard.press('Escape');
    await page.waitForURL(base + 'catalog/');
    await page.waitForFunction(() => document.activeElement?.dataset.productSlug === 'mixed');
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 2);
    assert.equal(await page.locator('[inert]').count(), 0);
    const before = [...signing];
    await page.waitForTimeout(600);
    assert.deepEqual([...signing], before, 'Storage 429 must not start a retry loop');
    assert.equal(
      signing.get('bad-sign.jpg'),
      3,
      'one signing per slot, three products contain this mock path',
    );
    assert.equal(signing.get('bad-only.jpg'), 1);
    await goto('item/all-bad/');
    await page.locator('.item-page .dialog-photo > .missing-photo').waitFor();
    assert.equal(await page.locator('.dialog-image-link, .dialog-thumbnails').count(), 0);
    await goto('item/mixed/');
    await page.locator('.item-page .dialog-photo > .missing-photo').waitFor();
    await page.getByRole('button', { name: 'Фото 2', exact: true }).click();
    await page.locator('.dialog-photo picture img').waitFor();
    await goto('item/bad-download/');
    await page.locator('.item-page .dialog-photo > .missing-photo').waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'Фото 1 — недоступно', exact: true })
        .getAttribute('aria-pressed'),
      'true',
      'direct URL starts with the cover, not the next missing URL slot',
    );
    await page.getByRole('button', { name: 'Фото 3', exact: true }).click();
    await page.locator('.dialog-photo picture img').waitFor();
    await goto('item/bad-secondary/');
    await page.getByRole('button', { name: 'Фото 2 — недоступно', exact: true }).click();
    await page.locator('.item-page .dialog-photo > .missing-photo').waitFor();
    await page.getByRole('button', { name: 'Фото 1', exact: true }).click();
    await page.locator('.dialog-photo picture img').waitFor();
    await page.close();
    console.log(
      `PASS ${width}: featured 0/1/2/overflow, published filter, signing/download 429, placeholder gallery/focus, direct URL, order, no retry loop`,
    );
  }
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', (error) => errors.push(error.message));
    const user = {
      id: config.adminUserId,
      email: config.adminEmail,
      role: 'authenticated',
      aud: 'authenticated',
    };
    const jwt = [
      'eyJhbGciOiJIUzI1NiJ9',
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url'),
      'mock-signature',
    ].join('.');
    let current = product('cover', {
      photos: [
        staticPhoto('01_hero_medovik'),
        staticPhoto('05_kurnik', '25% 75%'),
        staticPhoto('08_tort_milka'),
      ],
      primary_photo: 1,
    });
    const saves = [];
    await page.route('**/auth/v1/**', (route) =>
      route.fulfill({
        status: 200,
        json: new URL(route.request().url()).pathname.endsWith('/token')
          ? {
              access_token: jwt,
              refresh_token: 'mock',
              token_type: 'bearer',
              expires_in: 3600,
              user,
            }
          : user,
      }),
    );
    await page.route('**/storage/v1/**', (route) => route.fulfill({ status: 200, json: [] }));
    await page.route('**/rest/v1/**', (route) => {
      const table = new URL(route.request().url()).pathname.split('/').at(-1);
      if (route.request().method() !== 'GET') {
        assert.equal(table, 'products');
        const payload = JSON.parse(route.request().postData());
        saves.push(payload);
        current = { ...current, ...payload, updated_at: new Date().toISOString() };
        return route.fulfill({ status: 200, json: current });
      }
      return route.fulfill({
        status: 200,
        json: table === 'products' ? [current] : table === 'categories' ? categories : settings,
      });
    });
    await page.goto(base + 'admin/login/');
    await page.getByLabel('Логин').fill(config.adminLogin);
    await page.getByLabel('Пароль').fill('mock');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.getByRole('button', { name: /Изделие cover/ }).click();
    for (const [expectedPath, expectedIndex] of [
      ['photos/05_kurnik.jpg', 0],
      ['photos/08_tort_milka.jpg', 0],
      [null, 0],
    ]) {
      await page.getByRole('button', { name: 'Убрать фото', exact: true }).first().click();
      await page.getByRole('button', { name: 'Сохранить изделие' }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('.admin-save button')?.disabled &&
          !document.querySelector('.admin-save span'),
      );
      const saved = saves.at(-1);
      assert.equal(saved.primary_photo, expectedIndex);
      assert.equal(saved.photos[expectedIndex]?.static || null, expectedPath);
    }
    assert.equal(saves.length, 3);
    await page.getByLabel('На главной', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Сохранить изделие' }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('.admin-save button')?.disabled &&
        !document.querySelector('.admin-save span'),
    );
    assert.equal(saves.at(-1).featured, false);
    await page.goto(base);
    await page.getByText('Всю выпечку смотрите в каталоге.', { exact: true }).waitFor();
    assert.equal(await page.locator('#featured .product-card').count(), 0);
    await page.goto(base + 'admin/');
    await page.getByRole('button', { name: /Изделие cover/ }).click();
    await page.getByLabel('На главной', { exact: true }).check();
    await page.getByRole('button', { name: 'Сохранить изделие' }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('.admin-save button')?.disabled &&
        !document.querySelector('.admin-save span'),
    );
    assert.equal(saves.at(-1).featured, true);
    await page.goto(base);
    await page.locator('#featured [data-product-slug="cover"]').waitFor();
    await page.close();
    console.log(
      `PASS ${width}: delete before cover, delete cover fallback, delete final photo, persisted payloads, admin featured save → home`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
