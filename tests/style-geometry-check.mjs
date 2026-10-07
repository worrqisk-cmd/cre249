import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {usePublishedSnapshot} from './catalog-fixture.mjs';

// Сравниваем DOM-геометрию и computed CSS; изображения экрана не создаются.
const baselinePath = process.env.STYLE_BASELINE || '/tmp/cre249-style-baseline.json';
const base = process.env.BASE_URL || 'http://127.0.0.1:8458/';
const browser = await chromium.launch({headless: true});
const results = {};
const selectors = ['.header-inner', '.brand', '.nav', '.contacts', '.footer', '.shop-front', '.shop-intro h1', '.shop-window', '.about-photo', '.about-photo img', '.steps', '.catalog-grid', '.product-card', '.product-image', '.product-image img', '.product-meta h3', '.category-list', '.dialog-panel', '.dialog-grid', '.dialog-photo', '.dialog-photo img', '.dialog-content', '.dialog-thumbnails', '.dialog-thumbnails button', '.composer', '.composer textarea', '.composer .actions', '.admin-login', '.admin-login input', '.admin-layout', '.admin-editor', '.admin-editor input', '.admin-settings', '.admin-settings input'];
const properties = ['display', 'position', 'padding', 'margin', 'gap', 'gridTemplateColumns', 'backgroundColor', 'color', 'borderRadius', 'objectFit', 'objectPosition', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'overflow', 'maxHeight', 'aspectRatio', 'transitionDuration'];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
    await usePublishedSnapshot(page);
    for (const path of ['', 'catalog/', 'item/assorti/', 'admin/login/']) {
      await page.goto(base + path);
      await page.locator(path.startsWith('admin') ? 'input[autocomplete="current-password"]' : path.startsWith('item') ? '.item-page' : '.product-card').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
      if (path.startsWith('item')) await page.getByRole('button', {name: 'Обсудить заказ'}).click();
      await page.waitForTimeout(100);
      results[`${width}:${path || 'home'}`] = await page.evaluate(({selectors, properties}) => Object.fromEntries(selectors.map(selector => [selector, [...document.querySelectorAll(selector)].slice(0, 4).map(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {rect: [rect.x, rect.y, rect.width, rect.height], css: Object.fromEntries(properties.map(property => [property, style[property]]))};
      })])), {selectors, properties});
    }
    await page.close();
  }
  if (process.env.RECORD_STYLES) {
    await writeFile(baselinePath, JSON.stringify(results, null, 2) + '\n');
    console.log(`Recorded style/geometry baseline: ${baselinePath}`);
  } else {
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
    let elements = 0;
    for (const [route, selectors] of Object.entries(baseline)) {
      for (const [selector, previous] of Object.entries(selectors)) {
        const current = results[route][selector];
        assert.equal(current.length, previous.length, `${route} ${selector} count`);
        previous.forEach((element, index) => {
          elements++;
          assert.deepEqual(current[index].css, element.css, `${route} ${selector}[${index}] CSS`);
          current[index].rect.forEach((value, axis) => assert.ok(Math.abs(value - element.rect[axis]) < 1, `${route} ${selector}[${index}] rect ${axis}: ${value} vs ${element.rect[axis]}`));
        });
      }
    }
    console.log(`PASS: preserved computed CSS and geometry of ${elements} elements on mobile/desktop (tolerance <1px).`);
  }
} finally { await browser.close(); }
