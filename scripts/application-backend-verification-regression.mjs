import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-backend-revision-'));
try {
  const outfile = join(dir, 'verification.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-backend-verification.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { assertApplicationBackendRevision } = (await import(pathToFileURL(outfile))).default;
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [{ id: 'bookings', key: 'bookings', name: 'Bookings', fields: [], permissions: [{ operation: 'read', access: 'authenticated' }] }], pageAccess: [] };
  let reads = 0;
  const reader = { url: backend.url, async readDeployedDefinition() { reads += 1; return { pageAccess: [], tables: structuredClone(app.tables), roles: [], auth: { ...app.auth }, version: 1 }; } };
  await assertApplicationBackendRevision(app, backend, platformUrl, reader);
  assert.equal(reads, 1, 'JSONB object key order does not change an exact definition');
  await assert.rejects(() => assertApplicationBackendRevision(app, { ...backend, url: platformUrl, projectRef: 'pnbllxdlskljcakyaylt' }, platformUrl, reader), /identity/);
  await assert.rejects(() => assertApplicationBackendRevision(app, backend, platformUrl, { ...reader, url: platformUrl }), /another backend/);
  assert.equal(reads, 1, 'Wrong backend identity fails before any service query');
  await assert.rejects(() => assertApplicationBackendRevision(app, backend, platformUrl, { ...reader, async readDeployedDefinition() { return { ...app, tables: [] }; } }), /does not match/);
  await assert.rejects(() => assertApplicationBackendRevision(app, backend, platformUrl, { ...reader, async readDeployedDefinition() { return null; } }), /could not be verified/);
  console.log('PASS backend revision preflight: isolated identity, service reader target, exact definition and stale/invalid denial');
} finally { await rm(dir, { recursive: true, force: true }); }
