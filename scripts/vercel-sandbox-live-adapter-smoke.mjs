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
try {
  await build({
    entryPoints: [
      'server/isolated-code-execution.ts',
      'server/vercel-sandbox-execution-adapter.ts',
    ],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: directory,
    entryNames: '[name].cjs',
  });

  const boundaryModule = (await import(pathToFileURL(join(directory, 'isolated-code-execution.cjs')))).default;
  const adapterModule = (await import(pathToFileURL(join(directory, 'vercel-sandbox-execution-adapter.cjs')))).default;
  const fetcher = async (input, init) => {
    const response = await fetch(input, init);
    if (!response.ok && providerStatus === undefined) providerStatus = response.status;
    return response;
  };
  const adapter = adapterModule.createVercelSandboxExecutionAdapter({
    token,
    fetcher,
    ...(process.env.VERCEL_TEAM_ID ? { teamId: process.env.VERCEL_TEAM_ID } : {}),
  });
  const result = await boundaryModule.runIsolatedCustomCode({
    source: 'return { ok: input.marker === "tayar-adapter-smoke", result: input.value + 1 };',
    input: { marker: 'tayar-adapter-smoke', value: 42 },
    timeoutMs: 10_000,
  }, adapter);

  assert.deepEqual(result, { ok: true, result: 43 });
  console.log('Live Vercel Sandbox adapter smoke passed; one-shot sandbox cleanup completed.');
} catch (error) {
  const safeCode = error?.code && /^[a-z0-9-]{1,48}$/.test(error.code)
    ? error.code
    : Number.isInteger(providerStatus) && providerStatus >= 100 && providerStatus <= 599
      ? `provider-http-${providerStatus}`
      : 'live-provider-smoke-failed';
  console.error(`Live Vercel Sandbox adapter smoke failed (${safeCode}). Provider details were suppressed.`);
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
