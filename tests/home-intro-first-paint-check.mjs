import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:8447/";
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.addInitScript(() => {
      window.introPaintFrames = [];
      function sample() {
        const intro = document.querySelector(".home-intro");
        const cover = getComputedStyle(document.documentElement, "::after");
        window.introPaintFrames.push({
          time: performance.now(),
          home: !!document.querySelector(".shop-intro"),
          covered: cover.content !== "none" && cover.position === "fixed",
          intro: !!intro,
          expired: document.documentElement.dataset.homeIntro === "expired",
        });
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/*.js", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(base, { waitUntil: "commit" });
    await page.locator(".shop-intro").waitFor();
    const before = await page.evaluate(() => {
      const cover = getComputedStyle(document.documentElement, "::after");
      return {
        pending: document.documentElement.dataset.homeIntro,
        content: cover.content,
        position: cover.position,
        background: cover.backgroundColor,
      };
    });
    console.log(width, "before Angular", before);
    try {
      assert.equal(
        before.pending,
        "pending",
        "prerendered home must be covered before Angular loads",
      );
      assert.equal(before.position, "fixed");
      assert.equal(before.background, "rgb(247, 241, 229)");
    } finally {
      release();
    }
    await page.locator(".home-intro").waitFor();
    await page.waitForFunction(
      () => !document.documentElement.hasAttribute("data-home-intro"),
    );
    await page.waitForFunction(() =>
      window.introPaintFrames.some((frame) => frame.intro),
    );
    const frames = await page.evaluate(() => window.introPaintFrames);
    const handoff = frames.findIndex((frame) => frame.intro);
    assert.ok(handoff > 0, "sample the handoff from early cover to intro");
    assert.equal(
      frames.slice(0, handoff).filter((frame) => frame.home && !frame.covered)
        .length,
      0,
      "no home frame before intro",
    );
    assert.equal(
      await page
        .locator(".home-intro")
        .evaluate((el) => getComputedStyle(el).visibility),
      "visible",
    );
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".home-intro")).visibility ===
        "hidden",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".home-intro").waitFor();
    await page.waitForFunction(() =>
      window.introPaintFrames.some((frame) => frame.intro),
    );
    const reloadFrames = await page.evaluate(() => window.introPaintFrames);
    const reloadHandoff = reloadFrames.findIndex((frame) => frame.intro);
    assert.equal(
      reloadFrames
        .slice(0, reloadHandoff)
        .filter((frame) => frame.home && !frame.covered).length,
      0,
      "no home flash on reload",
    );
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".home-intro")).visibility ===
        "hidden",
    );
    await page.getByRole("link", { name: "Выбрать выпечку" }).click();
    await page.locator(".catalog-page").waitFor();
    await page.locator(".brand").click();
    await page.locator(".shop-intro").waitFor();
    assert.equal(
      await page.locator(".home-intro").count(),
      0,
      "internal return must not replay intro",
    );
    assert.equal(
      await page.evaluate(() =>
        document.documentElement.hasAttribute("data-home-intro"),
      ),
      false,
    );
    await page.close();
  }
  const stalled = await browser.newPage();
  let resume;
  const stalledGate = new Promise((resolve) => {
    resume = resolve;
  });
  await stalled.route("**/*.js", async (route) => {
    await stalledGate;
    await route.continue();
  });
  await stalled.goto(base, { waitUntil: "commit" });
  await stalled.waitForFunction(
    () => document.documentElement.dataset.homeIntro === "expired",
  );
  assert.equal(
    await stalled.evaluate(
      () => getComputedStyle(document.documentElement, "::after").content,
    ),
    "none",
    "stalled boot exposes the page",
  );
  resume();
  await stalled.waitForFunction(
    () => !document.documentElement.hasAttribute("data-home-intro"),
  );
  assert.equal(
    await stalled.locator(".home-intro").count(),
    0,
    "expired intro cannot cover the page later",
  );
  await stalled.close();
  const failed = await browser.newPage();
  await failed.route("**/site-config.json", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await failed.goto(base);
  await failed
    .getByText("Не удалось загрузить настройки сайта. Обновите страницу позже.")
    .waitFor();
  assert.equal(
    await failed.evaluate(() =>
      document.documentElement.hasAttribute("data-home-intro"),
    ),
    false,
    "boot error clears early cover",
  );
  await failed.close();
  for (const options of [
    { reducedMotion: "reduce" },
    { javaScriptEnabled: false },
  ]) {
    const page = await browser.newPage(options);
    await page.goto(base);
    assert.equal(await page.locator(".home-intro").count(), 0);
    assert.equal(
      await page.evaluate(() =>
        document.documentElement.hasAttribute("data-home-intro"),
      ),
      false,
    );
    await page.locator(".shop-intro").waitFor();
    await page.close();
  }
  console.log(
    "PASS: desktop/mobile pre-Angular cover and frame handoff; first visit, reload, internal return; stalled/failed boot, reduced motion, no JavaScript.",
  );
} finally {
  await browser.close();
}
