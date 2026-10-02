import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-disconnect-'));
try {
  const outfile = join(dir, 'disconnect.cjs');
  await build({ entryPoints: ['server/website-owned-vercel-disconnect.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { disconnectOwnedVercelProject: disconnect } = (await import(pathToFileURL(outfile))).default;
  const operationId = '44444444-4444-4444-8444-444444444444';
  const commitId = '55555555-5555-4555-8555-555555555555';
  const ids = { SUPABASE_ANON_KEY: 'env_anon123', SUPABASE_URL: 'env_url123' };
  const baseConnection = { id: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    ownerId: '33333333-3333-4333-8333-333333333333', provider: 'vercel',
    environment: 'preview', accountId: 'team_customer1234', targetId: 'prj_booking1234',
    permissions: ['user:read', 'team:read', 'project:read'], status: 'ready', version: 4, operationId: null,
    verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const input = { connection: baseConnection, operationId, commitId, isCurrentOwner: () => true };
  const begin = environment => ({ cleanupRequired: true, receiptVersion: 7,
    accessToken: 'vercel_fixture_token_123456789', userId: 'user_fixture123', accountId: 'team_fixture123',
    vercelProjectId: 'prj_booking1234', environment,
    gitBranch: environment === 'preview' ? `tayar/${baseConnection.projectId}/preview` : null,
    marker: `Tayar ${environment === 'preview' ? '' : 'production '}runtime ${operationId}`, environmentIds: ids });
  const completed = { connectionVersion: 5, receiptVersion: 8 };
  const rpcClient = (beginResult, options = {}) => { let reconciles = 0; const calls = [];
    return { calls, client: { async rpc(name, args) { calls.push({ name, args });
      if (name === 'website_reconcile_completed_vercel_runtime_disconnect') return { data: options.completed ?? null, error: null };
      if (name === 'website_begin_vercel_runtime_disconnect') return { data: beginResult, error: null };
      if (name === 'website_reconcile_vercel_runtime_disconnect') {
        reconciles++; return { data: options.lostCommit && reconciles === 2 ? completed : null, error: null };
      }
      if (name === 'website_commit_vercel_runtime_disconnect') {
        assert.deepEqual(args.p_removed_environment_ids, options.noReceipt ? [] : ['env_anon123', 'env_url123']);
        return options.lostCommit ? { data: null, error: { message: 'lost response' } }
          : { data: options.noReceipt ? { connectionVersion: 5, receiptVersion: null } : completed, error: null };
      }
      throw Error(name);
    } } };
  };
  const provider = (environment, options = {}) => { let rows = [
    { id: ids.SUPABASE_ANON_KEY, key: 'SUPABASE_ANON_KEY', type: 'plain', target: [environment],
      comment: begin(environment).marker, ...(environment === 'preview' ? { gitBranch: begin(environment).gitBranch } : {}) },
    { id: ids.SUPABASE_URL, key: 'SUPABASE_URL', type: 'plain', target: [environment],
      comment: begin(environment).marker, ...(environment === 'preview' ? { gitBranch: begin(environment).gitBranch } : {}) },
    { id: 'env_customer999', key: 'CUSTOMER_VALUE', type: 'plain', target: [environment] },
  ]; const deleted = []; let reads = 0;
    if (options.mutate) rows[0] = { ...rows[0], comment: 'customer changed this variable' };
    return { deleted, get rows() { return rows; }, fetcher: async (url, init) => {
      assert.ok(url.includes('prj_booking1234'));
      if (init.method === 'DELETE') { const id = url.split('/').at(-1).split('?')[0]; deleted.push(id);
        rows = rows.filter(row => row.id !== id); if (options.uncertainDelete) throw Error('lost response');
        return new Response('{}', { status: 200 }); }
      reads++; return new Response(JSON.stringify({ envs: rows }), { status: 200 });
    }, get reads() { return reads; } };
  };

  const previewRpc = rpcClient(begin('preview')); const previewProvider = provider('preview');
  assert.deepEqual(await disconnect({ ...input, client: previewRpc.client, fetcher: previewProvider.fetcher }),
    { version: 5, installation: 'retained' });
  assert.deepEqual(previewProvider.deleted.sort(), ['env_anon123', 'env_url123']);
  assert.deepEqual(previewProvider.rows.map(row => row.id), ['env_customer999'], 'unrelated customer variable survives');
  assert.equal(previewProvider.reads, 2);

  const productionConnection = { ...baseConnection, environment: 'production' };
  const productionRpc = rpcClient(begin('production'), { lostCommit: true });
  const productionProvider = provider('production', { uncertainDelete: true });
  assert.deepEqual(await disconnect({ ...input, connection: productionConnection, client: productionRpc.client,
    fetcher: productionProvider.fetcher }), { version: 5, installation: 'retained' });
  assert.deepEqual(productionProvider.deleted.sort(), ['env_anon123', 'env_url123']);
  assert.deepEqual(productionProvider.rows.map(row => row.id), ['env_customer999']);
  assert.equal(productionRpc.calls.filter(call => call.name === 'website_commit_vercel_runtime_disconnect').length, 1);

  const changedRpc = rpcClient(begin('preview')); const changedProvider = provider('preview', { mutate: true });
  await assert.rejects(disconnect({ ...input, client: changedRpc.client, fetcher: changedProvider.fetcher }), /unavailable/);
  assert.deepEqual(changedProvider.deleted, [], 'customer-mutated receipt ID is never deleted');

  const retryRpc = rpcClient(begin('preview'), { completed });
  assert.deepEqual(await disconnect({ ...input, client: retryRpc.client,
    fetcher() { throw Error('provider must not be replayed after completed reconciliation'); } }),
    { version: 5, installation: 'retained' });
  assert.deepEqual(retryRpc.calls.map(call => call.name), ['website_reconcile_completed_vercel_runtime_disconnect']);

  const noReceiptRpc = rpcClient({ cleanupRequired: false, receiptVersion: null }, { noReceipt: true });
  assert.deepEqual(await disconnect({ ...input, client: noReceiptRpc.client,
    fetcher() { throw Error('provider is unnecessary without a receipt'); } }),
    { version: 5, installation: 'retained' });
  assert.deepEqual(noReceiptRpc.calls.map(call => call.name), [
    'website_reconcile_completed_vercel_runtime_disconnect', 'website_begin_vercel_runtime_disconnect',
    'website_reconcile_vercel_runtime_disconnect', 'website_commit_vercel_runtime_disconnect']);

  await assert.rejects(disconnect({ ...input, client: previewRpc.client,
    connection: { ...baseConnection, provider: 'github' } }), /unavailable/);
  await assert.rejects(disconnect({ ...input, client: previewRpc.client, isCurrentOwner: () => false }), /unavailable/);

  const migration = 'supabase/migrations/20261002144040_website_byo_vercel_runtime_disconnect_cleanup.sql';
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /status in\('preparing','verified','removing','removed'\)/);
  assert.match(sql, /drop function public\.website_disconnect_vercel_connection/);
  assert.match(sql, /website_reconcile_completed_vercel_runtime_disconnect/);
  assert.match(sql, /old\.status='removing'.+new\.status<>'removed'/s);
  assert.match(sql, /delete from private\.website_vercel_integration_custody/);
  assert.match(sql, /removed_environment_ids=p_removed_environment_ids/);
  assert.match(sql, /grant execute on function public\.website_begin_vercel_runtime_disconnect[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function public\.website_begin_vercel_runtime_disconnect[^;]+to authenticated/s);
  console.log('PASS Vercel disconnect: exact Preview/Production receipt cleanup, mutation refusal, absence proof, unrelated-variable preservation, atomic custody erase and no-replay recovery (mocked HTTP/RPC/static SQL)');
} finally { await rm(dir, { recursive: true, force: true }); }
