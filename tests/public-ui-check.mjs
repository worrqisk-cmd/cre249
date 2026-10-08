import assert from "node:assert/strict";
import { chromium } from "playwright";
import { usePublishedSnapshot } from "./catalog-fixture.mjs";
const base = process.env.BASE_URL || "http://127.0.0.1:8447/";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [360, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    if (process.env.CATALOG_SNAPSHOT) await usePublishedSnapshot(page);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["", "#/catalog", "#/item/assorti", "#/item/milka"]) {
      await page.goto(base + route);
      await page
        .locator(route.includes("item") ? ".dialog-content" : ".product-card")
        .first()
        .waitFor();
      assert.equal(
        await page.locator(".footer-credit").count(),
        route.includes("item") ? 0 : 1,
        `footer credit visibility: ${width} ${route}`,
      );
      await page.evaluate(() => document.fonts.ready);
      const fonts = await page
        .locator("h1,h2,h3,.product-meta p,.dialog-content p")
        .evaluateAll((elements) =>
          elements.map((el) => getComputedStyle(el).fontFamily),
        );
      assert.ok(
        fonts.every((font) => font.includes("Golos Text")),
        `Golos headings and body: ${width} ${route}`,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow: ${width} ${route}`,
      );
      if (route.includes("item")) {
        await page.waitForTimeout(520);
        await page.getByRole("button", { name: "Обсудить заказ" }).click();
        const textarea = page.locator("textarea");
        await textarea.fill(
          "Здравствуйте, Милана! Хочу обсудить заказ: Пирог «Ассорти». На 12 октября, пожалуйста.",
        );
        if (route.includes("assorti")) {
          await page
            .getByRole("button", { name: "Клубника", exact: true })
            .click();
          await page.waitForFunction(() =>
            document
              .querySelector("textarea")
              .value.includes("начинка: клубника"),
          );
          assert.match(await textarea.inputValue(), /12 октября/);
          assert.match(await textarea.inputValue(), /начинка: клубника/);
          assert.equal(
            await page.locator('.fillings button[aria-pressed="true"]').count(),
            1,
          );
        }
        assert.equal(
          new URL(
            await page
              .getByRole("link", { name: "Открыть WhatsApp" })
              .getAttribute("href"),
          ).searchParams.get("text"),
          await textarea.inputValue(),
        );
        // A reduced visible viewport exercises the keyboard layout path without media capture.
        if (width < 700) {
          await page.setViewportSize({ width, height: 390 });
          await textarea.focus();
          await page
            .getByRole("link", { name: "Открыть WhatsApp" })
            .scrollIntoViewIfNeeded();
          const action = await page
            .getByRole("link", { name: "Открыть WhatsApp" })
            .boundingBox();
          assert.ok(
            action.y >= 0 && action.y + action.height <= 391,
            "WhatsApp reachable in reduced viewport",
          );
          await page
            .getByRole("button", { name: "Клубника", exact: true })
            .count()
            .then(async (count) => {
              if (count) {
                await page
                  .getByRole("button", { name: "Клубника", exact: true })
                  .scrollIntoViewIfNeeded();
                assert.ok(
                  await page
                    .getByRole("button", { name: "Клубника", exact: true })
                    .isVisible(),
                );
              }
            });
          await page.setViewportSize({ width, height: 900 });
        }
      }
      if (route === "") {
        const credit = page.locator(".footer-credit");
        assert.equal(await credit.innerText(), "Разработка сайта — Waystroke");
        const link = credit.locator("a");
        assert.equal(await link.getAttribute("href"), "https://waystroke.online");
        assert.equal(await link.getAttribute("target"), null);
        assert.equal(await link.evaluate((el) => getComputedStyle(el).textDecorationLine), "underline");
        assert.equal(await credit.evaluate((el) => getComputedStyle(el).fontSize), "13px");
        assert.equal(await credit.evaluate((el) => el.parentElement.lastElementChild === el), true);
        const creditBox = await credit.boundingBox();
        const footerBox = await credit.evaluate((el) => el.parentElement.getBoundingClientRect().toJSON());
        assert.ok(creditBox.x >= footerBox.x && creditBox.x + creditBox.width <= footerBox.right, "credit remains within footer padding");
        await link.focus();
        assert.equal(await link.evaluate((el) => getComputedStyle(el).outlineStyle), "solid", "visible keyboard focus");
      }
      // Text enlargement is separate from browser zoom.
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%"),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `200% text overflow: ${width} ${route}`,
      );
      assert.equal(
        await page
          .locator("body")
          .evaluate((el) => el.scrollWidth > innerWidth),
        false,
        `200% body overflow: ${width} ${route}`,
      );
      if (route.includes("item")) {
        await page
          .getByRole("button", { name: "Скопировать", exact: true })
          .scrollIntoViewIfNeeded();
        assert.ok(
          await page
            .getByRole("button", { name: "Скопировать", exact: true })
            .isVisible(),
        );
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const admin = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await admin.goto(base + "#/admin/login");
  await admin.locator(".admin-login form").waitFor();
  assert.equal(await admin.locator(".footer-credit").count(), 0);
  await admin.close();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  if (process.env.CATALOG_SNAPSHOT) await usePublishedSnapshot(page);
  await page.goto(base);
  await page.locator("#featured .product-card").first().waitFor();
  assert.equal(await page.locator(".table-invite").count(), 0);
  assert.match(
    await page.locator('[data-product-slug="assorti"] img').getAttribute("src"),
    /archive_063_assorti/,
  );
  // The owner's sort order may leave Milka outside the three showcase slots.
  const milka = page.locator('#featured [data-product-slug="milka"] img');
  if (await milka.count()) {
    assert.equal(await milka.evaluate((el) => getComputedStyle(el).objectFit), "contain");
  }
  await page.locator('[data-product-slug="assorti"]').focus();
  assert.equal(
    await page
      .locator('[data-product-slug="assorti"]')
      .evaluate((el) => getComputedStyle(el).outlineStyle),
    "solid",
  );
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  assert.match(
    await page.locator(".dialog-photo picture > img").getAttribute("src"),
    /archive_063_assorti/,
  );
  assert.equal(await page.locator(".catalog-page").getAttribute("inert"), "");
  await page.getByRole("button", { name: "Обсудить заказ", exact: true }).waitFor();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Обсудить заказ",
  );
  await page.keyboard.press("Escape");
  await page.waitForURL((url) => url.hash === "#/" || url.hash === "");
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.getAttribute("data-product-slug"),
    ),
    "assorti",
  );
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 2);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(base + "#/item/assorti");
  await page.getByRole("button", { name: "Обсудить заказ" }).click();
  await page.locator("textarea").fill("Мой текст сообщения");
  await page.getByRole("button", { name: "Скопировать", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "Мой текст сообщения",
  );
  await page.close();
  // 1440×900 at 200% browser zoom corresponds to a 720×450 CSS viewport, DPR 2.
  const zoom = await browser.newPage({
    viewport: { width: 720, height: 450 },
    deviceScaleFactor: 2,
  });
  if (process.env.CATALOG_SNAPSHOT) await usePublishedSnapshot(zoom);
  for (const route of ["", "#/catalog", "#/item/assorti"]) {
    await zoom.goto(base + route);
    await zoom
      .locator(route.includes("item") ? ".dialog-content" : ".product-card")
      .first()
      .waitFor();
    assert.equal(
      await zoom.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "200% zoom equivalent overflow",
    );
    if (route.includes("item")) {
      await zoom.getByRole("button", { name: "Обсудить заказ" }).click();
      await zoom
        .getByRole("link", { name: "Открыть WhatsApp" })
        .scrollIntoViewIfNeeded();
      assert.ok(
        await zoom.getByRole("link", { name: "Открыть WhatsApp" }).isVisible(),
      );
    }
  }
  await zoom.close();
  // Deterministic ordering: keep the owner's order inside each photo group.
  const ordered = await browser.newPage();
  const row = (slug, photos) => ({
    id: slug,
    slug,
    title: slug,
    description: "",
    category_id: "sweet",
    fillings: [],
    price: null,
    price_unit: null,
    photos,
    primary_photo: 0,
    availability: "unconfirmed",
    published: true,
  });
  await ordered.route("**/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    const data =
      table === "products"
        ? [
            row("empty-first", []),
            row("photo-first", [{ static: "photos/05_kurnik.jpg" }]),
            row("empty-second", []),
            row("photo-second", [{ static: "photos/08_tort_milka.jpg" }]),
          ]
        : table === "categories"
          ? [
              {
                id: "sweet",
                label: "Сладкие пироги",
                sort_order: 1,
                is_public: true,
              },
            ]
          : { id: true, city: "Москва", whatsapp_number: "79642034835" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await ordered.goto(base + "#/catalog/sweet");
  await ordered.locator(".product-card").first().waitFor();
  assert.deepEqual(
    await ordered
      .locator(".product-card")
      .evaluateAll((els) => els.map((el) => el.dataset.productSlug)),
    ["photo-first", "photo-second", "empty-first", "empty-second"],
  );
  await ordered.close();
  console.log(
    "Public UI checks passed: typography, photo/gallery continuity, stable photo ordering, 360/390/768/1440, 200% text, reduced viewport, keyboard/focus/scroll, edited message and clipboard.",
  );
} finally {
  await browser.close();
}
