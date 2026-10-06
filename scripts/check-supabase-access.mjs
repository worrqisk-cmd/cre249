import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const config = JSON.parse(await readFile('public/site-config.json', 'utf8'));
assert.equal(new URL(config.supabaseUrl).hostname, 'bvlcyhcuneaphuletnqz.supabase.co');
async function signIn(email, password) {
  const authClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error('Could not create test session');
  return data.session.access_token;
}
const ownerToken = process.env.OWNER_ACCESS_TOKEN ||
  (process.env.SUPABASE_ADMIN_PASSWORD ? await signIn(config.adminEmail, process.env.SUPABASE_ADMIN_PASSWORD) : null);
const otherToken = process.env.OTHER_ACCESS_TOKEN ||
  (process.env.OTHER_TEST_EMAIL && process.env.OTHER_TEST_PASSWORD
    ? await signIn(process.env.OTHER_TEST_EMAIL, process.env.OTHER_TEST_PASSWORD) : null);
if (!ownerToken || !otherToken) throw new Error('Provide two real Auth sessions: OWNER_ACCESS_TOKEN and OTHER_ACCESS_TOKEN, or owner and other test passwords in process environment.');
const client = token => createClient(config.supabaseUrl, config.supabasePublishableKey, {
  global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = client();
const owner = client(ownerToken);
const other = client(otherToken);
const [{ data: ownerUser, error: ownerError }, { data: otherUser, error: otherError }] = await Promise.all([
  owner.auth.getUser(ownerToken), other.auth.getUser(otherToken),
]);
assert.ifError(ownerError);assert.ifError(otherError);
assert.equal(ownerUser.user?.id, config.adminUserId);
assert.notEqual(otherUser.user?.id, config.adminUserId);

async function hiddenCount(who) {
  const result = await who.from('products').select('id').eq('slug', 'pechenochny');
  assert.ifError(result.error);
  return result.data.length;
}
assert.equal(await hiddenCount(anon), 0);
assert.equal(await hiddenCount(other), 0);
assert.equal(await hiddenCount(owner), 1);

const id = randomUUID();
const slug = `policy-check-${id.slice(0, 8)}`;
const path = `products/${id}/policy-check.png`;
const row = { id, slug, title: 'Проверка прав', category_id: 'cakes', published: false };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lJkAAAAASUVORK5CYII=', 'base64');
let inserted = false;
let uploaded = false;
try {
  for (const who of [anon, other]) {
    const result = await who.from('products').insert(row);
    assert.ok(result.error, 'non-owner insert denied');
  }
  const created = await owner.from('products').insert(row).select('id').single();
  assert.ifError(created.error);inserted = true;
  for (const who of [anon, other]) {
    const changed = await who.from('products').update({ title: 'Чужое изменение' }).eq('id', id).select('id');
    assert.ok(changed.error || changed.data.length === 0, 'non-owner update denied');
    const deleted = await who.from('products').delete().eq('id', id).select('id');
    assert.ok(deleted.error || deleted.data.length === 0, 'non-owner delete denied');
    const upload = await who.storage.from('milana-catalog').upload(path, png, { contentType: 'image/png' });
    assert.ok(upload.error, 'non-owner Storage upload denied');
  }
  const upload = await owner.storage.from('milana-catalog').upload(path, png, { contentType: 'image/png' });
  assert.ifError(upload.error);uploaded = true;
  const updated = await owner.from('products').update({ published: true, photos: [{ path, desktop: '50% 50%', mobile: '50% 50%' }] }).eq('id', id).select('id').single();
  assert.ifError(updated.error);
  const publicPhoto = await anon.storage.from('milana-catalog').createSignedUrl(path, 60);
  assert.ifError(publicPhoto.error);
  for (const who of [anon, other]) {
    const replaced = await who.storage.from('milana-catalog').update(path, png, { contentType: 'image/png', upsert: true });
    assert.ok(replaced.error, 'non-owner Storage replace denied');
    const removed = await who.storage.from('milana-catalog').remove([path]);
    assert.ok(removed.error || !removed.data?.length, 'non-owner Storage delete denied');
    const stillThere = await owner.storage.from('milana-catalog').download(path);
    assert.ifError(stillThere.error);
  }
  const hidden = await owner.from('products').update({ published: false }).eq('id', id).select('id').single();
  assert.ifError(hidden.error);
  assert.equal((await anon.from('products').select('id').eq('id', id)).data.length, 0);
  const hiddenPhoto = await anon.storage.from('milana-catalog').createSignedUrl(path, 60);
  assert.ok(hiddenPhoto.error, 'hidden photo cannot receive a new signed URL');
  const replace = await owner.storage.from('milana-catalog').update(path, png, { contentType: 'image/png', upsert: true });
  assert.ifError(replace.error);
  console.log('Live API checks passed: anon, owner and other user; hidden reads, product writes and Storage.');
} finally {
  if (uploaded) await owner.storage.from('milana-catalog').remove([path]);
  if (inserted) await owner.from('products').delete().eq('id', id);
}
