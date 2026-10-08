import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { usePublishedSnapshot } from './catalog-fixture.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:8458/';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        ['error', 'warning'].includes(message.type()) &&
        /NG\d{4,}|\bERROR\b|hydration.*(?:mismatch|failed)/i.test(message.text())
      ) {
        errors.push(message.text());
      }
    });
    await usePublishedSnapshot(page);
    await page.route('**/auth/v1/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"message":"no test session"}',
      }),
    );
    for (const path of [
      '',
      'catalog/',
      'catalog/sweet/',
      'item/assorti/',
      'admin/login/',
      'admin/',
    ]) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, path);
      if (path.startsWith('admin')) {
        await page.getByLabel('Пароль').waitFor();
        assert.match(page.url(), /\/admin\/login\/$/);
      } else {
        await page
          .locator(path.startsWith('item') ? '.item-page' : '.product-card')
          .first()
          .waitFor();
      }
      assert.deepEqual(errors, [], `${width} ${path || 'home'} bootstrap/Angular diagnostics`);
    }
    await page.close();
  }
  console.log(
    'PASS: mobile/desktop prerender bootstrap, anonymous admin redirect, no pageerror or Angular/hydration error diagnostics. Hydration provider is not enabled in appConfig.',
  );
} finally {
  await browser.close();
}
