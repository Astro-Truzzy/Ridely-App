import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

// Only client-safe EXPO_PUBLIC_* values — never push Paystack secret / access tokens
const names = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY',
  'EXPO_PUBLIC_OAUTH_GOOGLE_ENABLED',
  'EXPO_PUBLIC_LIVEKIT_URL',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY',
  'EXPO_PUBLIC_PAYSTACK_TEST_MODE',
];

const environments = ['production', 'preview', 'development'];

function setVar(environment, name, value) {
  if (!value) {
    console.log(`skip ${environment}/${name} (empty)`);
    return true;
  }
  console.log(`set ${environment}/${name}`);
  const r = spawnSync(
    'npx',
    [
      'eas-cli@latest',
      'env:create',
      '--environment',
      environment,
      '--name',
      name,
      '--value',
      value,
      '--visibility',
      'plaintext',
      '--type',
      'string',
      '--force',
      '--non-interactive',
    ],
    { shell: true, stdio: 'inherit', env: process.env }
  );
  return (r.status ?? 1) === 0;
}

let ok = true;
for (const environment of environments) {
  for (const name of names) {
    if (!setVar(environment, name, env[name])) {
      ok = false;
    }
  }
}

process.exit(ok ? 0 : 1);
