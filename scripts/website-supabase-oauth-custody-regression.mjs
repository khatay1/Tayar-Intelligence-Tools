import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-supabase-custody-'));
try {
  const outfile = join(dir, 'custody.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteSupabaseOAuthCustodyService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { storeWebsiteSupabaseOAuthCustody: store, readWebsiteSupabaseOAuthCustody: read,
    eraseWebsiteSupabaseOAuthCustody: erase } = (await import(pathToFileURL(outfile))).default;
  const sql = await readFile('supabase/migrations/20260929170000_website_byo_supabase_oauth_custody.sql', 'utf8');
  const capacitySql = await readFile('supabase/migrations/20261003220000_website_byo_supabase_oauth_capacity.sql', 'utf8');
  assert.match(capacitySql, /create or replace function public\.website_store_supabase_oauth_custody/);
  assert.match(capacitySql, /octet_length\(p_access_token\) > 65536/);
  assert.match(capacitySql, /octet_length\(p_refresh_token\) > 65536/);
  assert.match(sql, /vault\.create_secret/); assert.match(sql, /vault\.update_secret/);
  assert.match(sql, /vault\.decrypted_secrets/); assert.match(sql, /vault\.secrets where id=old\.secret_id/);
  assert.match(sql, /connection_version=p_expected_connection_version/);
  assert.match(sql, /octet_length\(p_access_token\) > 65536/);
  assert.match(sql, /octet_length\(p_refresh_token\) > 65536/);
  for (const name of ['store', 'read', 'reconcile', 'delete', 'cleanup_expired']) {
    assert.match(sql, new RegExp(`revoke all on function public.website_${name}_supabase_oauth_custody|revoke all on function public.website_supabase_oauth_custody_${name}`));
  }
  const connection = { id: '33333333-3333-4333-8333-333333333333', ownerId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222', provider: 'supabase', environment: 'production',
    accountId: 'user_1234', targetId: 'abcdefghijklmnopqrst', permissions: ['projects:read', 'database:read'],
    status: 'connected', version: 7, operationId: null,
    verifiedAt: '2026-09-29T16:00:00.000Z', updatedAt: '2026-09-29T16:00:00.000Z' };
  const accessToken = 'a'.repeat(32_000);
  const refreshToken = 'b'.repeat(32_000);
  const accessExpiresAt = new Date(Date.now() + 3_600_000).toISOString();
  const custodyExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  let stored = null, storeCalls = 0, lostResponse = false;
  const client = { async rpc(name, args) {
    if (name === 'website_store_supabase_oauth_custody') {
      storeCalls++;
      assert.equal(args.p_owner_id, connection.ownerId); assert.equal(args.p_project_ref, connection.targetId);
      assert.equal(args.p_expected_connection_version, connection.version);
      if (stored && stored.version !== args.p_expected_version) return { data: null, error: Error('stale') };
      stored = { version: args.p_expected_version + 1, operationId: args.p_operation_id,
        grant: { accessToken: args.p_access_token, refreshToken: args.p_refresh_token },
        accountId: args.p_account_id, projectRef: args.p_project_ref,
        environment: connection.environment, organizationId: args.p_organization_id,
        organizationSlug: args.p_organization_slug, accessExpiresAt: args.p_access_expires_at,
        custodyExpiresAt: args.p_custody_expires_at };
      return lostResponse ? { data: null, error: Error('response lost') } : { data: stored.version, error: null };
    }
    if (name === 'website_reconcile_supabase_oauth_custody') return { data: stored?.operationId === args.p_operation_id
      && stored.version === args.p_expected_version + 1 ? stored.version : null, error: null };
    if (name === 'website_read_supabase_oauth_custody') return { data: stored, error: null };
    assert.equal(name, 'website_delete_supabase_oauth_custody');
    stored = null; return { data: true, error: null };
  } };
  const scope = { client, connection, organizationId: 'customer-org', organizationSlug: 'customer', isCurrentOwner: () => true };
  const write = { ...scope, expectedVersion: 0, operationId: '44444444-4444-4444-8444-444444444444',
    accessToken, refreshToken, accessExpiresAt, custodyExpiresAt,
    confirmOwnedProject: async value => value === accessToken };
  assert.equal(await store(write), 1);
  assert.deepEqual(await read(scope), { version: 1, accessToken, refreshToken, accessExpiresAt, custodyExpiresAt });
  lostResponse = true;
  assert.equal(await store({ ...write, expectedVersion: 1, operationId: '55555555-5555-4555-8555-555555555555' }), 2);
  assert.equal(storeCalls, 2, 'Lost response is reconciled without another token exchange');
  await assert.rejects(store({ ...write, expectedVersion: 1, operationId: '66666666-6666-4666-8666-666666666666' }), /changed/);
  await assert.rejects(store({ ...write, expectedVersion: 2, confirmOwnedProject: async () => false }), /scope changed/);
  await assert.rejects(read({ ...scope, organizationId: 'other' }), /unavailable/);
  await assert.rejects(store({ ...write, connection: { ...connection, version: 8 }, isCurrentOwner: () => false }), /scope changed/);
  assert.equal(await erase({ client, connection: { ...connection, status: 'disconnected', targetId: null,
    permissions: [], verifiedAt: null, version: 8 }, isCurrentOwner: () => true }), true);
  assert.equal(stored, null);
  console.log('PASS Supabase OAuth Vault custody: exact owner/connection, CAS rotation, uncertain response and erasure (mocked RPC/static SQL)');
} finally { await rm(dir, { recursive: true, force: true }); }
