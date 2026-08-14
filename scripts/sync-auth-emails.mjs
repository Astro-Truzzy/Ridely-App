import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectRef = 'ihvuufwbbuiafmxzkdui';
const redirectUrl = `https://${projectRef}.supabase.co/functions/v1/auth-redirect`;

function parseEnv(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = parseEnv(readFileSync(join(root, '.env'), 'utf8'));
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const confirmation = readFileSync(
  join(root, 'supabase/email-templates/confirmation.html'),
  'utf8'
);
const recovery = readFileSync(join(root, 'supabase/email-templates/recovery.html'), 'utf8');

const extraRedirects = [
  redirectUrl,
  `${redirectUrl}?next=callback`,
  `${redirectUrl}?next=reset-password`,
  'Ridely://callback',
  'Ridely://reset-password',
  'Ridely://auth/callback',
  'ridely://callback',
  'ridely://reset-password',
  'exp+ridely://**',
];

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const currentRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  headers,
});
if (!currentRes.ok) {
  console.error('Failed to read auth config', currentRes.status, await currentRes.text());
  process.exit(1);
}

const current = await currentRes.json();
const existing = String(current.uri_allow_list || current.URI_ALLOW_LIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const uriAllowList = [...new Set([...existing, ...extraRedirects])].join(',');

const patchRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    uri_allow_list: uriAllowList,
    mailer_subjects_confirmation: 'Confirm your Ridely account',
    mailer_templates_confirmation_content: confirmation,
    mailer_subjects_recovery: 'Reset your Ridely password',
    mailer_templates_recovery_content: recovery,
  }),
});

if (!patchRes.ok) {
  console.error('Failed to update auth config', patchRes.status, await patchRes.text());
  process.exit(1);
}

console.log('Updated confirmation and recovery email templates.');
console.log('Allow-listed auth-redirect and Ridely deep links.');
