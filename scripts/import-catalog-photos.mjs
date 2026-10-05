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
} finally {
  await client.auth.signOut();
}
