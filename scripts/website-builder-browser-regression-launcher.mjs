import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASS_MARKER = '[website-builder-browser-regression] PASS 16 desktop browser scenarios';
const FAIL_MARKER = '[website-builder-browser-regression] FAIL';
const HARD_TIMEOUT_MS = 70_000;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const regressionScript = path.join(scriptDir, 'website-builder-browser-regression.mjs');
const detached = process.platform !== 'win32';

const child = spawn(process.execPath, [regressionScript], {
  cwd: process.cwd(),
  env: process.env,
  detached,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let settled = false;
let stdoutTail = '';
let hardTimeout;

function signalTree(signal) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    if (signal === 'SIGKILL') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      return;
    }
    try { child.kill(signal); } catch { /* already stopped */ }
    return;
  }

  try { process.kill(-child.pid, signal); }
  catch {
    try { child.kill(signal); } catch { /* already stopped */ }
  }
}

function finish(exitCode, reason) {
  if (settled) return;
  settled = true;
  clearTimeout(hardTimeout);
  if (reason) console.log(`[browser-launcher] ${reason}`);
  signalTree('SIGTERM');
  setTimeout(() => {
    signalTree('SIGKILL');
    process.exit(exitCode);
  }, 250);
}

child.stdout.on('data', (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);
  stdoutTail = `${stdoutTail}${text}`.slice(-8192);
  if (stdoutTail.includes(PASS_MARKER)) finish(0, 'PASS and process tree cleaned');
  else if (stdoutTail.includes(FAIL_MARKER)) finish(1, 'FAIL and process tree cleaned');
});

child.stderr.on('data', (chunk) => process.stderr.write(chunk));

child.on('error', (error) => {
  console.error(`[browser-launcher] Failed to start browser regression: ${error.message}`);
  finish(1);
});

child.on('exit', (code, signal) => {
  if (settled) return;
  if (code === 0 && stdoutTail.includes(PASS_MARKER)) finish(0, 'PASS');
  else {
    console.error(`[browser-launcher] Browser regression exited before PASS (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`);
    finish(code === 0 ? 1 : (code ?? 1));
  }
});

hardTimeout = setTimeout(() => {
  console.error(`[browser-launcher] Browser regression exceeded ${HARD_TIMEOUT_MS / 1000}s.`);
  finish(1);
}, HARD_TIMEOUT_MS);
