import { readFile } from "node:fs/promises";
const angular = JSON.parse(
  await readFile(new URL("../angular.json", import.meta.url), "utf8"),
);
export const previewBase =
  "http://127.0.0.1:8447" +
  angular.projects["milana-angular"].architect.build.configurations.production
    .baseHref;

// The production build's actual published catalog and unchanged photo files.
export async function usePublishedSnapshot(page) {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../src/app/static-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  await page.route("**/rest/v1/**", (route) => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    const body =
      table === "products"
        ? snapshot.products.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            description: p.description,
            category_id: p.category,
            fillings: p.fillings,
            price: p.price,
            price_unit: p.priceUnit,
            photos: p.photos.map((staticPath, i) => ({
              static: staticPath,
              ...p.photoFocus[i],
            })),
            primary_photo: 0,
            featured: p.featured,
            published: true,
            availability: p.availability,
          }))
        : table === "categories"
          ? snapshot.categories
          : snapshot.settings;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
