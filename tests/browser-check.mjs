import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:8447/cre249/';
const captureScreenshots = process.env.CAPTURE_SCREENSHOTS === '1';
if (captureScreenshots) await mkdir('artifacts/angular', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  let expectedProductCount;
  for (const width of [360, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#featured .product-card').first().waitFor();
    for (const id of ['featured', 'about', 'order']) await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    for (const selector of ['#featured .product-card', '#about .about-copy', '#order .steps li']) {
      assert.equal(await page.locator(selector).first().isVisible(), true, `${selector} hidden at ${width}px`);
      assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).opacity), '1');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow at ${width}px`);
    await page.evaluate(() => scrollTo(0, 0));
    if (captureScreenshots) await page.screenshot({ path: `artifacts/angular/home-${width}.png`, fullPage: true });
    await page.goto(`${base}#/catalog`);
    await page.locator('.catalog-page .product-card').first().waitFor();
    const productCount = await page.locator('.catalog-page .product-card').count();
    if (expectedProductCount === undefined) {
      assert.ok(productCount >= 14, 'seeded products are visible');
      expectedProductCount = productCount;
    } else assert.equal(productCount, expectedProductCount);
    if (captureScreenshots) await page.screenshot({ path: `artifacts/angular/catalog-${width}.png`, fullPage: true });
    await page.goto(`${base}#/item/milka`);
    await page.getByRole('dialog').waitFor();
    await page.waitForFunction(() => { const img = document.querySelector('.dialog-photo img'); return img?.complete && img.naturalWidth > 0; });
    assert.equal(await page.locator('.dialog-photo img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    if (captureScreenshots) await page.screenshot({ path: `artifacts/angular/item-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, [], `browser errors at ${width}px`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await page.getByRole('link', { name: 'Написать в WhatsApp' }).waitFor();
  assert.match(await page.locator('#contacts').innerText(), /\+7 \(964\) 203-48-35/);
  const generalLinks = await page.locator('a[href*="wa.me/"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert.ok(generalLinks.length >= 3);
  for (const href of generalLinks) {
    const url = new URL(href);
    assert.equal(url.pathname, '/79642034835');
    assert.match(url.searchParams.get('text'), /Хочу обсудить заказ выпечки/);
  }
  assert.equal(await page.getByRole('link', { name: 'Написать в Telegram' }).count(), 0);
  await page.getByRole('link', { name: 'Выбрать выпечку' }).click();
  await page.waitForURL('**/#/catalog');
  await page.getByRole('button', { name: 'Сладкие пироги', exact: true }).click();
  await page.waitForURL('**/#/catalog/sweet');
  assert.equal(await page.locator('.product-card').count(), 3);
  await page.locator('[data-product-slug="assorti"]').click();
  await page.waitForURL('**/#/item/assorti');
  await page.getByRole('button', { name: 'Клубника' }).click();
  await page.getByRole('button', { name: 'Обсудить заказ' }).click();
  const message = await page.locator('textarea').inputValue();
  assert.match(message, /Пирог «Ассорти» \(начинка: клубника\)/);
  const contact = await page.getByRole('link', { name: 'Открыть WhatsApp' }).all();
  assert.equal(contact.length, 1);
  const href = await contact[0].getAttribute('href');
  assert.equal(new URL(href).pathname, '/79642034835');
  assert.equal(new URL(href).searchParams.get('text'), message);
  await page.keyboard.press('Escape');
  await page.waitForURL('**/#/catalog/sweet');
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-product-slug')), 'assorti');
  await page.goto(`${base}#/item/milka`);
  await page.reload();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Закрыть подробности');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Обсудить заказ');
  await page.getByRole('button', { name: 'Закрыть подробности' }).click();
  await page.waitForURL('**/#/catalog');
  await page.goto(`${base}#/item/pechenochny`);
  assert.match(await page.getByRole('dialog').innerText(), /недоступно/i);
  await page.goto(`${base}#/item/napoleon`);
  assert.match(await page.getByRole('dialog').innerText(), /недоступно/i);
  await page.goto(`${base}#/item/medovik`);
  await page.getByRole('button', { name: 'Фото 2' }).click();
  await page.waitForFunction(() => { const img = document.querySelector('.dialog-photo img'); return img?.complete && img.naturalWidth > 0; });
  assert.equal(await page.locator('.dialog-photo img').first().evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.goto(`${base}#/catalog`);
  await page.locator('[data-product-slug="milka"]').click();
  await page.getByRole('button', { name: 'Закрыть подробности' }).click();
  await page.waitForURL('**/#/catalog');
  assert.equal(await page.evaluate(() => document.querySelector('.dialog-photo img')?.style.visibility ?? ''), '');
  await page.getByRole('button', { name: 'Торты', exact: true }).click();
  await page.getByRole('button', { name: 'Десерты и зефир', exact: true }).click();
  await page.getByRole('button', { name: 'Все', exact: true }).click();
  await page.waitForFunction(count => location.hash === '#/catalog' && document.querySelectorAll('.catalog-page .product-card').length === count, expectedProductCount);
  assert.equal(await page.locator('.product-card').count(), expectedProductCount);
  await page.close();
  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await reduced.goto(base);
  await reduced.locator('#order').scrollIntoViewIfNeeded();
  assert.equal(await reduced.locator('#order .steps li').first().isVisible(), true);
  await reduced.close();
  const noObserver = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const noObserverErrors = [];
  noObserver.on('pageerror', error => noObserverErrors.push(error.message));
  await noObserver.addInitScript(() => Object.defineProperty(window, 'IntersectionObserver', { value: undefined }));
  await noObserver.goto(base);
  await noObserver.locator('#order').scrollIntoViewIfNeeded();
  assert.equal(await noObserver.locator('#order .steps li').first().isVisible(), true);
  assert.deepEqual(noObserverErrors, []);
  await noObserver.close();
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const route of ['', '#/catalog']) {
    await desktop.goto(base + route);
    if (route) await desktop.locator('.catalog-page').waitFor();
    const menu = await desktop.locator('#primary-nav > *').evaluateAll(items => items.map(item => {
      const range = document.createRange();
      range.selectNodeContents(item);
      return { top: range.getBoundingClientRect().top, height: item.getBoundingClientRect().height };
    }));
    assert.equal(new Set(menu.map(item => item.top)).size, 1, `menu text alignment on ${route || 'home'}`);
    assert.ok(menu.every(item => item.height >= 44));
    assert.equal(await desktop.locator('#primary-nav a').first().getAttribute('aria-current'), route ? 'page' : null);
    const sectionLink = desktop.locator('#primary-nav button').first();
    await desktop.mouse.move(0, 200);
    const normalColor = await sectionLink.evaluate(el => getComputedStyle(el).color);
    await sectionLink.hover();
    assert.notEqual(await sectionLink.evaluate(el => getComputedStyle(el).color), normalColor);
    await sectionLink.focus();
    assert.equal(await sectionLink.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  }
  for (const slug of ['orehovy', 'myasnoy', 'molochnaya-devochka']) {
    await desktop.goto(`${base}#/catalog`);
    await desktop.locator(`[data-product-slug="${slug}"]`).scrollIntoViewIfNeeded();
    await desktop.evaluate(() => {
      window.flightFrames = [];
      const until = performance.now() + 750;
      function sample() {
        const target = document.querySelector('.dialog-photo img');
        const copy = [...document.body.children].find(el => el.tagName === 'IMG' && el.style.zIndex === '100');
        if (target) {
          const targetRect = target.getBoundingClientRect();
          const copyRect = copy?.getBoundingClientRect();
          window.flightFrames.push({
            covered: getComputedStyle(target).visibility === 'visible' || !!copy,
            sameCrop: !copy || getComputedStyle(copy).objectPosition === getComputedStyle(target).objectPosition,
            readyAtHandoff: !!copy || (target.complete && target.naturalWidth > 0),
            distance: copyRect ? Math.hypot(targetRect.x - copyRect.x, targetRect.y - copyRect.y, targetRect.width - copyRect.width, targetRect.height - copyRect.height) : null,
          });
        }
        if (performance.now() < until) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await desktop.locator(`[data-product-slug="${slug}"]`).click();
    await desktop.waitForTimeout(770);
    const frames = await desktop.evaluate(() => window.flightFrames);
    assert.ok(frames.length > 15, `${slug}: animation frames captured`);
    assert.ok(frames.every(frame => frame.covered && frame.sameCrop && frame.readyAtHandoff), `${slug}: continuous image handoff`);
    assert.ok(frames.filter(frame => frame.distance !== null).at(-1).distance < 1, `${slug}: copy reaches final image bounds`);
    await desktop.keyboard.press('Escape');
    await desktop.waitForURL('**/#/catalog');
  }
  await desktop.close();
  console.log('Browser checks passed: routes, filter, dialog, focus, WhatsApp, viewports, images, reduced motion.');
} finally { await browser.close(); }
