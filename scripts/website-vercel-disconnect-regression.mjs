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
  const connection = { id: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    ownerId: '33333333-3333-4333-8333-333333333333', provider: 'vercel',
    environment: 'production', accountId: 'team_customer1234', targetId: 'prj_booking1234',
    permissions: ['user:read', 'team:read', 'project:read'], status: 'connected', version: 4, operationId: null,
    verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const commitId = '44444444-4444-4444-8444-444444444444';
  const calls = [];
  const client = { async rpc(name, args) {
    calls.push({ name, args });
    if (name === 'website_reconcile_vercel_disconnect') return { data: null, error: null };
    assert.equal(name, 'website_disconnect_vercel_connection');
    assert.deepEqual(args, { p_connection_id: connection.id, p_project_id: connection.projectId,
      p_owner_id: connection.ownerId, p_expected_version: 4, p_commit_id: commitId });
    return { data: 5, error: null };
  } };
  assert.deepEqual(await disconnect({ client, connection, commitId, isCurrentOwner: () => true }),
    { version: 5, installation: 'retained' });
  assert.deepEqual(calls.map(call => call.name), ['website_reconcile_vercel_disconnect',
    'website_disconnect_vercel_connection']);

  let recoveryCalls = 0;
  assert.deepEqual(await disconnect({ connection, commitId, isCurrentOwner: () => true, client: {
    async rpc(name) { recoveryCalls++; assert.equal(name, 'website_reconcile_vercel_disconnect');
      return { data: 5, error: null }; },
  } }), { version: 5, installation: 'retained' });
  assert.equal(recoveryCalls, 1);
  let lost = 0;
  assert.deepEqual(await disconnect({ connection, commitId, isCurrentOwner: () => true, client: {
    async rpc(name) { lost++;
      if (name === 'website_reconcile_vercel_disconnect') return { data: lost === 1 ? null : 5, error: null };
      return { data: null, error: { message: 'lost response' } };
    },
  } }), { version: 5, installation: 'retained' });
  assert.equal(lost, 3);
  await assert.rejects(disconnect({ client, connection: { ...connection, provider: 'github' },
    commitId, isCurrentOwner: () => true }), /unavailable/);
  await assert.rejects(disconnect({ client, connection, commitId,
    isCurrentOwner: () => false }), /unavailable/);
  const sql = await readFile('supabase/migrations/20260930003000_website_byo_vercel_disconnect.sql', 'utf8');
  assert.match(sql, /delete from private\.website_vercel_integration_custody/);
  assert.match(sql, /status='disconnected'/);
  assert.match(sql, /not exists \(select 1 from private\.website_vercel_integration_custody/);
  assert.doesNotMatch(sql, /api\.vercel\.com|delete.*integrations\/configuration/i);
  console.log('PASS Vercel disconnect: atomic project severance, Vault erase, exact recovery and retained shared installation (mocked RPC/static SQL)');
} finally { await rm(dir, { recursive: true, force: true }); }
