import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const password = process.env.SUPABASE_ADMIN_PASSWORD;
if (!password) throw new Error('Set SUPABASE_ADMIN_PASSWORD only for this command; do not put it in the repo.');
const config = JSON.parse(await readFile('public/site-config.json', 'utf8'));
if (new URL(config.supabaseUrl).hostname !== 'bvlcyhcuneaphuletnqz.supabase.co') throw new Error('Unexpected Supabase project');
const client = createClient(config.supabaseUrl, config.supabasePublishableKey);
const { data: session, error: authError } = await client.auth.signInWithPassword({ email: config.adminEmail, password });
if (authError || session.user?.id !== config.adminUserId) throw new Error('Owner sign-in failed');

try {
  const { data: rows, error } = await client.from('products').select('id,slug,photos,created_at,updated_at');
  if (error) throw error;
  for (const row of rows) {
    if (row.created_at !== row.updated_at || row.photos?.length !== 1 || !row.photos[0].static) continue;
    const photo = row.photos[0];
    const file = photo.static.split('/').at(-1);
    if (!/^\d{2}_[a-z0-9_]+\.jpg$/.test(file)) continue;
    const path = `products/${row.id}/import-${file}`;
    const bytes = await readFile(`public/photos/${file}`);
    const uploaded = await client.storage.from('milana-catalog').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (uploaded.error && uploaded.error.statusCode !== '409') throw uploaded.error;
    const updated = await client.from('products').update({ photos: [{ path, desktop: photo.desktop, mobile: photo.mobile }] })
      .eq('id', row.id).eq('updated_at', row.updated_at).select('id').maybeSingle();
    if (updated.error || !updated.data) {
      if (!uploaded.error) await client.storage.from('milana-catalog').remove([path]);
      throw updated.error || new Error(`Product changed during import: ${row.slug}`);
    }
    console.log(`Imported photo for ${row.slug}`);
  }

  const selection = JSON.parse(await readFile('guidelines/archive-selection.json', 'utf8'));
  const privateSelections = [
    ...selection.drafts,
    ...selection.existing.filter(item => item.slug === 'pechenochny'),
  ];
  for (const item of privateSelections) {
    const { data: row, error: rowError } = await client.from('products')
      .select('id,slug,photos,updated_at,published').eq('slug', item.slug).single();
    if (rowError || !row || row.published) throw rowError || new Error(`Expected hidden draft: ${item.slug}`);
    const photos = [...row.photos];
    const uploadedNow = [];
    try {
      for (const number of item.photos) {
        const filename = `archive_${String(number).padStart(3, '0')}_${item.slug}.jpg`;
        const path = `products/${row.id}/${filename}`;
        if (photos.some(photo => photo.path === path)) continue;
        const bytes = await readFile(`catalog-assets/drafts/${filename}`);
        const result = await client.storage.from('milana-catalog').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (result.error && result.error.statusCode !== '409') throw result.error;
        if (!result.error) uploadedNow.push(path);
        photos.push({ path, desktop: '50% 50%', mobile: '50% 50%' });
      }
      if (photos.length === row.photos.length) continue;
      const saved = await client.from('products').update({ photos })
        .eq('id', row.id).eq('updated_at', row.updated_at).select('id').maybeSingle();
      if (saved.error || !saved.data) throw saved.error || new Error(`Product changed during import: ${item.slug}`);
      console.log(`Imported ${photos.length - row.photos.length} archive photos for ${item.slug}`);
    } catch (error) {
      if (uploadedNow.length) await client.storage.from('milana-catalog').remove(uploadedNow);
      throw error;
    }
  }
} finally {
  await client.auth.signOut();
}
