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
  'EXPO_PUBLIC_WEB_URL',
];

const environments = ['production', 'preview', 'development'];

function setVar(environment, name, value, visibility = 'plaintext') {
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
      visibility,
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

// Sentry source-map upload runs during the EAS build and fails it without a token.
// Push the token as a secret when we have one; otherwise turn the upload off.
for (const environment of environments) {
  const set = env.SENTRY_AUTH_TOKEN
    ? setVar(environment, 'SENTRY_AUTH_TOKEN', env.SENTRY_AUTH_TOKEN, 'secret')
    : setVar(environment, 'SENTRY_DISABLE_AUTO_UPLOAD', 'true');
  if (!set) ok = false;
}

process.exit(ok ? 0 : 1);
