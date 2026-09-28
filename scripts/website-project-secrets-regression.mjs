import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-project-secrets-'));
try {
  const outfile = join(dir, 'secrets.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteProjectSecretService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createWebsiteProjectSecretWriter, saveWebsiteIntegrationSecret, inspectWebsiteIntegrationSecrets } = (await import(pathToFileURL(outfile))).default;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const ref = `secret://website/${projectId}/stripe/secretKey/production`;
  const calls = [];
  const client = { async rpc(name, args) { calls.push({ name, args }); return { data: ref, error: null }; } };
  assert.throws(() => createWebsiteProjectSecretWriter(client, 'another-project', 'production'), /Invalid project/);
  const writer = createWebsiteProjectSecretWriter(client, projectId, 'production');
  await assert.rejects(() => writer.setSecret('stripe', 'owner_id', ''), /Invalid project secret/);
  await assert.rejects(() => writer.setSecret('stripe/other', 'secretKey', 'private-value'), /Invalid project secret/);
  assert.equal(calls.length, 0);
  assert.deepEqual(await writer.setSecret('stripe', 'secretKey', 'private-value'), { ref });
  assert.equal(calls[0].name, 'website_set_project_secret');
  assert.deepEqual(calls[0].args, { p_project_id: projectId, p_connection_id: 'stripe', p_field: 'secretKey', p_environment: 'production', p_value: 'private-value' });
  const wrong = createWebsiteProjectSecretWriter({ async rpc() { return { data: ref.replace(projectId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), error: null }; } }, projectId, 'production');
  await assert.rejects(() => wrong.setSecret('stripe', 'secretKey', 'private-value'), /does not match/);
  const failed = createWebsiteProjectSecretWriter({ async rpc() { return { data: null, error: { message: 'private-value must stay hidden' } }; } }, projectId, 'production');
  await assert.rejects(() => failed.setSecret('stripe', 'secretKey', 'private-value'), error => !error.message.includes('private-value'));
  const connection = { id: 'stripe', providerId: 'stripe', name: 'Stripe', enabled: true, status: 'disconnected',
    environments: ['production'], config: { publishableKey: 'pk_test_fixture' }, secrets: {}, events: [],
    createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z' };
  let config = { version: 1, connections: [connection] };
  const save = (overrides = {}) => saveWebsiteIntegrationSecret({
    client, projectId, connectionId: 'stripe', field: 'secretKey', value: 'private-value',
    getConfig: () => config, isCurrentProject: () => true, apply(next) { config = next; }, ...overrides,
  });
  await save();
  assert.equal(config.connections[0].secrets.secretKey.ref, ref);
  assert.ok(!JSON.stringify(config).includes('private-value'), 'Snapshots only receive an opaque reference');
  const beforeGuard = calls.length;
  config = { version: 1, connections: [{ ...connection, environments: ['preview', 'production'] }] };
  await assert.rejects(save, /one integration environment/);
  assert.equal(calls.length, beforeGuard, 'Ambiguous environment never reaches Vault');
  config = { version: 1, connections: [connection] };
  await assert.rejects(save({ isCurrentProject: () => false }), /project changed/);
  assert.equal(config.connections[0].secrets.secretKey, undefined, 'Stale project never receives the reference');
  const original = config;
  await assert.rejects(save({ getConfig: () => { const result = config; config = { ...config }; return result; } }), /project changed/);
  assert.notEqual(config, original, 'Concurrent editor changes invalidate the in-flight result');
  config = { version: 1, connections: [{ ...connection, secrets: { secretKey: { ref } } }] };
  const inspect = (data, overrides = {}) => inspectWebsiteIntegrationSecrets({
    client: { async rpc(name, args) { assert.equal(name, 'website_project_secret_refs'); assert.deepEqual(args, { p_project_id: projectId }); return { data, error: null }; } },
    projectId, getConfig: () => config, isCurrentProject: () => true, ...overrides,
  });
  const record = (reference, connectionId = 'stripe', field = 'secretKey') => ({ ref: reference, connection_id: connectionId, field, environment: 'production' });
  assert.deepEqual(await inspect([record(ref)]), { configured: 1, missing: 0, unlinked: 0 });
  assert.deepEqual(await inspect([]), { configured: 0, missing: 1, unlinked: 0 });
  assert.deepEqual(await inspect([record(ref), record(`secret://website/${projectId}/unused/key/production`, 'unused', 'key')]), { configured: 1, missing: 0, unlinked: 1 });
  config = { version: 1, connections: [{ ...connection, secrets: { secretKey: { ref: ref.replace(projectId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') } } }] };
  assert.deepEqual(await inspect([record(ref)]), { configured: 0, missing: 1, unlinked: 1 });
  await assert.rejects(inspect([record(ref.replace(projectId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'))]), /could not be checked/);
  await assert.rejects(inspect([record(ref), record(ref)]), /could not be checked/);
  await assert.rejects(inspect([record(ref)], { isCurrentProject: () => false }), /Project changed/);
  const snapshot = config;
  await assert.rejects(inspect([record(ref)], { getConfig() { const result = config; config = { ...config }; return result; } }), /Project changed/);
  assert.notEqual(config, snapshot, 'An in-flight inventory cannot describe a newer editor snapshot');
  console.log('PASS project secret writer: target validation, owner RPC payload, scoped opaque reference and safe errors');
} finally { await rm(dir, { recursive: true, force: true }); }
