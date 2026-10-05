import { readFile, writeFile } from 'node:fs/promises';

async function readEnv(path) {
  try {
    return Object.fromEntries((await readFile(path, 'utf8')).split(/\r?\n/)
      .filter(line => line && !line.trimStart().startsWith('#'))
      .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; })
      .filter(([key]) => key));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

const defaults = await readEnv('.env.example');
const local = await readEnv('.env.local');
const value = key => process.env[key] || local[key] || defaults[key];
const config = {
  supabaseUrl: value('SUPABASE_URL'),
  supabasePublishableKey: value('SUPABASE_PUBLISHABLE_KEY'),
  adminUserId: value('ADMIN_USER_ID'),
  adminLogin: value('ADMIN_LOGIN'),
  adminEmail: value('ADMIN_EMAIL'),
};
if (new URL(config.supabaseUrl).hostname !== 'bvlcyhcuneaphuletnqz.supabase.co') {
  throw new Error('SUPABASE_URL must point to project bvlcyhcuneaphuletnqz');
}
if (!config.supabasePublishableKey?.startsWith('sb_publishable_') || !config.adminUserId || !config.adminLogin || !config.adminEmail) {
  throw new Error('Incomplete public Supabase configuration');
}
await writeFile('public/site-config.json', JSON.stringify(config, null, 2) + '\n');
console.log('Generated public/site-config.json for bvlcyhcuneaphuletnqz');
