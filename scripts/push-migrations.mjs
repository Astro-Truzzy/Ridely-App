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

const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const runEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
const projectRef = 'ihvuufwbbuiafmxzkdui';

console.log('Linking project...');
let r = spawnSync(
  'npx',
  ['supabase', 'link', '--project-ref', projectRef],
  { env: runEnv, shell: true, stdio: 'inherit' }
);
if (r.status !== 0) {
  console.error('link failed', r.status);
  process.exit(r.status ?? 1);
}

console.log('Pushing migrations...');
r = spawnSync('npx', ['supabase', 'db', 'push', '--yes'], {
  env: runEnv,
  shell: true,
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
