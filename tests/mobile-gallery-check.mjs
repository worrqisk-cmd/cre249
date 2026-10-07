import assert from "node:assert/strict";
import { chromium } from "playwright";
import { usePublishedSnapshot, previewBase } from "./catalog-fixture.mjs";
const base = process.env.BASE_URL || previewBase;
const browser = await chromium.launch();
try {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 390, height: 500 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({
      viewport,
      reducedMotion: "reduce",
      ignoreHTTPSErrors: true,
    });
    await usePublishedSnapshot(page);
    for (const slug of ["kurnik", "zefirnye-tsvety", "assorti", "milka"]) {
      await page.goto(`${base}catalog/`);
      const card = page.locator(`[data-product-slug="${slug}"]`);
      await card.scrollIntoViewIfNeeded();
      const catalogScroll = await page.evaluate(() => scrollY);
      await card.click();
      await page.getByRole("dialog").waitFor();
      await page.waitForFunction(() => {
        const img = document.querySelector(".dialog-photo picture img");
        return img?.naturalWidth > 0 && img.style.visibility !== "hidden";
      });
      const thumbs = page.locator(".dialog-thumbnails button");
      if (await thumbs.count()) await thumbs.first().scrollIntoViewIfNeeded();
      let frame;
      for (let i = 0; i < Math.max(1, await thumbs.count()); i++) {
        if (await thumbs.count()) await thumbs.nth(i).click();
        const expected = (await thumbs.count())
          ? await thumbs.nth(i).locator("img").getAttribute("src")
          : null;
        await page.waitForFunction((expected) => {
          const img = document.querySelector(".dialog-photo picture img");
          return (
            img?.complete &&
            img.naturalWidth > 0 &&
            (!expected || img.getAttribute("src") === expected)
          );
        }, expected);
        await page.waitForTimeout(120);
        const dims = await page.locator(".dialog-photo").evaluate((el) => {
          const img = el.querySelector("picture img"),
            r = img.getBoundingClientRect();
          const scale = Math.min(
            r.width / img.naturalWidth,
            r.height / img.naturalHeight,
          );
          return {
            height: el.getBoundingClientRect().height,
            contentTop:
              el.nextElementSibling.getBoundingClientRect().top +
              el.closest(".dialog-grid").scrollTop,
            scroll: el.closest(".dialog-grid").scrollTop,
            box: [r.width, r.height],
            natural: [img.naturalWidth, img.naturalHeight],
            paint: [img.naturalWidth * scale, img.naturalHeight * scale],
          };
        });
        if (frame) {
          assert.equal(dims.height, frame.height, `${slug}: stable frame`);
          assert.equal(
            dims.contentTop,
            frame.contentTop,
            `${slug}: stable text`,
          );
          assert.equal(
            dims.scroll,
            frame.scroll,
            `${slug}: stable gallery scroll`,
          );
        }
        frame = dims;
        assert.ok(dims.box[0] > 0 && dims.box[1] > 0);
        if (
          viewport.width === 390 &&
          viewport.height === 844 &&
          slug === "kurnik" &&
          i === 0 &&
          dims.natural[0] > 0
        ) {
          console.log("AFTER", i, JSON.stringify(dims));
          const old = await page.addStyleTag({
            content:
              ".dialog-photo{height:38svh!important;min-height:240px!important}.dialog-image-link{display:contents!important}.dialog-thumbnails{margin:12px!important;padding:6px!important;background:#3a241866!important}.dialog-thumbnails button{width:64px!important;height:64px!important}",
          });
          console.log(
            "BEFORE",
            i,
            await page.locator(".dialog-photo picture img").evaluate((img) => {
              const r = img.getBoundingClientRect(),
                s = Math.min(
                  r.width / img.naturalWidth,
                  r.height / img.naturalHeight,
                );
              return {
                box: [r.width, r.height],
                paint: [img.naturalWidth * s, img.naturalHeight * s],
              };
            }),
          );
          await old.evaluate((el) => el.remove());
        }
      }
      const imageLink = page.locator(".dialog-image-link");
      assert.equal(
        await imageLink.getAttribute("href"),
        await page.locator(".dialog-photo picture img").getAttribute("src"),
      );
      if (viewport.width === 390 && viewport.height === 844) {
        const popupPromise = page.waitForEvent("popup");
        await imageLink.click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        assert.ok(
          await popup
            .locator("img")
            .evaluate((img) => img.complete && img.naturalWidth > 0),
          "full image opens",
        );
        await popup.close();
      }
      await page
        .getByRole("button", { name: "Обсудить заказ", exact: true })
        .click();
      await page.locator("textarea").waitFor();
      assert.ok(
        (await page.locator("textarea").inputValue()).includes("Здравствуйте"),
      );
      await page.getByRole("button", { name: "Закрыть подробности" }).click();
      await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.waitForFunction(
        (slug) =>
          document.activeElement?.getAttribute("data-product-slug") === slug,
        slug,
      );
      assert.ok(
        Math.abs((await page.evaluate(() => scrollY)) - catalogScroll) < 1,
        "catalog scroll restored",
      );
      await card.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await card.click();
      await page.getByRole("dialog").waitFor();
      await page.goBack();
      await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }
    console.log("PASS", viewport);
    await page.close();
  }
  const slow = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await usePublishedSnapshot(slow);
  const pending = [];
  await slow.route("**/photos/archive_060_kurnik*", (route) => {
    pending.push(route);
  });
  await slow.goto(`${base}catalog/`, { waitUntil: "domcontentloaded" });
  await slow.locator('[data-product-slug="kurnik"]').click();
  await slow.waitForFunction(
    () =>
      document.querySelector(".dialog-photo picture img")?.style.visibility !==
      "hidden",
    {},
    { timeout: 5000 },
  );
  assert.ok(
    await slow
      .locator(".dialog-photo picture img")
      .evaluate((img) => img.naturalWidth > 0),
    "primary usable despite stalled secondary",
  );
  const reserved = await slow
    .locator(".dialog-photo")
    .evaluate((el) => el.getBoundingClientRect().height);
  await slow.unroute("**/photos/archive_060_kurnik*");
  for (const route of pending) await route.continue();
  await slow.locator(".dialog-thumbnails button").last().click();
  await slow.waitForFunction(() => {
    const img = document.querySelector(".dialog-photo picture img");
    return (
      img?.getAttribute("src")?.includes("archive_060_kurnik") &&
      img.complete &&
      img.naturalWidth > 0
    );
  });
  assert.equal(
    await slow
      .locator(".dialog-photo")
      .evaluate((el) => el.getBoundingClientRect().height),
    reserved,
    "late dimensions do not move the frame",
  );
  await slow.keyboard.press("Escape");
  await slow.close();
  console.log(
    "PASS stalled secondary: bounded preparation, primary usable, late-photo frame stable",
  );
} finally {
  await browser.close();
}
