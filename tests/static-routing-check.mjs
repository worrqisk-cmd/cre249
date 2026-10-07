import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { usePublishedSnapshot } from "./catalog-fixture.mjs";
const base = process.env.BASE_URL || "http://127.0.0.1:8447/";
const paths = JSON.parse(await readFile(".static-paths.json", "utf8"));
const titles = new Set();
for (const path of paths) {
  const response = await fetch(base + path.slice(1));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.match(html, /<base href="\/">/);
  assert.ok(!html.includes("/cre249/"), `old base in ${path}`);
  assert.match(html, /<h1/);
  assert.match(html, /rel="canonical"/);
  assert.ok(html.includes(`https://milana-pechet.ru${path}`));
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  assert.ok(!titles.has(title), `duplicate title: ${path}`); titles.add(title);
  if (path.startsWith("/item/")) assert.match(html, /Обсудить заказ/);
}
assert.equal((await fetch(base + "unknown/")).status, 404);
const sitemap = await (await fetch(base + "sitemap.xml")).text();
assert.equal((sitemap.match(/<loc>/g) || []).length, paths.length);
assert.ok(!sitemap.includes("admin"));
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    if (process.env.CATALOG_SNAPSHOT) await usePublishedSnapshot(page);
    const errors = [];
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of [
      "catalog/",
      "catalog/sweet/",
      "item/assorti/",
      "admin/login/",
    ]) {
      await page.goto(base + path);
      await page
        .locator(
          path.startsWith("admin")
            ? 'input[name="password"]'
            : path.startsWith("item")
              ? ".item-page"
              : ".product-card",
        )
        .first()
        .waitFor();
      await page.reload();
      await page
        .locator(
          path.startsWith("admin")
            ? 'input[name="password"]'
            : path.startsWith("item")
              ? ".item-page"
              : ".product-card",
        )
        .first()
        .waitFor();
      assert.equal(await page.locator(".home-intro").count(), 0);
    }
    for (const path of ["catalog", "item/assorti", "admin/login"]) {
      await page.goto(base + "#/" + path);
      await page.waitForURL(base + path + "/");
    }
    await page.goto(base + "admin/");
    await page.waitForURL(base + "admin/login/");
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex, nofollow",
    );
    await page.goto(base + "catalog/sweet/");
    const card = page.locator('[data-product-slug="assorti"]');
    await card.waitFor();
    await card.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await card.click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Клубника", exact: true }).click();
    await page
      .getByRole("button", { name: "Обсудить заказ", exact: true })
      .click();
    await page
      .locator("textarea")
      .fill(
        (await page.locator("textarea").inputValue()) + " Дополнительный текст",
      );
    await page.getByRole("button", { name: "Малина", exact: true }).click();
    assert.match(
      await page.locator("textarea").inputValue(),
      /Дополнительный текст/,
    );
    const wa = new URL(
      await page
        .getByRole("link", { name: "Открыть WhatsApp" })
        .getAttribute("href"),
    );
    assert.equal(wa.pathname, "/79642034835");
    assert.match(wa.searchParams.get("text"), /Дополнительный текст/);
    await page.keyboard.press("Escape");
    await page.waitForURL(base + "catalog/sweet/");
    await page.waitForTimeout(100);
    assert.equal(
      await card.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 5);
    await page.goForward();
    await page.getByRole("dialog").waitFor();
    await page.goBack();
    await card.waitFor();
    const images = await page.locator("img").evaluateAll((images) =>
      images.filter((image) => image.getBoundingClientRect().width > 0)
        .every((image) => image.complete && image.naturalWidth > 0),
    );
    assert.ok(images, "visible images loaded");
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage();
  if (process.env.CATALOG_SNAPSHOT) await usePublishedSnapshot(page);
  await page.goto(base);
  await page.locator("app-home-intro").waitFor();
  await page.goto(base + "catalog/");
  await page.getByRole("link", { name: "← На главную" }).click();
  await page.waitForURL(base);
  assert.equal(await page.locator("app-home-intro").count(), 0);
} finally {
  await browser.close();
}
console.log(
  `PASS: ${paths.length} HTTP documents; desktop/mobile reload, legacy URLs, admin guard, dialog history/focus/scroll, fillings, message, WhatsApp and intro`,
);
