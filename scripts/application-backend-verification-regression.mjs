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
  const { assertApplicationBackendRevision, assertApplicationFormRequestCapability, applicationDefinitionDigest } = (await import(pathToFileURL(outfile))).default;
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [{ id: 'bookings', key: 'bookings', name: 'Bookings', fields: [], permissions: [{ operation: 'read', access: 'authenticated' }] }], pageAccess: [] };
  const reordered = { pageAccess: [], tables: structuredClone(app.tables), roles: [], auth: { ...app.auth }, version: 1 };
  assert.equal(await applicationDefinitionDigest(app), await applicationDefinitionDigest(reordered), 'Digest agrees across JSONB key order');
  assert.notEqual(await applicationDefinitionDigest(app), await applicationDefinitionDigest({ ...app, tables: [] }), 'Schema edits change the link revision');
  let reads = 0;
  const reader = { url: backend.url, async readDeployedDefinition() { reads += 1; return { pageAccess: [], tables: structuredClone(app.tables), roles: [], auth: { ...app.auth }, version: 1 }; } };
  await assertApplicationBackendRevision(app, backend, platformUrl, reader);
  assert.equal(reads, 1, 'JSONB object key order does not change an exact definition');
  await assert.rejects(() => assertApplicationBackendRevision(app, { ...backend, url: platformUrl, projectRef: 'pnbllxdlskljcakyaylt' }, platformUrl, reader), /identity/);
  await assert.rejects(() => assertApplicationBackendRevision(app, backend, platformUrl, { ...reader, url: platformUrl }), /another backend/);
  assert.equal(reads, 1, 'Wrong backend identity fails before any service query');
  await assert.rejects(() => assertApplicationBackendRevision(app, backend, platformUrl, { ...reader, async readDeployedDefinition() { return { ...app, tables: [] }; } }), /does not match/);
  await assert.rejects(() => assertApplicationBackendRevision(app, backend, platformUrl, { ...reader, async readDeployedDefinition() { return null; } }), /could not be verified/);
  const serviceOutfile = join(dir, 'service.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationBackendService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: serviceOutfile });
  const { recordVerifiedWebsiteApplicationBackend, createDedicatedApplicationRevisionReader, verifySavedWebsiteApplicationBackend } = (await import(pathToFileURL(serviceOutfile))).default;
  const serviceKey = `a.${Buffer.from(JSON.stringify({ iss: 'supabase', ref: backend.projectRef, role: 'service_role' })).toString('base64url')}.signature`;
  const wrongKey = `a.${Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'pnbllxdlskljcakyaylt', role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => createDedicatedApplicationRevisionReader(backend, platformUrl, backend.publishableKey), /service credential/);
  assert.throws(() => createDedicatedApplicationRevisionReader(backend, platformUrl, wrongKey), /service credential/);
  const originalFetch = globalThis.fetch;
  const revisionRequests = [];
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    revisionRequests.push({ url, init });
    return new Response(JSON.stringify(url.endsWith('/app_form_request_revision') ? 2 : app), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const remoteReader = createDedicatedApplicationRevisionReader(backend, platformUrl, serviceKey);
    await assertApplicationBackendRevision(app, backend, platformUrl, remoteReader);
    await assertApplicationFormRequestCapability(backend, platformUrl, remoteReader);
    await assert.rejects(() => assertApplicationFormRequestCapability(backend, platformUrl, { ...reader, async readFormRequestRevision() { return 1; } }), /unavailable/, 'Version 1 has no durable deletion tombstone');
    assert.match(revisionRequests[1].url, /\/rest\/v1\/rpc\/app_form_request_revision$/);
    assert.equal(revisionRequests[1].init.redirect, 'error');
    await assert.rejects(() => assertApplicationFormRequestCapability(backend, platformUrl, reader), /unavailable/);
    await assert.rejects(() => assertApplicationFormRequestCapability(backend, platformUrl, { ...remoteReader, url: platformUrl }), /unavailable|identity/);
    assert.match(revisionRequests[0].url, /^https:\/\/sgewokeojtzsqjaeluan\.supabase\.co\/rest\/v1\/rpc\/app_deployed_definition/);
    assert.doesNotMatch(revisionRequests[0].url, /pnbllxdlskljcakyaylt/);
    assert.equal(revisionRequests[0].init.redirect, 'error', 'Never forward service credentials through redirects');
    assert.ok(revisionRequests[0].init.signal instanceof AbortSignal, 'Service requests have a deadline');
    globalThis.fetch = async () => { throw new Error(`network ${serviceKey}`); };
    await assert.rejects(() => remoteReader.readDeployedDefinition(), error => error.message === 'Dedicated application revision is unavailable.');
    globalThis.window = {};
    try { assert.throws(() => createDedicatedApplicationRevisionReader(backend, platformUrl, serviceKey), /server runtime/); }
    finally { delete globalThis.window; }
  } finally { globalThis.fetch = originalFetch; }
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const calls = [];
  const platform = { async rpc(name, args) { calls.push({ name, args }); return { error: null }; } };
  const input = { platform, platformUrl, projectId, definition: app, backend, revisionReader: reader };
  await recordVerifiedWebsiteApplicationBackend(input);
  assert.equal(calls[0].name, 'website_record_application_backend');
  assert.deepEqual(calls[0].args, { p_project_id: projectId, p_backend_ref: backend.projectRef, p_publishable_key: backend.publishableKey, p_deployed_definition: app });
  await assert.rejects(() => recordVerifiedWebsiteApplicationBackend({ ...input, projectId: 'wrong' }), /Invalid Tayar project/);
  await assert.rejects(() => recordVerifiedWebsiteApplicationBackend({ ...input, revisionReader: { ...reader, async readDeployedDefinition() { return { ...app, tables: [] }; } } }), /does not match/);
  assert.equal(calls.length, 1, 'Invalid or stale backend must not reach platform registration');
  await assert.rejects(() => recordVerifiedWebsiteApplicationBackend({ ...input, platform: { async rpc() { return { error: { message: 'private-key-leak' } }; } } }), error => !error.message.includes('private-key-leak'));
  const mutableInput = { ...input, backend: { ...backend }, definition: structuredClone(app) };
  mutableInput.revisionReader = { url: backend.url, async readDeployedDefinition() {
    mutableInput.projectId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    mutableInput.backend.projectRef = 'pnbllxdlskljcakyaylt';
    mutableInput.definition.tables = [];
    return app;
  } };
  await recordVerifiedWebsiteApplicationBackend(mutableInput);
  assert.deepEqual(calls.at(-1).args, calls[0].args, 'Async input mutation cannot redirect a verified registration');
  await assert.rejects(() => recordVerifiedWebsiteApplicationBackend({ ...input, platform: { async rpc() { throw new Error(serviceKey); } } }), error => !error.message.includes(serviceKey));
  globalThis.fetch = async () => new Response(JSON.stringify({ external: { email: true, anonymous_users: false }, disable_signup: false, mailer_autoconfirm: false }));
  let bindingReads = 0;
  let remoteReads = 0;
  let credentialReads = 0;
  const binding = { ...backend, deployedDefinition: app, verifiedAt: '2000-01-01T00:00:00Z' };
  const verifyInput = {
    projectId, platformUrl, definition: app,
    platform: { async rpc(name, args) {
      assert.equal(name, 'website_application_backend_record');
      assert.deepEqual(args, { p_project_id: projectId });
      bindingReads += 1;
      return { data: structuredClone(binding), error: null };
    } },
    async createRevisionReader(config) {
      credentialReads += 1;
      assert.deepEqual(config, backend);
      return { url: config.url, async readDeployedDefinition() { remoteReads += 1; return app; } };
    },
  };
  assert.deepEqual(await verifySavedWebsiteApplicationBackend(verifyInput), backend);
  assert.equal(bindingReads, 2, 'Reread the binding after remote verification');
  assert.equal(remoteReads, 1, 'A stored timestamp never substitutes for a live revision read');
  for (const invalid of [null, [], { ...binding, deployedDefinition: { ...app, tables: [] } }, { ...binding, projectRef: 'pnbllxdlskljcakyaylt', url: platformUrl }]) {
    await assert.rejects(() => verifySavedWebsiteApplicationBackend({ ...verifyInput, platform: { async rpc() { return { data: invalid, error: null }; } } }));
  }
  assert.equal(credentialReads, 1, 'Do not resolve credentials for invalid or stale bindings');
  await assert.rejects(() => verifySavedWebsiteApplicationBackend({ ...verifyInput, createRevisionReader: async () => ({ url: backend.url, async readDeployedDefinition() { return { ...app, tables: [] }; } }) }), /does not match/);
  await assert.rejects(() => verifySavedWebsiteApplicationBackend({ ...verifyInput, createRevisionReader: async () => { throw new Error(serviceKey); } }), error => error.message === 'Dedicated application credentials are unavailable.');
  for (const changed of [null, { ...binding, publishableKey: 'sb_publishable_rotated' }, { ...binding, deployedDefinition: { ...app, tables: [] } }]) {
    let attempts = 0;
    await assert.rejects(() => verifySavedWebsiteApplicationBackend({ ...verifyInput, platform: { async rpc() { return { data: attempts++ ? changed : binding, error: null }; } } }));
    assert.equal(attempts, 2, 'Concurrent deletion, key rotation or schema changes fail closed');
  }
  for (const platform of [
    { async rpc() { throw new Error(serviceKey); } },
    { async rpc() { return { data: binding, error: { message: serviceKey } }; } },
  ]) await assert.rejects(() => verifySavedWebsiteApplicationBackend({ ...verifyInput, platform }), error => error.message === 'Saved application backend is unavailable.');
  globalThis.fetch = originalFetch;
  console.log('PASS backend revision preflight: isolated identity, service reader target, exact definition and stale/invalid denial');
} finally { await rm(dir, { recursive: true, force: true }); }
