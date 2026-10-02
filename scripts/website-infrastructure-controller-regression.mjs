import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-infrastructure-controller-'));
try {
  await build({ entryPoints: ['src/modules/website-builder/services/websiteInfrastructureController.ts',
    'src/modules/website-builder/services/websiteConnectionEndpointCatalog.ts'], bundle: true,
    platform: 'node', format: 'cjs', outdir: dir, entryNames: '[name]', outExtension: { '.js': '.cjs' },
    external: ['@supabase/supabase-js'] });
  const controllerModule = (await import(pathToFileURL(join(dir, 'websiteInfrastructureController.cjs')))).default;
  const catalogModule = (await import(pathToFileURL(join(dir, 'websiteConnectionEndpointCatalog.cjs')))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
  const connectionId = '33333333-3333-4333-8333-333333333333', platformUrl = 'https://abcdefghijklmnopqrst.supabase.co';
  let current = true, navigated = '', rpcCalls = 0;
  const scope = { ownerId, projectId, loadSequence: 7, isCurrent: () => current };
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null,
    removeItem: key => values.delete(key) };
  const location = { hash: '', pathname: '/builder', search: '?tab=infra' };
  const history = { state: null, replaceState: (_state, _title, url) => { assert.equal(url, '/builder?tab=infra'); } };
  const fetcher = async () => ({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ authorizationUrl:
    `https://api.supabase.com/v1/oauth/authorize?client_id=supabase-client&response_type=code&state=${'a'.repeat(64)}&code_challenge=fixture&code_challenge_method=S256` }) });
  const catalog = catalogModule.createWebsiteConnectionEndpointCatalog({
    environment: { VITE_WEBSITE_SUPABASE_CONNECTION_URL: `${platformUrl}/functions/v1/website-supabase-connection` },
    platformUrl, anonKey: `sb_publishable_${'p'.repeat(32)}`,
    getSession: async () => ({ ownerId, accessToken: 'header.payload.signature' }), fetcher });
  const client = { rpc: async (name, args) => {
    rpcCalls += 1; assert.equal(name, 'website_infrastructure_connections_for_owner'); assert.equal(args.p_project_id, projectId);
    return { error: null, data: [{ id: connectionId, ownerId, projectId, provider: 'supabase', environment: 'production',
      accountId: 'user_1', targetId: 'abcdefghijklmnopqrst', permissions: ['database:write', 'secrets:read'],
      status: 'connected', version: 1, verifiedAt: '2026-10-02T18:00:00.000Z', updatedAt: '2026-10-02T18:00:00.000Z' }] };
  } };
  const controller = controllerModule.createWebsiteInfrastructureController({ client, catalog, scope, storage,
    location, history, navigate: url => { navigated = url; } });
  assert.deepEqual(controller.availableProviders, ['supabase']);
  const refreshed = await controller.refresh();
  assert.equal(refreshed.connections.length, 1); assert.equal(refreshed.connections[0].provider, 'supabase');
  await controller.begin('supabase', 'production');
  assert.equal(new URL(navigated).origin, 'https://api.supabase.com');
  location.hash = `#tayar_supabase_handoff=${connectionId}`;
  assert.deepEqual(controller.consumeHandoff(), { provider: 'supabase', handoff: {
    id: connectionId, ownerId, projectId, loadSequence: 7 } });
  controller.clearHandoff(); assert.equal(controller.getState().handoff, null);
  current = false;
  await assert.rejects(controller.refresh(), /scope changed/);
  assert.equal(rpcCalls, 1, 'stale project stops before owner status RPC');
  controller.dispose(); assert.deepEqual(controller.getState().connections, []);
  const chooser = await readFile('src/modules/website-builder/v2-ui/BuilderSupabaseConnectionChooser.tsx', 'utf8');
  assert.match(chooser, /data-testid="supabase-project-chooser"/);
  assert.match(chooser, /listWebsiteSupabaseChoices/);
  assert.match(chooser, /selectWebsiteSupabaseProject/);
  assert.match(chooser, /scope[.]isCurrent\(\)/);
  console.log('PASS Infrastructure controller: owner status, endpoint-gated begin, opaque handoff, stale lifecycle and Supabase chooser reachability');
} finally { await rm(dir, { recursive: true, force: true }); }
