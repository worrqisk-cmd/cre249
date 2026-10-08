import { createHandler } from './worker.ts';

const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server setting: ${name}`);
  return value;
};
Deno.serve(
  createHandler({
    supabaseUrl: required('SUPABASE_URL'),
    serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    githubToken: required('CATALOG_GITHUB_TOKEN'),
    webhookSecret: required('CATALOG_WEBHOOK_SECRET'),
  }),
);
