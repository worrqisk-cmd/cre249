import assert from "node:assert/strict";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { usePublishedSnapshot } from "./catalog-fixture.mjs";
const browser = await chromium.launch({ headless: !process.env.HEADED });
const base = process.env.BASE_URL || "http://127.0.0.1:8447/";
const results = [];
const diagnostic = process.env.DIAG === "1";
try {
  for (const width of [1440, 390]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        isMobile: width < 500,
        reducedMotion,
      });
      await usePublishedSnapshot(page);
      await page.addInitScript(() => {
        const log = (window.positionLog = []);
        window.positionSlug = "myasnoy";
        window.positionPhase = "idle";
        window.positionSample = (event, detail) => {
          const card = document.querySelector(
            `[data-product-slug="${window.positionSlug}"]`,
          );
          const categories = document.querySelector(".category-list");
          log.push({
            event,
            detail,
            phase: window.positionPhase,
            time: performance.now(),
            y: scrollY,
            inner: innerWidth,
            client: document.documentElement.clientWidth,
            body: document.body?.getBoundingClientRect().width,
            height: document.documentElement.scrollHeight,
            lock: document.body?.style.overflow,
            card: card?.getBoundingClientRect().toJSON(),
            categories: categories?.getBoundingClientRect().toJSON(),
            focus:
              document.activeElement?.getAttribute("data-product-slug") ||
              document.activeElement?.className,
            flight: document
              .querySelector(".photo-flight")
              ?.getBoundingClientRect()
              .toJSON(),
          });
        };
        const scroll = window.scrollTo;
        window.scrollTo = function (...args) {
          window.positionSample("scrollTo", args);
          return scroll.apply(this, args);
        };
        const focus = HTMLElement.prototype.focus;
        HTMLElement.prototype.focus = function (...args) {
          window.positionSample("focus:before", {
            class: this.className,
            args,
          });
          const result = focus.apply(this, args);
          window.positionSample("focus:after");
          return result;
        };
        addEventListener("popstate", () => window.positionSample("popstate"));
        addEventListener("scroll", () => window.positionSample("scroll"));
        addEventListener("DOMContentLoaded", () => {
          new MutationObserver(() =>
            window.positionSample("body-style"),
          ).observe(document.body, {
            attributes: true,
            attributeFilter: ["style"],
          });
          function frame() {
            if (window.positionPhase !== "idle") window.positionSample("frame");
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
      });
      await page.goto(base + "catalog/");
      if (process.env.NO_GUTTER)
        await page.addStyleTag({
          content: "html {scrollbar-gutter: auto !important}",
        });
      await page.locator(".product-card").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => {
        const app = window.ng?.getComponent(document.querySelector("app-root"));
        app?.router.events.subscribe((event) =>
          window.positionSample("Router:" + event.constructor.name, {
            url: event.url,
            position: event.position,
          }),
        );
      });
      for (const [index, slug] of [
        "myasnoy",
        "assorti",
        "kuraga-oreh",
        "molochnaya-devochka",
        "myasnoy",
        "assorti",
        "kuraga-oreh",
        "molochnaya-devochka",
      ].entries()) {
        const card = page.locator(`[data-product-slug="${slug}"]`);
        await card.evaluate(
          (el, index) =>
            window.scrollTo({
              top: Math.max(
                0,
                el.getBoundingClientRect().top +
                  scrollY -
                  (index < 4 ? 600 : 160),
              ),
              behavior: "instant",
            }),
          index,
        );
        await card.locator("img").evaluate((i) => i.decode());
        await page.evaluate((slug) => {
          window.positionSlug = slug;
          window.positionLog.length = 0;
          window.positionPhase = "opening";
          window.positionSample("baseline");
        }, slug);
        // Click a visible part without Playwright scrolling the whole card into view.
        await card.click({ position: { x: 20, y: 20 } });
        await page.getByRole("dialog").waitFor();
        if (index !== 6)
          await page.waitForFunction(
            () =>
              !document.querySelector(".photo-flight") &&
              document.querySelector(".dialog-photo img")?.naturalWidth > 0 &&
              document.querySelector(".dialog-photo img")?.style.visibility !==
                "hidden",
          );
        await page.evaluate(() => {
          window.positionPhase = "closing";
          window.positionSample("close:start");
        });
        if (index === 4) await page.goBack();
        else if (index === 5) {
          await page
            .getByRole("button", { name: "Закрыть подробности" })
            .click();
          await page.keyboard.press("Escape");
        } else await page.keyboard.press("Escape");
        await page.waitForURL(/\/catalog\/?$/);
        await page.waitForFunction(
          () =>
            !document.querySelector(".photo-flight") &&
            document.activeElement?.hasAttribute("data-product-slug"),
        );
        await page.waitForTimeout(150);
        const log = await page.evaluate(() => {
          window.positionSample("end");
          window.positionPhase = "idle";
          return window.positionLog;
        });
        const baseline = log[0];
        const closing = log.filter((x) => x.phase === "closing");
        const deviations = closing.filter(
          (x) =>
            Math.abs(x.y - baseline.y) > 1 ||
            !x.card ||
            ["x", "y", "width", "height"].some(
              (key) => Math.abs(x.card[key] - baseline.card[key]) > 1,
            ) ||
            !x.categories ||
            ["x", "y", "width", "height"].some(
              (key) =>
                Math.abs(x.categories[key] - baseline.categories[key]) > 1,
            ) ||
            Math.abs(x.body - baseline.body) > 1 ||
            x.inner !== baseline.inner,
        );
        const result = {
          width,
          reducedMotion,
          slug,
          index,
          baseline,
          rangeY: [
            Math.min(...closing.map((x) => x.y)),
            Math.max(...closing.map((x) => x.y)),
          ],
          deviations,
          events: log.filter((x) => x.event !== "frame"),
        };
        results.push(result);
        if (process.env.POSITION_LOG)
          await writeFile(
            process.env.POSITION_LOG,
            JSON.stringify(results, null, 2),
          );
        console.log(
          `${width} ${reducedMotion} ${slug} #${index}: scrollY ${result.rangeY.join("..")}; body ${baseline.body}; deviations ${deviations.length}`,
        );
        if (!diagnostic) {
          assert.equal(
            deviations.length,
            0,
            `${width} ${slug}: catalog moved during closing`,
          );
          assert.equal(log.at(-1).focus, slug, "focus returns to the origin");
          const focusEvents = closing.filter(
            (x) =>
              x.event === "focus:before" &&
              x.detail.class.includes("product-card"),
          );
          assert.ok(focusEvents.length > 0);
          assert.ok(
            focusEvents.every((x) => x.detail.args[0]?.preventScroll),
            "focus must not scroll",
          );
          assert.equal(
            closing.filter((x) => x.event === "scrollTo").length,
            0,
            "retained catalog needs no scroll repair",
          );
          const flight = closing.filter((x) => x.flight).at(-1)?.flight;
          if (flight && index !== 4) {
            const image = await card.locator(".product-image").boundingBox();
            for (const key of ["x", "y", "width", "height"])
              assert.ok(
                Math.abs(flight[key] - image[key]) < 1,
                `return destination ${key}`,
              );
          }
          assert.equal(
            await page.locator(".catalog-page").getAttribute("inert"),
            null,
          );
          assert.equal(
            await page.evaluate(() => document.body.style.overflow),
            "",
          );
        }
      }
      // A direct category URL must retain its filter through a modal round trip.
      await page.goto(base + "catalog/sweet/");
      const sweet = page.locator('[data-product-slug="assorti"]');
      await sweet.waitFor();
      const slugs = await page
        .locator(".product-card")
        .evaluateAll((els) => els.map((el) => el.dataset.productSlug));
      await sweet.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForURL(/\/catalog\/sweet\/?$/);
      assert.deepEqual(
        await page
          .locator(".product-card")
          .evaluateAll((els) => els.map((el) => el.dataset.productSlug)),
        slugs,
      );
      await page.close();
    }
  }
} finally {
  await browser.close();
}
