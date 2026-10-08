import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const container = process.env.CATALOG_SYNC_TEST_CONTAINER || 'milana-catalog-sync-test';
const migration = await readFile(
  'supabase/migrations/20261008120000_catalog_static_sync.sql',
  'utf8',
);
const wakeup = (
  await readFile('supabase/migrations/20261008121000_catalog_static_sync_wakeup.sql', 'utf8')
).replace(/^create extension.*;$/gm, '');
const test = (await readFile('tests/catalog-sync.sql', 'utf8'))
  .replace('\\i supabase/migrations/20261008120000_catalog_static_sync.sql', () => migration)
  .replace('-- WAKEUP_MIGRATION', () => wakeup);
// Только одноразовый локальный PostgreSQL; сетевые credentials проекта не используются.
const result = spawnSync(
  'docker',
  ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input: test, encoding: 'utf8' },
);
if (result.status !== 0)
  throw new Error(result.stderr || result.error?.message || 'Local SQL test failed');
console.log(
  'PASS SQL queue: public filtering, hide/delete, debounce, duplicate claim, late events, stale acknowledgment, retry, privileges',
);
