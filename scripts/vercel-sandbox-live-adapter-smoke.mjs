import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const token = process.env.VERCEL_TOKEN;
if (typeof token !== 'string' || !token.trim()) {
  console.log('Skipped: set VERCEL_TOKEN in the process environment to run the live provider smoke.');
  process.exit(0);
}

const directory = await mkdtemp(join(tmpdir(), 'tayar-vercel-live-smoke-'));
let providerStatus;
let providerErrorCode;
let providerPhase = 'not-started';
let smokePhase = 'prepare';
let providerFetchError = false;
try {
  smokePhase = 'build';
  await build({
    entryPoints: [
      'server/isolated-code-execution.ts',
      'server/vercel-sandbox-execution-adapter.ts',
    ],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: directory,
    entryNames: '[name]',
    outExtension: { '.js': '.cjs' },
  });

  smokePhase = 'load-adapter';
  const boundaryModule = (await import(pathToFileURL(join(directory, 'isolated-code-execution.cjs')))).default;
  const adapterModule = (await import(pathToFileURL(join(directory, 'vercel-sandbox-execution-adapter.cjs')))).default;
  const fetcher = async (input, init) => {
    const url = new URL(String(input));
    providerPhase = url.pathname === '/v2/sandboxes' ? 'create-sandbox'
      : url.pathname.endsWith('/logs') ? 'read-logs'
        : url.pathname.endsWith('/stop') ? 'stop-sandbox'
          : url.pathname.includes('/cmd') ? 'run-command' : 'provider-request';
    try {
      const response = await fetch(input, init);
      providerStatus = response.status;
      if (!response.ok) {
        try {
          const body = await response.clone().json();
          const code = body?.error?.code ?? body?.code;
          if (typeof code === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(code)) {
            providerErrorCode = code.toLowerCase().replaceAll('_', '-');
          }
        } catch {
          // Keep provider response bodies private and ignore non-JSON error responses.
        }
      }
      return response;
    } catch {
      providerFetchError = true;
      throw new Error('Vercel Sandbox transport failed.');
    }
  };
  const adapter = adapterModule.createVercelSandboxExecutionAdapter({
    token,
    projectId: process.env.VERCEL_PROJECT_ID,
    fetcher,
    ...(process.env.VERCEL_TEAM_ID ? { teamId: process.env.VERCEL_TEAM_ID } : {}),
  });
  smokePhase = 'execute';
  const result = await boundaryModule.runIsolatedCustomCode({
    source: 'return { ok: input.marker === "tayar-adapter-smoke", result: input.value + 1 };',
    input: { marker: 'tayar-adapter-smoke', value: 42 },
    timeoutMs: 10_000,
  }, adapter);

  smokePhase = 'verify-result';
  assert.deepEqual(result, { ok: true, result: 43 });
  console.log('Live Vercel Sandbox adapter smoke passed; one-shot sandbox cleanup completed.');
} catch (error) {
  const providerCode = providerFetchError
    ? `provider-transport-${providerPhase}`
    : Number.isInteger(providerStatus) && providerStatus >= 100 && providerStatus <= 599
      ? `provider-${providerPhase}-http-${providerStatus}${providerErrorCode ? `-${providerErrorCode}` : ''}`
      : providerPhase !== 'not-started' ? `provider-${providerPhase}-no-response` : null;
  const safeCode = providerCode
    || (error?.code && /^[a-z0-9-]{1,96}$/.test(error.code) ? error.code : `smoke-${smokePhase}-failed`);
  console.error(`Live Vercel Sandbox adapter smoke failed (${safeCode}). Provider details were suppressed.`);
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
