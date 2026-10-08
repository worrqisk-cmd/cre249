import { createHandler } from './worker.ts';
const secret = 'test-webhook-secret-at-least-32-characters';
const config = {
  supabaseUrl: 'https://local.invalid',
  serviceKey: 'server-only',
  githubToken: 'server-only',
  webhookSecret: secret,
};
const tick = () =>
  new Request('https://edge.invalid', {
    method: 'POST',
    headers: { 'x-catalog-sync-secret': secret },
  });
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};

Deno.test('rejects strangers before any database or GitHub request', async () => {
  let calls = 0;
  const handler = createHandler(config, (() => {
    calls++;
    throw new Error('unexpected request');
  }) as typeof fetch);
  assert(
    (await handler(new Request('https://edge.invalid', { method: 'POST' }))).status === 401,
    'must reject',
  );
  assert(calls === 0, 'unauthorized request reached backend');
});
Deno.test('dispatches main and records returned run ID', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const handler = createHandler(config, (async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body || '{}')) });
    if (String(url).endsWith('_claim'))
      return Response.json({ action: 'dispatch', attempt: 'a', revision: '9' });
    if (String(url).endsWith('/dispatches')) return Response.json({ workflow_run_id: 123 });
    return new Response(null, { status: 204 });
  }) as typeof fetch);
  assert((await handler(tick())).status === 200, 'dispatch failed');
  assert(calls[1].body.ref === 'main', 'wrong branch');
  assert(calls[2].body.p_run_id === '123', 'run ID not persisted');
});
for (const conclusion of ['failure', 'cancelled', 'success']) {
  Deno.test(`does not acknowledge ${conclusion} without successful deploy`, async () => {
    let finished: Record<string, unknown> | undefined;
    const handler = createHandler(config, (async (url, options) => {
      const path = String(url);
      if (path.endsWith('_claim'))
        return Response.json({ action: 'poll', attempt: 'a', run_id: '123' });
      if (path.includes('/jobs?'))
        return Response.json({ jobs: [{ name: 'deploy', conclusion: 'skipped' }] });
      if (path.endsWith('/runs/123')) return Response.json({ status: 'completed', conclusion });
      finished = JSON.parse(String(options?.body));
      return new Response(null, { status: 204 });
    }) as typeof fetch);
    assert((await handler(tick())).status === 200, 'poll failed');
    assert(finished?.p_success === false, 'acknowledged undeployed revision');
  });
}
Deno.test('poll API failure preserves active run for retry', async () => {
  let calls = 0;
  const handler = createHandler(config, (async () => {
    calls++;
    return calls === 1
      ? Response.json({ action: 'poll', attempt: 'a', run_id: '123' })
      : new Response('', { status: 503 });
  }) as typeof fetch);
  assert((await handler(tick())).status === 503, 'error lost');
  assert(calls === 3, 'error was not recorded');
});

Deno.test('successful deploy acknowledges the claimed revision', async () => {
  let finished: Record<string, unknown> | undefined;
  const handler = createHandler(config, (async (url, options) => {
    const path = String(url);
    if (path.endsWith('_claim'))
      return Response.json({ action: 'poll', attempt: 'a', run_id: '123' });
    if (path.includes('/jobs?'))
      return Response.json({ jobs: [{ name: 'deploy', conclusion: 'success' }] });
    if (path.endsWith('/runs/123'))
      return Response.json({ status: 'completed', conclusion: 'success' });
    finished = JSON.parse(String(options?.body));
    return new Response(null, { status: 204 });
  }) as typeof fetch);
  assert((await handler(tick())).status === 200, 'poll failed');
  assert(finished?.p_success === true, 'successful deployment not acknowledged');
});
Deno.test('dispatch rejection records failure for durable backoff', async () => {
  let failed: Record<string, unknown> | undefined;
  const handler = createHandler(config, (async (url, options) => {
    const path = String(url);
    if (path.endsWith('_claim'))
      return Response.json({ action: 'dispatch', attempt: 'a', revision: '9' });
    if (path.endsWith('/dispatches')) return new Response('', { status: 401 });
    failed = JSON.parse(String(options?.body));
    return new Response(null, { status: 204 });
  }) as typeof fetch);
  assert((await handler(tick())).status === 503, 'dispatch failure hidden');
  assert(
    failed?.p_success === false && failed?.p_error === 'GitHub: HTTP 401',
    'failure not persisted',
  );
});
