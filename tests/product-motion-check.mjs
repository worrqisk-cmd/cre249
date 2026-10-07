import assert from "node:assert/strict";
import { chromium, firefox } from "playwright";
import { usePublishedSnapshot, previewBase } from "./catalog-fixture.mjs";
const base = process.env.BASE_URL || previewBase;
const engines = process.env.MOTION_FIREFOX
  ? [
      ["Chromium", chromium],
      ["Firefox", firefox],
    ]
  : [["Chromium", chromium]];
// Independent browser-side measurement of the painted image, including cover and clipping.
function measure(image) {
  const r = image.getBoundingClientRect(),
    s = getComputedStyle(image),
    c = (
      image.closest(".product-image,.dialog-image-link") || image
    ).getBoundingClientRect();
  const scale = (s.objectFit === "cover" ? Math.max : Math.min)(
    r.width / image.naturalWidth,
    r.height / image.naturalHeight,
  );
  const w = image.naturalWidth * scale,
    h = image.naturalHeight * scale,
    [x, y] = s.objectPosition.split(" ").map(parseFloat);
  return {
    clip: [c.x, c.y, c.width, c.height],
    photo: [
      r.x + ((r.width - w) * x) / 100,
      r.y + ((r.height - h) * y) / 100,
      w,
      h,
    ],
  };
}
const closeTo = (actual, expected, label) =>
  actual.forEach((n, i) =>
    assert.ok(
      Math.abs(n - expected[i]) < 1,
      `${label}[${i}]: ${n} vs ${expected[i]}`,
    ),
  );
