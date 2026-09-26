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
  const { createWebsiteProjectSecretWriter } = (await import(pathToFileURL(outfile))).default;
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
  console.log('PASS project secret writer: target validation, owner RPC payload, scoped opaque reference and safe errors');
} finally { await rm(dir, { recursive: true, force: true }); }
