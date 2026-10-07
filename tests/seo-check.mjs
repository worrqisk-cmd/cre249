import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const base = process.env.BASE_URL;
const root = 'dist/milana-angular/browser';
const origin = 'https://milana-pechet.ru';
async function get(path) {
  if (base) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    if (!path.startsWith('/admin'))
      assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') || ''), path);
    return response.text();
  }
  return readFile(`${root}${path}${path.endsWith('/') ? 'index.html' : ''}`, 'utf8');
}
const sitemap = await get('/sitemap.xml');
const xml = new JSDOM(sitemap, { contentType: 'application/xml' }).window.document;
const urls = [...xml.querySelectorAll('loc')].map(n => n.textContent);
assert.ok(urls.length > 2);
assert.equal(new Set(urls).size, urls.length);
const titles = new Set(), descriptions = new Set();
for (const url of urls) {
  assert.ok(url.startsWith(origin + '/'), url);
  assert.ok(!url.includes('/admin'), url);
  const path = new URL(url).pathname;
  const html = await get(path);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('base')?.getAttribute('href'), '/');
  assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), url);
  assert.ok(!/noindex/i.test(doc.querySelector('meta[name="robots"]')?.content || ''));
  assert.ok(!/github\.io|\/cre249\//.test(html), path);
  const title = doc.title, description = doc.querySelector('meta[name="description"]')?.content;
  assert.ok(title.length > 15 && !titles.has(title), `title ${path}`); titles.add(title);
  assert.ok(description?.length > 35 && !descriptions.has(description), `description ${path}`); descriptions.add(description);
  assert.ok(doc.querySelector('h1')?.textContent.trim(), path);
  if (path.startsWith('/item/')) assert.ok(doc.body.textContent.includes('Обсудить заказ'));
}
for (const path of ['/admin/', '/admin/login/']) {
  const doc = new JSDOM(await get(path)).window.document;
  assert.match(doc.querySelector('meta[name="robots"]')?.content || '', /noindex/);
}
if (!base) {
  const snapshot = JSON.parse(await readFile('src/app/static-catalog.json', 'utf8'));
  const expected = ['/', '/catalog/', ...snapshot.categories.map(c => `/catalog/${c.id}/`), ...snapshot.products.map(p => `/item/${p.slug}/`)];
  assert.deepEqual(urls.map(u => new URL(u).pathname).sort(), expected.sort(), 'sitemap matches build snapshot');
  const dirs = await readdir(`${root}/item`, { withFileTypes: true });
  assert.deepEqual(dirs.filter(d=>d.isDirectory()).map(d=>d.name).sort(), snapshot.products.map(p=>p.slug).sort(), 'no stale item documents');
}
// The public API applies RLS and published/is_public filters. No owner data is read.
if (process.env.CHECK_CATALOG === '1') {
  const config = JSON.parse(await readFile('public/site-config.json', 'utf8'));
  const headers = { apikey: config.supabasePublishableKey };
  const api = new URL('/rest/v1/products?select=slug&published=eq.true', config.supabaseUrl);
  const response = await fetch(api, { headers }); assert.equal(response.status, 200);
  const products = await response.json();
  const sitemapSlugs = urls.filter(u=>new URL(u).pathname.startsWith('/item/')).map(u=>new URL(u).pathname.split('/')[2]);
  assert.deepEqual(sitemapSlugs.sort(), products.map(p=>p.slug).sort(), 'published catalog vs sitemap');
  if (!base) {
    const dirs = await readdir(`${root}/item`, { withFileTypes: true });
    assert.deepEqual(dirs.filter(d=>d.isDirectory()).map(d=>d.name).sort(), sitemapSlugs.sort(), 'artifact contains only published item documents');
  }
}
const robots = await get('/robots.txt');
assert.match(robots, /User-agent:\s*\*/i);
assert.match(robots, /Sitemap: https:\/\/milana-pechet\.ru\/sitemap\.xml/);
assert.ok(!/^Disallow:\s*\/$/m.test(robots));
console.log(`PASS SEO: ${urls.length} public HTML documents, unique titles/descriptions, canonical, index/noindex, sitemap, robots${process.env.CHECK_CATALOG === '1' ? ', published API catalog parity' : ''}`);
