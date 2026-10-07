import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { usePublishedSnapshot } from './catalog-fixture.mjs';
const browser = await chromium.launch({headless: true});
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await usePublishedSnapshot(page);
    await page.route('**/auth/v1/**', route => route.fulfill({status: 401, contentType: 'application/json', body: '{}'}));
    await page.addInitScript(() => {
      window.testCopies = [];
      Object.defineProperty(navigator, 'clipboard', {value: {writeText: async text => {
        if (window.testCopyFails) throw new Error('test');
        window.testCopies.push(text);
      }}});
    });
    await page.goto((process.env.BASE_URL || 'http://127.0.0.1:8447/') + 'item/assorti/');
    await page.getByRole('button', {name: 'Обсудить заказ'}).click();
    const message = page.getByLabel('Сообщение Милане');
    assert.match(await message.inputValue(), /Здравствуйте, Милана! Хочу обсудить заказ:/);
    await message.fill('   ');
    await page.getByRole('button', {name: 'Скопировать', exact: true}).click();
    await page.getByText('Введите сообщение.', {exact: true}).waitFor();
    assert.equal(await page.getByRole('link', {name: 'Открыть WhatsApp'}).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.testCopies), []);
    const custom = 'Здравствуйте, Милана! Хочу обсудить заказ: Пирог «Ассорти». На 12 октября.';
    await message.fill(custom);
    await page.getByRole('button', {name: 'Клубника', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('textarea').value.includes('начинка: клубника'));
    assert.match(await message.inputValue(), /начинка: клубника/);
    assert.match(await message.inputValue(), /На 12 октября/);
    const text = await message.inputValue();
    const href = await page.getByRole('link', {name: 'Открыть WhatsApp'}).getAttribute('href');
    assert.equal(new URL(href).searchParams.get('text'), text);
    await page.evaluate(() => window.testCopyFails = true);
    await page.getByRole('button', {name: 'Скопировать', exact: true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await message.inputValue(), text);
    await page.evaluate(() => window.testCopyFails = false);
    await page.getByRole('button', {name: 'Скопировать', exact: true}).click();
    await page.getByRole('button', {name: 'Скопировано ✓'}).waitFor();
    assert.deepEqual(await page.evaluate(() => window.testCopies), [text]);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Order Signal Form checks passed at 390/1440px: generated/custom message, filling, invalid input, WhatsApp encoding, clipboard error/retry.');
} finally { await browser.close(); }
