import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:8447/cre249/";
const browser = await chromium.launch({ headless: true });

async function expectNoIntro(page, route) {
  await page.goto(`${base}${route}`);
  await page.waitForTimeout(120);
  assert.equal(await page.locator(".home-intro").count(), 0, `no intro at ${route}`);
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".home-intro").waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector(".home-intro img");
    return image?.complete && image.naturalWidth > 0;
  });
  assert.equal(await page.locator(".home-intro").getAttribute("aria-hidden"), "true");
  assert.equal(await page.locator(".home-intro").evaluate((el) => getComputedStyle(el).pointerEvents), "none");
  assert.equal(await page.locator(".home-intro h1").count(), 0);
  assert.equal(await page.locator(".home-intro").evaluate((el) => document.body.style.overflow), "");
  await page.waitForTimeout(1700);
  assert.equal(await page.locator(".home-intro").evaluate((el) => getComputedStyle(el).visibility), "hidden");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".home-intro").waitFor();
  await page.goto(`${base}#/catalog`);
  await page.locator(".catalog-page").waitFor();
  await page.locator(".brand").click();
  await page.locator("#featured .product-card").first().waitFor();
  await page.waitForTimeout(120);
  assert.equal(await page.locator(".home-intro").count(), 0, "no replay after an internal transition");
  await page.close();

  const direct = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await expectNoIntro(direct, "#/catalog");
  await expectNoIntro(direct, "#/item/assorti");
  await expectNoIntro(direct, "#/admin/login");
  await direct.close();

  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await expectNoIntro(reduced, "");
  await reduced.close();

  // Suppress the animation completion callback. The independent 2.1 s
  // fail-safe still removes the decorative layer.
  const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fallback.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) =>
      nativeSetTimeout(delay === 1600 ? () => undefined : callback, delay, ...args);
  });
  await fallback.goto(base, { waitUntil: "domcontentloaded" });
  await fallback.locator(".home-intro").waitFor();
  await fallback.waitForTimeout(2250);
  assert.equal(await fallback.locator(".home-intro").evaluate((el) => getComputedStyle(el).visibility), "hidden");
  assert.equal(await fallback.locator(".home-intro").evaluate((el) => el.classList.contains("home-intro--finished")), true);
  await fallback.close();

  // With JavaScript off no Angular component is created, so the layer cannot
  // cover any server-rendered or other static content.
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(base);
  assert.equal(await noJs.locator(".home-intro").count(), 0);
  await noJs.close();

  console.log("Home intro checks passed: reload, routes, reduced motion, independent failsafe, and JavaScript disabled.");
} finally {
  await browser.close();
}
