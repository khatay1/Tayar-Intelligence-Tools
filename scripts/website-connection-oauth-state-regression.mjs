import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-oauth-state-'));
try {
  const outfile = join(dir, 'state.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteConnectionOAuthStateService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createWebsiteConnectionOAuthState: create, consumeWebsiteConnectionOAuthState: consume } = (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const stored = new Map();
  const client = { async rpc(name, args) {
    if (name === 'website_create_connection_oauth_state') {
      assert.match(args.p_state_hash, /^[0-9a-f]{64}$/);
      assert.equal(args.p_owner_id, ownerId);
      assert.equal(args.p_project_id, projectId);
      stored.set(args.p_state_hash, { ownerId, projectId, provider: args.p_provider, environment: args.p_environment });
      return { data: null, error: null };
    }
    assert.equal(name, 'website_consume_connection_oauth_state');
    const data = stored.get(args.p_state_hash) ?? null;
    stored.delete(args.p_state_hash);
    return { data, error: null };
  } };
  const input = { client, ownerId, projectId, provider: 'github', environment: 'production', isCurrentOwner: () => true, now: () => Date.parse('2026-09-28T20:00:00Z') };
  const state = await create(input);
  assert.match(state, /^[0-9a-f]{64}$/);
  assert.equal(stored.has(state), false, 'Raw state is never persisted');
  assert.deepEqual(await consume({ client, state, provider: 'github' }), { ownerId, projectId, provider: 'github', environment: 'production' });
  await assert.rejects(consume({ client, state, provider: 'github' }), /invalid or expired/);
  await assert.rejects(consume({ client, state: '../state', provider: 'github' }), /invalid or expired/);
  const second = await create(input);
  await assert.rejects(consume({ client, state: second, provider: 'vercel' }), /invalid or expired/);
  await assert.rejects(create({ ...input, isCurrentOwner: () => false }), /could not be started/);
  let checks = 0;
  await assert.rejects(create({ ...input, isCurrentOwner: () => ++checks === 1 }), /could not be started/);
  console.log('PASS OAuth state: random opaque value, hashed custody, scope, replay refusal and stale owner denial');
} finally { await rm(dir, { recursive: true, force: true }); }
