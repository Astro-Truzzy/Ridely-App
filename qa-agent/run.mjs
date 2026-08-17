#!/usr/bin/env node
/**
 * Ridely QA agent
 *
 * Runs user + rider core-functionality tests in an isolated sandbox when
 * Vercel credentials are present, otherwise locally.
 *
 *   npm run qa:agent
 *   npm run qa:agent -- --sandbox
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInVercelSandbox } from './sandbox.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const useSandbox = process.argv.includes('--sandbox');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function runLocalSuite() {
  console.log('\n[qa-agent] User + rider screen contracts (Jest)\n');
  await run('npm', ['test', '--', '--runInBand']);
  console.log('\n[qa-agent] Edge-function fare / delivery contracts (Deno)\n');
  await run('npm', ['run', 'test:functions']);
}

async function main() {
  console.log('Ridely QA agent — user & rider core functionality');
  if (useSandbox) {
    console.log('Mode: Vercel Sandbox (isolated microVM)');
    await runInVercelSandbox(root);
    return;
  }
  console.log('Mode: local sandbox (isolated test process)');
  await runLocalSuite();
  console.log('\n[qa-agent] All core-functionality checks passed.');
}

main().catch((err) => {
  console.error('\n[qa-agent] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
