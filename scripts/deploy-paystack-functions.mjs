/**
 * Deploy payment-related edge functions and sync PAYSTACK_SECRET_KEY from .env.
 * Usage: node scripts/deploy-paystack-functions.mjs
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

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

const env = parseEnv(readFileSync(envPath, 'utf8'));
const projectRef = 'ihvuufwbbuiafmxzkdui';
const token = env.SUPABASE_ACCESS_TOKEN;
const paystackSecret = env.PAYSTACK_SECRET_KEY?.trim();

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env');
  process.exit(1);
}

const runEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: token };

if (paystackSecret) {
  console.log('Setting PAYSTACK_SECRET_KEY secret (value hidden)...');
  const setResult = spawnSync(
    'npx',
    ['supabase', 'secrets', 'set', `PAYSTACK_SECRET_KEY=${paystackSecret}`, '--project-ref', projectRef],
    { cwd: root, env: runEnv, shell: true, stdio: 'inherit' }
  );
  if (setResult.status !== 0) {
    console.error('Failed to set PAYSTACK_SECRET_KEY');
    process.exit(setResult.status ?? 1);
  }
} else {
  console.warn('PAYSTACK_SECRET_KEY not found in .env — skipping secret sync');
}

const functions = [
  'paystack-initialize',
  'paystack-verify',
  'paystack-callback',
  'paystack-charge',
  'paystack-banks',
  'paystack-webhook',
  'create-delivery',
];

for (const fn of functions) {
  console.log(`Deploying ${fn} (verify_jwt=false via config.toml)...`);
  const deployResult = spawnSync(
    'npx',
    ['supabase', 'functions', 'deploy', fn, '--project-ref', projectRef, '--no-verify-jwt'],
    { cwd: root, env: runEnv, shell: true, stdio: 'inherit' }
  );
  if (deployResult.status !== 0) {
    console.error(`Failed to deploy ${fn}`);
    process.exit(deployResult.status ?? 1);
  }
}

console.log('Functions deployed. Testing paystack-initialize rejects anon (expects 401)...');

const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const url = `https://${projectRef}.supabase.co/functions/v1/paystack-initialize`;
const testRes = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  },
  body: JSON.stringify({
    email: 'test@ridely.app',
    amount_in_kobo: 10000,
    callback_url: `https://${projectRef}.supabase.co/functions/v1/paystack-callback`,
    channels: ['card'],
  }),
});

const testBody = await testRes.text();
console.log('Test status:', testRes.status);
console.log('Test body:', testBody.slice(0, 500));

if (testRes.status === 401) {
  console.log('\nOK: unauthenticated initialize correctly rejected.');
} else if (testRes.status === 500 && testBody.includes('PAYSTACK_SECRET_KEY not set')) {
  console.error('\nSecret still not available to the function. Set PAYSTACK_SECRET_KEY in Supabase Dashboard.');
  process.exit(1);
} else {
  console.warn('\nExpected 401 for anon JWT. Check that paystack-initialize requires user auth.');
}

console.log('\nDone.');
