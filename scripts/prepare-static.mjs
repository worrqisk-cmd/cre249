import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(await readFile("public/site-config.json", "utf8"));
const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const [p, c, s] = await Promise.all([
  client
    .from("products")
    .select("*", { count: "exact" })
    .eq("published", true)
    .order("sort_order")
    .order("slug"),
  client
    .from("categories")
    .select("*", { count: "exact" })
    .eq("is_public", true)
    .order("sort_order"),
  client.from("site_settings").select("*").eq("id", true).single(),
]);
for (const result of [p, c, s])
  if (result.error)
    throw new Error("Static catalog request failed: " + result.error.message);
if (
  p.count !== p.data.length ||
  c.count !== c.data.length
)
  throw new Error("Truncated static catalog");
const safe = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
if (
  p.data.some(
    (row) =>
      !safe(row.slug) ||
      !c.data.some((category) => category.id === row.category_id),
  ) ||
  c.data.some((row) => !safe(row.id))
)
  throw new Error("Invalid public route");
await rm("public/catalog-media", { recursive: true, force: true });
await mkdir("public/catalog-media", { recursive: true });
const products = [];
for (const row of p.data) {
  const ordered = [...row.photos];
  if (row.primary_photo > 0 && row.primary_photo < ordered.length)
    ordered.unshift(ordered.splice(row.primary_photo, 1)[0]);
  const photos = [];
  for (const [index, photo] of ordered.entries()) {
    if (
      photo.static &&
      !/^photos\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(photo.static)
    )
      throw new Error("Invalid static photo");
    if (photo.static) {
      await readFile("public/" + photo.static);
      photos.push(photo.static);
      continue;
    }
    if (!photo.path) throw new Error("Invalid published photo");
    const { data, error } = await client.storage
      .from("milana-catalog")
      .createSignedUrl(photo.path, 600);
    if (error) throw error;
    const response = await fetch(data.signedUrl);
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    )
      throw new Error("Published photo download failed");
    const ext = photo.path.split(".").at(-1).toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext))
      throw new Error("Unsupported photo type");
    const path = `catalog-media/${row.slug}-${index}.${ext}`;
    await writeFile(
      "public/" + path,
      Buffer.from(await response.arrayBuffer()),
    );
    photos.push(path);
  }
  products.push({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category_id,
    fillings: row.fillings,
    price: row.price,
    priceUnit: row.price_unit,
    photos,
    focus: ordered[0]
      ? {
          desktop: ordered[0].desktop || "50% 50%",
          mobile: ordered[0].mobile || "50% 50%",
        }
      : undefined,
    photoFocus: ordered.map((photo) => ({
      desktop: photo.desktop || "50% 50%",
      mobile: photo.mobile || "50% 50%",
    })),
    featured: row.featured,
    availability: row.availability,
  });
}
const verification = await Promise.all([
  client
    .from("products")
    .select("*")
    .eq("published", true)
    .order("sort_order")
    .order("slug"),
  client
    .from("categories")
    .select("*")
    .eq("is_public", true)
    .order("sort_order"),
  client.from("site_settings").select("*").eq("id", true).single(),
]);
if (
  verification.some(
    (result, i) =>
      result.error ||
      JSON.stringify(result.data) !== JSON.stringify([p, c, s][i].data),
  )
)
  throw new Error(
    "Catalog changed during generation; rebuild before publishing",
  );
const snapshot = { products, categories: c.data, settings: s.data };
await writeFile("src/app/static-catalog.json", JSON.stringify(snapshot));
const paths = [
  "/",
  "/catalog/",
  ...c.data.map((row) => `/catalog/${row.id}/`),
  ...products.map((row) => `/item/${row.slug}/`),
];
await writeFile(".static-paths.json", JSON.stringify(paths));
console.log(
  `Prepared ${products.length} published products and ${c.data.length} categories`,
);
