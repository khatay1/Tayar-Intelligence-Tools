import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-supabase-browser-'));
try {
  const outfile = join(dir, 'browser.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteConnectionCoordinator.ts',
    'src/modules/website-builder/services/websiteConnectionEndpointCatalog.ts',
    'src/modules/website-builder/services/websiteSupabaseBrowserConnection.ts'], bundle: true,
    platform: 'node', format: 'cjs', outdir: dir, entryNames: '[name]', outExtension: { '.js': '.cjs' } });
  const coordinator = (await import(pathToFileURL(join(dir, 'websiteConnectionCoordinator.cjs')))).default;
  const catalogModule = (await import(pathToFileURL(join(dir, 'websiteConnectionEndpointCatalog.cjs')))).default;
  const supabase = (await import(pathToFileURL(join(dir, 'websiteSupabaseBrowserConnection.cjs')))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  const platformUrl = 'https://abcdefghijklmnopqrst.supabase.co';
  let current = true;
  const scope = { ownerId, projectId, loadSequence: 5, isCurrent: () => current };
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null,
    removeItem: key => values.delete(key) };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url), action = parsed.searchParams.get('action');
    const provider = parsed.pathname.includes('github') ? 'github' : parsed.pathname.includes('vercel') ? 'vercel' : 'supabase';
    let body;
    if (action === 'begin' && provider === 'github') body = { authorizationUrl:
      `https://github.com/login/oauth/authorize?client_id=Iv1_fixture&state=${'a'.repeat(64)}` };
    else if (action === 'begin' && provider === 'vercel') body = { authorizationUrl:
      `https://vercel.com/integrations/tayar-connect/new?state=${'b'.repeat(64)}` };
    else if (action === 'begin') body = { authorizationUrl:
      `https://api.supabase.com/v1/oauth/authorize?client_id=supabase-client&response_type=code&state=${'c'.repeat(64)}&code_challenge=fixture&code_challenge_method=S256` };
    else if (action === 'options') body = { accountUserId: 'user_1', projects: [{ projectRef: 'abcdefghijklmnopqrst',
      projectName: 'Booking', organizationId: 'customer_org', organizationSlug: 'customer',
      organizationName: 'Customer', accessToken: 'leak' }] };
    else body = { status: 'connected', connectionId: handoffId, projectRef: 'abcdefghijklmnopqrst', version: 1 };
    return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify(body) };
  };
  const environment = {
    VITE_WEBSITE_GITHUB_CONNECTION_URL: `${platformUrl}/functions/v1/website-github-connection`,
    VITE_WEBSITE_SUPABASE_CONNECTION_URL: `${platformUrl}/functions/v1/website-supabase-connection`,
    VITE_WEBSITE_VERCEL_CONNECTION_URL: `${platformUrl}/functions/v1/website-vercel-connection`,
  };
  const catalog = catalogModule.createWebsiteConnectionEndpointCatalog({ environment, platformUrl,
    anonKey: `sb_publishable_${'p'.repeat(32)}`, getSession: async () => ({ ownerId, accessToken: 'header.payload.signature' }), fetcher });
  for (const provider of ['github', 'supabase', 'vercel']) {
    const url = await coordinator.beginWebsiteProviderConnection({ provider, catalog, scope, environment: 'production', storage });
    assert.equal(new URL(url).hostname, provider === 'github' ? 'github.com' : provider === 'vercel' ? 'vercel.com' : 'api.supabase.com');
  }
  const unavailable = catalogModule.createWebsiteConnectionEndpointCatalog({ environment: {}, platformUrl,
    anonKey: `sb_publishable_${'p'.repeat(32)}`, getSession: async () => ({ ownerId, accessToken: 'token' }) });
  await assert.rejects(coordinator.beginWebsiteProviderConnection({ provider: 'supabase', catalog: unavailable,
    scope, environment: 'production', storage }), /unavailable/);
  const location = { hash: `#tayar_supabase_handoff=${handoffId}`, pathname: '/builder', search: '?tab=infra' };
  let cleaned = '';
  const history = { state: null, replaceState: (_state, _title, url) => { cleaned = url; } };
  const handoff = coordinator.consumeWebsiteProviderHandoff({ scope, location, history, storage });
  assert.equal(handoff?.handoff.environment, 'production');
  assert.equal(cleaned, '/builder?tab=infra');
  assert.deepEqual(handoff, { provider: 'supabase', handoff: { id: handoffId, ownerId, projectId, environment: 'production', loadSequence: 5 } });
  const transport = catalog.transportFor('supabase');
  const choices = await supabase.listWebsiteSupabaseChoices({ scope, transport, handoff: handoff.handoff });
  assert.deepEqual(choices, { accountUserId: 'user_1', projects: [{ projectRef: 'abcdefghijklmnopqrst',
    projectName: 'Booking', organizationId: 'customer_org', organizationSlug: 'customer', organizationName: 'Customer' }] });
  assert.ok(!JSON.stringify(choices).includes('leak'));
  assert.deepEqual(await supabase.selectWebsiteSupabaseProject({ scope, transport, handoff: handoff.handoff,
    accountUserId: choices.accountUserId, choice: choices.projects[0] }), { connectionId: handoffId, version: 1 });
  const before = calls.length; current = false;
  await assert.rejects(supabase.listWebsiteSupabaseChoices({ scope, transport, handoff: handoff.handoff }), /changed/);
  assert.equal(calls.length, before);
  assert.equal(coordinator.consumeWebsiteProviderHandoff({ scope: { ...scope, isCurrent: () => true },
    location: { ...location, hash: `#tayar_supabase_handoff=${handoffId}&extra=1` }, history, storage }), null);
  console.log('PASS Supabase browser/coordinator: gated provider starts, opaque fragment, sanitized choices, binding and stale scope refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
