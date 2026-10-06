import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8447/cre249/';
const engines = process.env.MOTION_FIREFOX ? [['Chromium', chromium], ['Firefox', firefox]] : [['Chromium', chromium]];

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    for (const slug of ['orehovy', 'myasnoy', 'molochnaya-devochka']) {
      await page.goto(`${base}#/catalog`);
      await page.locator(`[data-product-slug="${slug}"]`).scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        window.motionFrames = [];
        const until = performance.now() + 650;
        function sample() {
          const target = document.querySelector('.dialog-photo img');
          const copy = [...document.body.children].find(el => el.tagName === 'IMG' && el.style.zIndex === '100');
          if (target) {
            const rect = target.getBoundingClientRect();
            const copyRect = copy?.getBoundingClientRect();
            window.motionFrames.push({
              visible: !!copy || getComputedStyle(target).visibility === 'visible',
              cropMatches: !copy || getComputedStyle(copy).objectPosition === getComputedStyle(target).objectPosition,
              targetReady: !!copy || (target.complete && target.naturalWidth > 0),
              targetY: rect.y,
              distance: copyRect ? Math.hypot(rect.x - copyRect.x, rect.y - copyRect.y, rect.width - copyRect.width, rect.height - copyRect.height) : null,
              backdrop: Number(getComputedStyle(document.querySelector('.dialog-backdrop')).opacity),
              content: Number(getComputedStyle(document.querySelector('.dialog-content')).opacity),
            });
          }
          if (performance.now() < until) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      await page.locator(`[data-product-slug="${slug}"]`).click();
      await page.waitForTimeout(680);
      const frames = await page.evaluate(() => window.motionFrames);
      assert.ok(frames.length > 15, `${name} ${slug}: sampled transition`);
      assert.ok(frames.every(frame => frame.visible && frame.cropMatches && frame.targetReady), `${name} ${slug}: uninterrupted image`);
      assert.equal(new Set(frames.map(frame => frame.targetY)).size, 1, `${name} ${slug}: stable destination`);
      assert.ok(frames.filter(frame => frame.distance !== null).at(-1).distance < 1, `${name} ${slug}: copy reaches destination`);
      assert.ok(frames[0].backdrop < frames.at(-1).backdrop && frames[0].content < frames.at(-1).content, `${name} ${slug}: layered entrance`);
      await page.keyboard.press('Escape');
      await page.waitForURL('**/#/catalog');
    }
    await page.locator('[data-product-slug="orehovy"]').click();
    await page.waitForTimeout(140);
    await page.keyboard.press('Escape');
    await page.waitForURL('**/#/catalog');
    assert.equal(await page.locator('body > img[style*="position: fixed"]').count(), 0, `${name}: interrupted flight cleaned up`);
    await page.locator('[data-product-slug="myasnoy"]').click();
    await page.goBack();
    await page.waitForURL('**/#/catalog');
    assert.equal(await page.getByRole('dialog').count(), 0, `${name}: Back closes dialog`);
    await page.close();
    const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await reduced.goto(`${base}#/catalog`);
    await reduced.locator('[data-product-slug="orehovy"]').click();
    await reduced.getByRole('dialog').waitFor();
    assert.equal(await reduced.locator('body > img[style*="position: fixed"]').count(), 0, `${name}: reduced motion skips flight`);
    await reduced.keyboard.press('Escape');
    await reduced.waitForURL('**/#/catalog');
    await reduced.close();
    console.log(`${name}: product motion checks passed`);
  } finally {
    await browser.close();
  }
}