for (const [name, engine] of engines) {
  const browser = await engine.launch();
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await usePublishedSnapshot(page);
      for (const slug of [
        "slivochno-karamelny",
        "kuraga-oreh",
        "orehovy",
        "myasnoy",
        "molochnaya-devochka",
      ]) {
        await page.goto(`${base}catalog/`);
        const card = page.locator(`[data-product-slug="${slug}"]`);
        await card.scrollIntoViewIfNeeded();
        await card.locator("img").evaluate((i) => i.decode());
        const origin = await card.locator("img").evaluate(measure);
        const scroll = await page.evaluate(() => scrollY);
        await page.evaluate(() => {
          window.motionFrames = [];
          window.recordMotion = true;
          function sample() {
            const copy = document.querySelector(".photo-flight");
            if (copy) {
              const c = copy.getBoundingClientRect(),
                i = copy.querySelector("img").getBoundingClientRect();
              window.motionFrames.push({
                clip: [c.x, c.y, c.width, c.height],
                photo: [i.x, i.y, i.width, i.height],
              });
            }
            if (window.recordMotion) requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
        await card.click();
        await page.getByRole("dialog").waitFor();
        await page.waitForFunction(
          () =>
            document.querySelector(".dialog-photo picture img")?.style
              .visibility !== "hidden" &&
            !document.querySelector(".photo-flight"),
        );
        const target = await page
          .locator(".dialog-photo picture img")
          .evaluate(measure);
        let frames = await page.evaluate(() => window.motionFrames);
        assert.ok(frames.length > 8, `${name} ${slug}: opening animates`);
        closeTo(frames.at(-1).clip, target.clip, "opening clip");
        closeTo(frames.at(-1).photo, target.photo, "opening bitmap");
        assert.ok(
          Math.abs(frames[0].clip[2] - origin.clip[2]) < 5,
          "starts at card size",
        );
        await page.evaluate(() => {
          window.motionFrames = [];
        });
        await page.getByRole("button", { name: "Закрыть подробности" }).click();
        // Repeated close is ignored, including while the flight is running.
        await page.keyboard.press("Escape");
        await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
        await page.waitForFunction(
          () => !document.querySelector(".photo-flight"),
        );
        frames = await page.evaluate(() => {
          window.recordMotion = false;
          return window.motionFrames;
        });
        assert.ok(frames.length > 8, "closing animates");
        closeTo(frames.at(-1).clip, origin.clip, "return clip");
        closeTo(frames.at(-1).photo, origin.photo, "return bitmap");
        const restored = await card.locator("img").evaluate(measure);
        closeTo(restored.clip, origin.clip, "restored card clip");
        closeTo(restored.photo, origin.photo, "restored card bitmap");
        assert.ok(
          Math.abs((await page.evaluate(() => scrollY)) - scroll) < 1,
          "catalog scroll restored",
        );
        await page.waitForFunction(
          (slug) =>
            document.activeElement?.getAttribute("data-product-slug") === slug,
          slug,
        );
      }

      // A horizontal secondary photo returns to the portrait primary without distortion or a final swap.
      const flowers = page.locator('[data-product-slug="zefirnye-tsvety"]');
      await flowers.scrollIntoViewIfNeeded();
      const flowerOrigin = await flowers.locator("img").evaluate(measure);
      await flowers.click();
      await page.locator(".dialog-thumbnails button").nth(1).click();
      await page.waitForFunction(() => {
        const img = document.querySelector(".dialog-photo picture img");
        return (
          img?.getAttribute("src")?.includes("archive_001") &&
          img.complete &&
          img.naturalWidth > 0
        );
      });
      await page.evaluate(() => {
        window.switchedFrames = [];
        window.recordSwitched = true;
        function sample() {
          const copy = document.querySelector(".photo-flight");
          if (copy) {
            const c = copy.getBoundingClientRect();
            const imgs = [...copy.querySelectorAll("img")];
            const visible =
              imgs
                .filter((i) => Number(getComputedStyle(i).opacity) > 0.5)
                .at(-1) || imgs[0];
            const r = visible.getBoundingClientRect();
            window.switchedFrames.push({
              clip: [c.x, c.y, c.width, c.height],
              photo: [r.x, r.y, r.width, r.height],
              ratios: imgs.map((i) => {
                const r = i.getBoundingClientRect();
                return [r.width / r.height, i.naturalWidth / i.naturalHeight];
              }),
            });
          }
          if (window.recordSwitched) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      await page.getByRole("button", { name: "Закрыть подробности" }).click();
      await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
      await page.waitForFunction(
        () => !document.querySelector(".photo-flight"),
      );
      const switched = await page.evaluate(() => {
        window.recordSwitched = false;
        return window.switchedFrames;
      });
      closeTo(switched.at(-1).clip, flowerOrigin.clip, "switched return clip");
      closeTo(
        switched.at(-1).photo,
        flowerOrigin.photo,
        "switched return bitmap",
      );
      assert.ok(
        switched.every((frame) =>
          frame.ratios.every(
            ([paint, natural]) => !natural || Math.abs(paint - natural) < 0.01,
          ),
        ),
        "different aspect photos retain their proportions",
      );
      // Interrupt an opening flight and reverse from its current geometry.
      const card = page.locator('[data-product-slug="kuraga-oreh"]');
      await card.click();
      await page.waitForSelector(".photo-flight");
      await page.waitForTimeout(80);
      await page.keyboard.press("Escape");
      await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
      await page.waitForFunction(
        () => !document.querySelector(".photo-flight"),
      );
      await card.click();
      await page.getByRole("dialog").waitFor();
      await page.goBack();
      await page.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
      await page.waitForFunction(
        () => !document.querySelector(".photo-flight"),
      );
      console.log(
        `${name} ${width}: opening/closing crop, interrupted flight, repeated close, Back and scroll/focus passed`,
      );
      await page.close();
    }
    const reduced = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await usePublishedSnapshot(reduced);
    await reduced.goto(`${base}catalog/`);
    await reduced.locator('[data-product-slug="kuraga-oreh"]').click();
    await reduced.getByRole("dialog").waitFor();
    assert.equal(await reduced.locator(".photo-flight").count(), 0);
    await reduced.keyboard.press("Escape");
    await reduced.waitForURL((url) => /\/catalog\/?$/.test(url.pathname));
    await reduced.close();
  } finally {
    await browser.close();
  }
}
