import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-edge-'));
try {
  const outfile = join(dir, 'edge.cjs'), calls = [];
  globalThis.__tayarGithubEdgeCalls = calls;
  await build({ entryPoints: ['server/website-github-connection-edge.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile, plugins: [{ name: 'edge-fixtures', setup(builder) {
      builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
      builder.onLoad({ filter: /^supabase$/, namespace: 'fixture' }, () => ({ contents:
        `export function createClient(...args){globalThis.__tayarGithubEdgeCalls.push(['client',args]);return{kind:'client',args}}` }));
      builder.onResolve({ filter: /website-github-connection$/ }, () => ({ path: 'endpoint', namespace: 'fixture' }));
      builder.onLoad({ filter: /^endpoint$/, namespace: 'fixture' }, () => ({ contents:
        `export async function handleWebsiteGitHubConnection(request,context){globalThis.__tayarGithubEdgeCalls.push(['endpoint',context]);return new Response(JSON.stringify({ok:true}),{status:200,headers:{'x-core':'yes'}})}` }));
    } }] });
  const { createWebsiteGitHubConnectionEdge: create,
    createWebsiteGitHubConnectionDeployment: createDeployment } = (await import(pathToFileURL(outfile))).default;
  const serviceKey = `sb_secret_${'s'.repeat(32)}`;
  const environment = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey, WEBSITE_GITHUB_APP_CLIENT_ID: 'Iv1_fixture',
    WEBSITE_GITHUB_APP_CLIENT_SECRET: 'github-client-secret-value',
    WEBSITE_GITHUB_CALLBACK_URL: 'https://platform.example/functions/v1/website-github-connection?action=callback',
    WEBSITE_GITHUB_RETURN_URL: 'https://tayar.example/builder' };
  const fetcher = async () => new Response('{}');
  const handler = create({ environment, fetcher });
  assert.equal(calls.filter(call => call[0] === 'client').length, 1, 'service client is cold-start scoped');
  const request = () => new Request('https://platform.example/functions/v1/website-github-connection?action=options', {
    method: 'POST', headers: { origin: 'https://tayar.example', authorization: 'Bearer header.payload.signature' } });
  const first = await handler(request());
  assert.equal(first.status, 200); assert.equal(first.headers.get('access-control-allow-origin'), 'https://tayar.example');
  assert.equal(first.headers.get('x-core'), 'yes'); assert.deepEqual(await first.json(), { ok: true });
  await handler(request());
  assert.equal(calls.filter(call => call[0] === 'client').length, 1, 'requests reuse the cold-start client');
  assert.equal(calls.filter(call => call[0] === 'endpoint').length, 2);
  const client = calls.find(call => call[0] === 'client')[1];
  assert.equal(client[0], environment.SUPABASE_URL); assert.equal(client[1], serviceKey);
  assert.equal(client[2].auth.detectSessionInUrl, false); assert.equal(client[2].global.fetch, fetcher);
  const context = calls.find(call => call[0] === 'endpoint')[1];
  assert.equal(context.clientSecret, environment.WEBSITE_GITHUB_APP_CLIENT_SECRET);
  assert.equal((await handler(new Request('https://platform.example/functions/v1/website-github-connection', {
    method: 'POST', headers: { origin: 'https://attacker.example' } }))).status, 403);
  assert.equal((await handler(new Request('https://platform.example/functions/v1/website-github-connection', {
    method: 'OPTIONS', headers: { origin: 'https://tayar.example' } }))).status, 204);
  assert.equal(calls.filter(call => call[0] === 'endpoint').length, 2, 'CORS refusal/preflight stop before endpoint');
  for (const change of [{ SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_public_fixture' },
    { WEBSITE_GITHUB_CALLBACK_URL: 'http://platform.example/functions/v1/website-github-connection?action=callback' },
    { NEXT_PUBLIC_WEBSITE_GITHUB_APP_CLIENT_SECRET: 'leak' },
    { WEBSITE_GITHUB_APP_CLIENT_SECRET: 'too-short' }, { WEBSITE_GITHUB_APP_CLIENT_ID: 'bad/id' }]) {
    assert.throws(() => create({ environment: { ...environment, ...change } }), /deployment unavailable/);
  }
  for (const missing of Object.keys(environment)) {
    const copy = { ...environment }; delete copy[missing];
    assert.throws(() => create({ environment: copy }), /deployment unavailable/);
  }
  const unavailable = await createDeployment({ environment: {} })(new Request('https://platform.example/'));
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: 'GitHub connection is unavailable.' });
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  const generated = await readFile('supabase/functions/website-github-connection/index.ts', 'utf8');
  const config = await readFile('supabase/config.toml', 'utf8');
  const deploymentGuard = await readFile('scripts/admin-hardening-deploy.ps1', 'utf8');
  const example = await readFile('.env.example', 'utf8');
  assert.match(generated, /Deno[.]serve\(createWebsiteGitHubConnectionDeployment/);
  assert.match(generated, /npm:@supabase\/supabase-js@2[.]57[.]4/);
  assert.match(config, /\[functions[.]website-github-connection\]\nverify_jwt = false/);
  assert.ok(!deploymentGuard.includes("'website-github-connection'"));
  for (const key of Object.keys(environment)) assert.ok(example.includes(`${key}=""`), key);
  assert.ok(!/^(?:VITE_|NEXT_PUBLIC_)WEBSITE_GITHUB_.*SECRET/m.test(example));
  console.log('PASS GitHub connection Edge: cold client, strict env/CORS, callback config and undeployed generated entry');
} finally { delete globalThis.__tayarGithubEdgeCalls; await rm(dir, { recursive: true, force: true }); }
