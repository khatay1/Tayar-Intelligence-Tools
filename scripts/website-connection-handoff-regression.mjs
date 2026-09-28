import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-handoff-'));
try {
  const outfile = join(dir, 'handoff.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteConnectionHandoffService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { storeWebsiteConnectionHandoff: store, consumeWebsiteConnectionHandoff: consume,
    peekWebsiteConnectionHandoff: peek,
    revokeWebsiteConnectionHandoff: revoke } = (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const token = 'fixture-user-token-1234567890123456';
  const custody = new Map();
  const client = { async rpc(name, args) {
    if (name === 'website_store_connection_handoff') {
      custody.set(args.p_id, { ownerId: args.p_owner_id, projectId: args.p_project_id,
        provider: args.p_provider, environment: args.p_environment, token: args.p_token });
      return { data: null, error: null };
    }
    const saved = custody.get(args.p_id);
    if (name === 'website_revoke_connection_handoff') {
      if (saved?.ownerId === args.p_owner_id && saved.projectId === args.p_project_id) custody.delete(args.p_id);
      return { data: true, error: null };
    }
    assert.ok(['website_consume_connection_handoff', 'website_peek_connection_handoff'].includes(name));
    if (!saved || saved.ownerId !== args.p_owner_id || saved.projectId !== args.p_project_id || saved.provider !== args.p_provider) return { data: null, error: null };
    if (name === 'website_consume_connection_handoff') custody.delete(args.p_id);
    return { data: { environment: saved.environment, userToken: saved.token }, error: null };
  } };
  const input = { client, ownerId, projectId, provider: 'github', environment: 'production', userToken: token, now: () => Date.parse('2026-09-28T20:00:00Z') };
  const id = await store(input);
  assert.match(id, /^[0-9a-f-]{36}$/i);
  assert.ok(!id.includes(token));
  assert.equal(custody.get(id).token, token);
  assert.deepEqual(await peek({ client, id, ownerId, projectId, provider: 'github', isCurrentOwner: () => true }), { environment: 'production', userToken: token });
  assert.equal(custody.has(id), true, 'Choices do not consume grant');
  await assert.rejects(peek({ client, id, ownerId, projectId: ownerId, provider: 'github', isCurrentOwner: () => true }), /unavailable/);
  await assert.rejects(peek({ client, id, ownerId, projectId, provider: 'github', isCurrentOwner: () => false }), /unavailable/);
  await assert.rejects(consume({ client, id, ownerId, projectId: ownerId, provider: 'github', isCurrentOwner: () => true }), /unavailable/);
  assert.deepEqual(await consume({ client, id, ownerId, projectId, provider: 'github', isCurrentOwner: () => true }), { environment: 'production', userToken: token });
  await assert.rejects(consume({ client, id, ownerId, projectId, provider: 'github', isCurrentOwner: () => true }), /unavailable/);
  const another = await store(input);
  await revoke({ client, id: another, ownerId, projectId });
  assert.equal(custody.has(another), false);
  await assert.rejects(store({ ...input, userToken: 'short' }), /could not be stored/);
  console.log('PASS encrypted handoff boundary: opaque handle, scoped chooser read, one-use consume and revoke');
} finally { await rm(dir, { recursive: true, force: true }); }
