import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
const script = resolve('scripts/prepare-static.mjs');
const directory = await mkdtemp(join(tmpdir(), 'milana-empty-catalog-'));
let truncated = false;
const server = createServer((req, res) => {
  const table = new URL(req.url, 'http://localhost').pathname.split('/').at(-1);
  if (table === 'site_settings') {
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ id: true, city: 'Москва' }));
  } else {
    res
      .writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Range': truncated ? '0-0/1' : '*/0',
      })
      .end('[]');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const execute = () =>
  new Promise((resolve) => {
    const process = spawn(globalThis.process.execPath, [script], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    process.stdout.on('data', (data) => (output += data));
    process.stderr.on('data', (data) => (output += data));
    process.on('exit', (code) => resolve({ code, output }));
  });
try {
  await mkdir(join(directory, 'public'), { recursive: true });
  await mkdir(join(directory, 'src/app'), { recursive: true });
  await writeFile(
    join(directory, 'public/site-config.json'),
    JSON.stringify({
      supabaseUrl: `http://127.0.0.1:${server.address().port}`,
      supabasePublishableKey: 'local-fixture',
    }),
  );
  const empty = await execute();
  assert.equal(empty.code, 0, empty.output);
  assert.deepEqual(JSON.parse(await readFile(join(directory, '.static-paths.json'), 'utf8')), [
    '/',
    '/catalog/',
  ]);
  truncated = true;
  const partial = await execute();
  assert.notEqual(partial.code, 0);
  assert.match(partial.output, /Truncated static catalog/);
  console.log('PASS: genuine empty public catalog accepted; incomplete API response rejected');
} finally {
  server.close();
  await rm(directory, { recursive: true, force: true });
}
