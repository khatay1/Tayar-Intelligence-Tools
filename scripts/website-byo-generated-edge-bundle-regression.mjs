import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Execute the actual generated Edge entry, not only its source modules.
// All integration boundaries are replaced with local fixtures, including
// Supabase, Deno.env and network fetch. No provider/production calls occur.
const dir = await mkdtemp(join(tmpdir(), 'tayar-edge-bundle-'));
const ownerId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const previewOperationId = '44444444-4444-4444-8444-444444444444';
const fakeSecret = 'sb_secret_' + 's'.repeat(36);
const vars = {
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: fakeSecret,
  WEBSITE_GITHUB_RETURN_URL: 'https://platform.example/builder',
  WEBSITE_SUPABASE_PLATFORM_ORGANIZATION_ID: 'fixture_supabase',
  TAYAR_PLATFORM_VERCEL_ACCOUNT_ID: 'team_fixture',
  WEBSITE_GITHUB_APP_CLIENT_ID: 'Iv1_fixture',
  WEBSITE_GITHUB_APP_CLIENT_SECRET: 'fixture-github-client-secret-value',
};
const previous = { Deno: globalThis.Deno, fixture: globalThis.__tayarEdgeRuntimeFixture,
  fetch: globalThis.fetch };
let handler;
let allowOwner = true;
const calls = { clients: 0, users: 0, ownerLookups: 0, rpc: 0, network: 0 };
const platform = {
  auth: {
    getUser: async bearer => {
      calls.users++;
      if (bearer !== 'header.payload.signature') throw Error('fixture rejects unexpected bearer');
      return { data: { user: { id: ownerId, is_anonymous: false } }, error: null };
    },
  },
  from: table => {
    assert.equal(table, 'projects');
    calls.ownerLookups++;
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      maybeSingle: async () => ({ data: allowOwner ? { id: projectId } : null, error: null }),
    };
    return query;
  },
  rpc: async () => { calls.rpc++; throw Error('Unexpected provider/database RPC'); },
};
try {
  const compiled = await build({
    entryPoints: ['supabase/functions/website-byo-publish/index.ts'],
    platform: 'node', format: 'cjs', target: 'es2022', bundle: true,
    write: false, logLevel: 'silent',
    plugins: [{
      name: 'mock-edge-supabase',
      setup(builder) {
        builder.onResolve({ filter: /^npm:@supabase\/supabase-js@/ }, () => ({
          path: 'fixture-supabase', namespace: 'edge-fixture',
        }));
        builder.onLoad({ filter: /^fixture-supabase$/, namespace: 'edge-fixture' }, () => ({
          contents: 'export const createClient = (...args) => globalThis.__tayarEdgeRuntimeFixture.createClient(...args);',
          loader: 'js',
        }));
      },
    }],
  });
  assert.equal(compiled.outputFiles.length, 1);
  const output = join(dir, 'edge-bundle.cjs');
  await writeFile(output, compiled.outputFiles[0].text);

  globalThis.__tayarEdgeRuntimeFixture = {
    createClient(url, key) {
      calls.clients++;
      assert.equal(url, vars.SUPABASE_URL);
      assert.equal(key, fakeSecret);
      return platform;
    },
  };
  globalThis.Deno = {
    env: { get: name => vars[name] },
    serve(value) {
      assert.equal(typeof value, 'function');
      if (handler) throw Error('Edge bundle attempted to start multiple listeners');
      handler = value;
      return { shutdown: async () => {} };
    },
  };
  globalThis.fetch = async () => {
    calls.network++;
    throw Error('Network unavailable in synthetic Edge test');
  };
  await import(pathToFileURL(output).href);
  assert.equal(calls.clients, 1, 'Edge cold start creates exactly one fake Supabase client');
  assert.equal(typeof handler, 'function');

  const request = (action, withBearer = true) => new Request(
    'https://edge.example/functions/v1/website-byo-publish', {
      method: 'POST',
      headers: {
        origin: 'https://platform.example',
        'content-type': 'application/json',
        ...(withBearer ? { authorization: 'Bearer header.payload.signature' } : {}),
      },
      body: JSON.stringify({ action, projectId, operationId, previewOperationId }),
    });

  let result = await handler(request('production'));
  assert.equal(result.status, 409, 'Actual generated Edge bundle must refuse Production');
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const body = await result.json();
  assert.equal(body.code, 'production-candidate-required');
  assert.equal(typeof body.error, 'string');
  assert.doesNotMatch(JSON.stringify(body), /sb_secret_|fixture-github-client-secret/);

  const acceptedLookups = calls.ownerLookups;
  result = await handler(request('production', false));
  assert.equal(result.status, 401, 'Anonymous request must fail first');
  assert.equal(calls.ownerLookups, acceptedLookups);
  allowOwner = false;
  result = await handler(request('production'));
  assert.equal(result.status, 404, 'Unowned project must not expose publishing');
  allowOwner = true;
  result = await handler(new Request('https://edge.example', {
    method: 'POST', headers: { origin: 'https://other.example' },
  }));
  assert.equal(result.status, 403, 'Untrusted Origin must be rejected');
  assert.equal(calls.rpc, 0, 'Production refuse-path must not reach database RPC');
  assert.equal(calls.network, 0, 'Production refuse-path must not contact provider/network');
  assert.equal(calls.clients, 1, 'No runtime initialization retry');
  console.log('PASS deployed candidate Edge bundle: authenticated owner-scoped Production=409, anon=401, nonowner=404, cross-origin=403, zero network/RPC.');
} finally {
  if (previous.Deno === undefined) delete globalThis.Deno;
  else globalThis.Deno = previous.Deno;
  if (previous.fixture === undefined) delete globalThis.__tayarEdgeRuntimeFixture;
  else globalThis.__tayarEdgeRuntimeFixture = previous.fixture;
  globalThis.fetch = previous.fetch;
  await rm(dir, { recursive: true, force: true });
}
