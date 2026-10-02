import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-connection-catalog-'));
try {
  const outfile = join(dir, 'catalog.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteConnectionEndpointCatalog.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createWebsiteConnectionEndpointCatalog: create } = (await import(pathToFileURL(outfile))).default;
  const platformUrl = 'https://abcdefghijklmnopqrst.supabase.co';
  const anonKey = `sb_publishable_${'p'.repeat(32)}`;
  const getSession = async () => ({ ownerId: '11111111-1111-4111-8111-111111111111', accessToken: 'token' });
  const fetcher = async () => new Response('{}');
  const empty = create({ environment: {}, platformUrl, anonKey, getSession, fetcher });
  assert.deepEqual(empty.availableProviders, []);
  assert.equal(empty.transportFor('github'), null);
  const environment = {
    VITE_WEBSITE_GITHUB_CONNECTION_URL: `${platformUrl}/functions/v1/website-github-connection`,
    VITE_WEBSITE_SUPABASE_CONNECTION_URL: `${platformUrl}/functions/v1/website-supabase-connection`,
    VITE_WEBSITE_VERCEL_CONNECTION_URL: `${platformUrl}/functions/v1/website-vercel-connection`,
  };
  const ready = create({ environment, platformUrl, anonKey, getSession, fetcher });
  assert.deepEqual(ready.availableProviders, ['github', 'supabase', 'vercel']);
  for (const provider of ready.availableProviders) {
    assert.equal(ready.endpoints[provider], environment[`VITE_WEBSITE_${provider.toUpperCase()}_CONNECTION_URL`]);
    assert.deepEqual(ready.transportFor(provider), { platformUrl, anonKey, getSession, fetcher });
  }
  const partial = create({ environment: { VITE_WEBSITE_GITHUB_CONNECTION_URL: environment.VITE_WEBSITE_GITHUB_CONNECTION_URL },
    platformUrl, anonKey, getSession });
  assert.deepEqual(partial.availableProviders, ['github']);
  assert.equal(partial.transportFor('supabase'), null);
  for (const bad of [
    { ...environment, VITE_WEBSITE_GITHUB_CONNECTION_URL: 'http://abcdefghijklmnopqrst.supabase.co/functions/v1/website-github-connection' },
    { ...environment, VITE_WEBSITE_GITHUB_CONNECTION_URL: 'https://attacker.example/functions/v1/website-github-connection' },
    { ...environment, VITE_WEBSITE_GITHUB_CONNECTION_URL: `${environment.VITE_WEBSITE_GITHUB_CONNECTION_URL}?token=leak` },
    { ...environment, VITE_WEBSITE_GITHUB_CONNECTION_URL: `${platformUrl}/functions/v1/website-vercel-connection` },
  ]) assert.throws(() => create({ environment: bad, platformUrl, anonKey, getSession }), /unavailable/);
  assert.throws(() => create({ environment, platformUrl, anonKey: `sb_secret_${'s'.repeat(32)}`, getSession }), /unavailable/);
  assert.throws(() => create({ environment, platformUrl: 'https://attacker.example', anonKey, getSession }), /unavailable/);
  console.log('PASS connection endpoint catalog: explicit same-origin HTTPS functions, partial availability and secret-safe refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
