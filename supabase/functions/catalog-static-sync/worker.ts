export interface Config {
  supabaseUrl: string;
  serviceKey: string;
  githubToken: string;
  webhookSecret: string;
}

type Claim = {
  action: 'idle' | 'dispatch' | 'poll';
  attempt?: string;
  revision?: string;
  run_id?: string;
};

export function createHandler(config: Config, request: typeof fetch = fetch) {
  const rpc = async (name: string, body: Record<string, unknown> = {}) => {
    const response = await request(`${config.supabaseUrl}/rest/v1/rpc/catalog_sync_${name}`, {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Queue ${name}: HTTP ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  const github = async (path: string, body?: unknown) => {
    const response = await request(
      `https://api.github.com/repos/worrqisk-cmd/cre249/actions/${path}`,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`);
    if (response.status === 204)
      throw new Error('GitHub dispatch has no run ID; retry after lease');
    return await response.json();
  };
  return async (incoming: Request): Promise<Response> => {
    if (incoming.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const provided = incoming.headers.get('x-catalog-sync-secret') || '';
    // Сравнение хешей одинаковой длины не раскрывает позицию отличающегося символа.
    const hash = async (value: string) =>
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [actual, expected] = await Promise.all([hash(provided), hash(config.webhookSecret)]);
    if (
      config.webhookSecret.length < 32 ||
      actual.reduce((difference, byte, index) => difference | (byte ^ expected[index]), 0)
    ) {
      return new Response('Unauthorized', { status: 401 });
    }
    let claim: Claim | undefined;
    try {
      claim = await rpc('claim');
      if (claim?.action === 'dispatch') {
        const run = await github('workflows/pages.yml/dispatches', {
          ref: 'main',
          inputs: { catalog_sync_attempt: claim.attempt, catalog_sync_revision: claim.revision },
        });
        if (!run.workflow_run_id) throw new Error('GitHub dispatch missing run ID');
        await rpc('attach', { p_attempt: claim.attempt, p_run_id: String(run.workflow_run_id) });
      } else if (claim?.action === 'poll') {
        const run = await github(`runs/${encodeURIComponent(claim.run_id!)}`);
        if (run.status === 'completed') {
          const jobs =
            run.conclusion === 'success'
              ? await github(`runs/${encodeURIComponent(claim.run_id!)}/jobs?per_page=100`)
              : { jobs: [] };
          // Успех build без успешного deploy не подтверждает обновление опубликованных страниц.
          const deployed =
            run.conclusion === 'success' &&
            jobs.jobs.some(
              (job: { name: string; conclusion: string }) =>
                job.name === 'deploy' && job.conclusion === 'success',
            );
          await rpc('finish', {
            p_attempt: claim.attempt,
            p_success: deployed,
            p_error: deployed ? null : `Workflow ${run.conclusion}; deploy not successful`,
          });
        }
      }
      return Response.json({ action: claim?.action || 'idle' });
    } catch (error) {
      const message =
        error instanceof Error && /^(Queue |GitHub|Workflow)/.test(error.message)
          ? error.message
          : 'Worker request failed';
      console.error('catalog-static-sync', {
        action: claim?.action,
        attempt: claim?.attempt,
        error: message,
      });
      if (claim?.attempt) {
        try {
          const definitiveDispatchFailure =
            claim.action === 'dispatch' && /^GitHub: HTTP (4|5)/.test(message);
          const missingRun = claim.action === 'poll' && message === 'GitHub: HTTP 404';
          if (definitiveDispatchFailure || missingRun) {
            await rpc('finish', { p_attempt: claim.attempt, p_success: false, p_error: message });
          } else {
            await rpc('error', { p_attempt: claim.attempt, p_error: message });
          }
        } catch {
          console.error('catalog-static-sync: unable to persist error; lease/Cron will retry');
        }
      }
      // При неоднозначном dispatch (таймаут/потеря attach) аренда даст повтор без потери события.
      // При poll сохраняем run_id: временная ошибка API не запускает параллельную сборку.
      return Response.json({ error: message }, { status: 503 });
    }
  };
}
