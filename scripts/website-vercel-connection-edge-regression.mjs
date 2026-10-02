import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-edge-'));
try {
  const outfile = join(dir, 'edge.cjs'), calls = [];
  globalThis.__tayarVercelEdgeCalls = calls;
  await build({ entryPoints: ['server/website-vercel-connection-edge.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile, plugins: [{ name: 'edge-fixtures', setup(builder) {
      builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
      builder.onLoad({ filter: /^supabase$/, namespace: 'fixture' }, () => ({ contents:
        `export function createClient(...args){globalThis.__tayarVercelEdgeCalls.push(['client',args]);return{kind:'client',args}}` }));
      builder.onResolve({ filter: /website-vercel-connection$/ }, () => ({ path: 'endpoint', namespace: 'fixture' }));
      builder.onLoad({ filter: /^endpoint$/, namespace: 'fixture' }, () => ({ contents:
        `export async function handleWebsiteVercelConnection(request,context){globalThis.__tayarVercelEdgeCalls.push(['endpoint',context]);const target=await context.loadGithubTarget({ownerId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',isCurrentOwner:async()=>true});return new Response(JSON.stringify(target),{status:200,headers:{'x-core':'yes'}})}` }));
      builder.onResolve({ filter: /website-vercel-github-target$/ }, () => ({ path: 'loader', namespace: 'fixture' }));
      builder.onLoad({ filter: /^loader$/, namespace: 'fixture' }, () => ({ contents:
        `export function createWebsiteVercelGithubTargetLoader(input){globalThis.__tayarVercelEdgeCalls.push(['loader',input]);return async scope=>{globalThis.__tayarVercelEdgeCalls.push(['scope',scope]);if(!await scope.isCurrentOwner())return null;return{repositoryId:'88',repositoryOwner:'customer',repositoryName:'booking',productionBranch:'main'}}}` }));
    } }] });
  const { createWebsiteVercelConnectionEdge: create } = (await import(pathToFileURL(outfile))).default;
  const serviceKey = `sb_secret_${'s'.repeat(32)}`;
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(128)}\n-----END PRIVATE KEY-----`;
  const environment = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey, WEBSITE_VERCEL_INTEGRATION_SLUG: 'tayar-connect',
    WEBSITE_VERCEL_CLIENT_ID: 'vercel-client-id', WEBSITE_VERCEL_CLIENT_SECRET: 'vercel-client-secret-value',
    WEBSITE_VERCEL_CALLBACK_URL: 'https://platform.example/functions/v1/website-vercel-connection?action=callback',
    WEBSITE_VERCEL_RETURN_URL: 'https://tayar.example/builder', TAYAR_PLATFORM_VERCEL_ACCOUNT_ID: 'team_tayar1234',
    TAYAR_GITHUB_APP_CLIENT_ID: 'Iv1_fixture', TAYAR_GITHUB_APP_PRIVATE_KEY_PKCS8: privateKey };
  const fetcher = async () => new Response('{}');
  const handler = create({ environment, fetcher });
  assert.equal(calls.filter(call => call[0] === 'client').length, 1, 'service client is cold-start scoped');
  const request = () => new Request('https://platform.example/functions/v1/website-vercel-connection?action=options', {
    method: 'POST', headers: { origin: 'https://tayar.example', authorization: 'Bearer header.payload.signature' },
  });
  const first = await handler(request());
  assert.equal(first.status, 200); assert.equal(first.headers.get('access-control-allow-origin'), 'https://tayar.example');
  assert.equal(first.headers.get('x-core'), 'yes');
  assert.deepEqual(await first.json(), { repositoryId: '88', repositoryOwner: 'customer',
    repositoryName: 'booking', productionBranch: 'main' });
  await handler(request());
  const clients = calls.filter(call => call[0] === 'client').map(call => call[1]);
  assert.equal(clients.length, 3, 'each authenticated target read gets a user-scoped RPC client');
  assert.equal(clients[0][0], environment.SUPABASE_URL); assert.equal(clients[0][1], serviceKey);
  assert.equal(clients[0][2].auth.detectSessionInUrl, false); assert.equal(clients[0][2].global.fetch, fetcher);
  assert.equal(clients[1][2].global.headers.Authorization, 'Bearer header.payload.signature');
  assert.equal(calls.filter(call => call[0] === 'endpoint').length, 2);
  assert.equal((await handler(new Request('https://platform.example/functions/v1/website-vercel-connection', {
    method: 'POST', headers: { origin: 'https://attacker.example' } }))).status, 403);
  assert.equal((await handler(new Request('https://platform.example/functions/v1/website-vercel-connection', {
    method: 'OPTIONS', headers: { origin: 'https://tayar.example' } }))).status, 204);
  assert.equal(calls.filter(call => call[0] === 'endpoint').length, 2, 'CORS refusal/preflight stop before endpoint');
  const disconnectOnly = { ...environment, WEBSITE_VERCEL_INTEGRATION_SLUG: '', WEBSITE_VERCEL_CLIENT_ID: '',
    WEBSITE_VERCEL_CLIENT_SECRET: '', TAYAR_PLATFORM_VERCEL_ACCOUNT_ID: '', TAYAR_GITHUB_APP_CLIENT_ID: '',
    TAYAR_GITHUB_APP_PRIVATE_KEY_PKCS8: '' };
  assert.equal(typeof create({ environment: disconnectOnly }), 'function');
  for (const change of [{ SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_public_fixture' },
    { WEBSITE_VERCEL_CALLBACK_URL: 'http://platform.example/functions/v1/website-vercel-connection?action=callback' },
    { NEXT_PUBLIC_WEBSITE_VERCEL_CLIENT_SECRET: 'leak' }, { TAYAR_GITHUB_APP_PRIVATE_KEY_PKCS8: 'not-a-key' }]) {
    assert.throws(() => create({ environment: { ...environment, ...change } }), /deployment unavailable/);
  }
  for (const missing of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WEBSITE_VERCEL_CALLBACK_URL',
    'WEBSITE_VERCEL_RETURN_URL']) {
    const copy = { ...environment }; delete copy[missing];
    assert.throws(() => create({ environment: copy }), /deployment unavailable/);
  }
  const generated = await readFile('supabase/functions/website-vercel-connection/index.ts', 'utf8');
  const config = await readFile('supabase/config.toml', 'utf8');
  const deploymentGuard = await readFile('scripts/admin-hardening-deploy.ps1', 'utf8');
  const example = await readFile('.env.example', 'utf8');
  assert.match(generated, /Deno[.]serve\(createWebsiteVercelConnectionEdge/);
  assert.match(generated, /npm:@supabase\/supabase-js@2[.]57[.]4/);
  assert.match(config, /\[functions[.]website-vercel-connection\]\nverify_jwt = false/);
  assert.ok(!deploymentGuard.includes("'website-vercel-connection'"));
  for (const key of Object.keys(environment)) assert.ok(example.includes(`${key}=""`), key);
  assert.ok(!/^(?:VITE_|NEXT_PUBLIC_)WEBSITE_VERCEL_.*(?:SECRET|PRIVATE_KEY)/m.test(example));
  console.log('PASS Vercel connection Edge: cold service client, user-scoped target reads, strict env/CORS and undeployed generated entry');
} finally { delete globalThis.__tayarVercelEdgeCalls; await rm(dir, { recursive: true, force: true }); }
