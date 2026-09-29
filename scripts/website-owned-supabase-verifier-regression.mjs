import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-owned-backend-'));
const oldFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'verifier.cjs');
  await build({ entryPoints: ['server/website-owned-supabase-verifier.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { verifyOwnedSupabaseApplicationRuntime: verify } = (await import(pathToFileURL(outfile))).default;
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan',
    publishableKey: 'sb_publishable_customer_fixture' };
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    roles: [], tables: [{ id: 'bookings', key: 'bookings', name: 'Bookings', fields: [],
      permissions: [{ operation: 'read', access: 'owner' }] }], pageAccess: [] };
  let revision = app, formRevision = 2, security = true, securityReads = 0, authReads = 0;
  const reader = { url: backend.url, async readDeployedDefinition() { return revision; },
    async readFormRequestRevision() { return formRevision; },
    async verifyLiveSecurity(definition) { securityReads++;
      assert.equal(definition.tables[0].key, 'bookings'); return security; } };
  globalThis.fetch = async (url, init) => {
    authReads++;
    assert.equal(url, `${backend.url}/auth/v1/settings`);
    assert.equal(init.headers.apikey, backend.publishableKey);
    return Response.json({ external: { email: true, anonymous_users: false },
      disable_signup: false, mailer_autoconfirm: false });
  };
  const input = { definition: app, backend, expectedProjectRef: backend.projectRef, reader, formsRequired: true };
  await verify(input);
  assert.equal(securityReads, 1); assert.equal(authReads, 1);
  await assert.rejects(verify({ ...input, expectedProjectRef: 'aaaaaaaaaaaaaaaaaaaa' }), /identity/);
  await assert.rejects(verify({ ...input, reader: { ...reader, url: 'https://evil.example' } }), /security verification/);
  assert.equal(authReads, 1, 'Wrong target fails before any remote call');
  revision = { ...app, tables: [] };
  await assert.rejects(verify(input), /does not match/);
  revision = app;
  formRevision = 1;
  await assert.rejects(verify(input), /capability/);
  formRevision = 2;
  security = false;
  await assert.rejects(verify(input), /RLS and grants/);
  security = true;
  await assert.rejects(verify({ ...input, reader: { ...reader, verifyLiveSecurity: undefined } }), /security verification/);
  globalThis.fetch = async () => Response.json({ external: { email: true, anonymous_users: true },
    disable_signup: false, mailer_autoconfirm: false });
  await assert.rejects(verify(input), /do not match/);
  console.log('PASS owned Supabase preflight: exact project/definition, Auth, form revision and mandatory catalog security proof');
} finally { globalThis.fetch = oldFetch; await rm(dir, { recursive: true, force: true }); }
