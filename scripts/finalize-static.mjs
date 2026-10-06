import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = "dist/milana-angular/browser";
const paths = JSON.parse(await readFile(".static-paths.json", "utf8"));
// Admin entry documents contain only the Angular shell; Auth remains client-side.
const home = await readFile(`${root}/index.html`, "utf8");
const shell = home
  .replace(/<app-root[\s\S]*?<\/app-root>/, "<app-root></app-root>")
  .replace(
    /<title>[^<]*<\/title>/,
    "<title>Вход для Миланы — Выпечка у Миланы</title>",
  )
  .replace(
    /<meta name="robots"[^>]*>/,
    '<meta name="robots" content="noindex, nofollow">',
  )
  .replace(/<link rel="canonical"[^>]*>/, "");
for (const path of ["admin", "admin/login"]) {
  await mkdir(`${root}/${path}`, { recursive: true });
  await writeFile(`${root}/${path}/index.html`, shell);
}
await writeFile(
  `${root}/404.html`,
  '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Страница не найдена</title><h1>Страница не найдена</h1><a href="/cre249/catalog/">Перейти в каталог</a></html>',
);
await writeFile(
  `${root}/sitemap.xml`,
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    paths
      .map(
        (path) =>
          `<url><loc>https://worrqisk-cmd.github.io/cre249${path}</loc></url>`,
      )
      .join("") +
    "</urlset>",
);
await writeFile(`${root}/.nojekyll`, "");
for (const path of paths) {
  const html = await readFile(`${root}${path}index.html`, "utf8");
  if (
    !html.includes('rel="canonical"') ||
    !html.includes("<h1") ||
    html.includes("signedUrl")
  )
    throw new Error("Incomplete prerender: " + path);
}
console.log(
  `Verified ${paths.length} static public documents; admin shells and sitemap generated`,
);
