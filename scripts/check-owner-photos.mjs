import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const config = JSON.parse(await readFile('public/site-config.json', 'utf8'));
assert.equal(new URL(config.supabaseUrl).hostname, 'bvlcyhcuneaphuletnqz.supabase.co');
const password = process.env.SUPABASE_ADMIN_PASSWORD;
if (!password) throw new Error('Enter the owner password in a temporary process environment.');
const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: auth, error: authError } = await client.auth.signInWithPassword({ email: config.adminEmail, password });
assert.ifError(authError);
assert.equal(auth.user?.id, config.adminUserId);

try {
  const { data: drafts, error } = await client.from('products').select('slug,photos').eq('published', false);
  assert.ifError(error);
  assert.equal(drafts.length, 18);
  let photos = 0;
  for (const draft of drafts) {
    assert.ok(draft.photos.length, `Missing photos for ${draft.slug}`);
    for (const photo of draft.photos) {
      assert.ok(photo.path, `Draft photo must be in private Storage: ${draft.slug}`);
      const { data, error: signError } = await client.storage.from('milana-catalog').createSignedUrl(photo.path, 60);
      assert.ifError(signError);
      const response = await fetch(data.signedUrl);
      assert.equal(response.ok, true, `Owner cannot fetch ${draft.slug} photo`);
      assert.match(response.headers.get('content-type') || '', /^image\//);
      photos++;
    }
  }
  console.log(`Owner can open ${photos} private photos in ${drafts.length} hidden drafts.`);
} finally {
  await client.auth.signOut();
}
