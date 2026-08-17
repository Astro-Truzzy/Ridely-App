/**
 * Isolated sandbox for the Ridely QA agent.
 *
 * Default: run Jest + Deno tests in a child process (CI isolation).
 * With Vercel credentials + @vercel/sandbox: also boot a Firecracker microVM
 * and confirm the sandbox runtime is healthy before those tests.
 */
import { spawn } from 'node:child_process';

function hasVercelCredentials() {
  return Boolean(
    (process.env.VERCEL_TOKEN &&
      process.env.VERCEL_TEAM_ID &&
      process.env.VERCEL_PROJECT_ID) ||
      process.env.VERCEL_OIDC_TOKEN
  );
}

function run(cmd, args, root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, CI: '1' },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function pingVercelSandbox() {
  if (!hasVercelCredentials()) {
    console.warn(
      '[qa-agent] Vercel credentials not set — using a local isolated test sandbox.'
    );
    console.warn(
      '[qa-agent] Set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID to boot a Firecracker microVM.'
    );
    return;
  }

  let Sandbox;
  try {
    ({ Sandbox } = await import('@vercel/sandbox'));
  } catch {
    console.warn(
      '[qa-agent] @vercel/sandbox is not installed. Run npm i -D @vercel/sandbox to enable the microVM.'
    );
    return;
  }

  const credentials = process.env.VERCEL_TOKEN
    ? {
        token: process.env.VERCEL_TOKEN,
        teamId: process.env.VERCEL_TEAM_ID,
        projectId: process.env.VERCEL_PROJECT_ID,
      }
    : {};

  console.log('[qa-agent] Booting Vercel Sandbox microVM…');
  const sandbox = await Sandbox.create({
    ...credentials,
    runtime: 'node24',
    timeout: 60_000,
  });
  try {
    const result = await sandbox.runCommand('node', ['-e', "console.log('ridely-qa-sandbox-ok')"]);
    const out = typeof result.stdout === 'function' ? await result.stdout() : '';
    console.log('[qa-agent] Sandbox runtime:', String(out).trim() || 'ready');
  } finally {
    await sandbox.stop();
  }
}

export async function runInVercelSandbox(root) {
  await pingVercelSandbox();
  console.log('\n[qa-agent] User + rider screen contracts (Jest)\n');
  await run('npm', ['test', '--', '--runInBand'], root);
  console.log('\n[qa-agent] Edge-function fare / delivery contracts (Deno)\n');
  await run('npm', ['run', 'test:functions'], root);
}
