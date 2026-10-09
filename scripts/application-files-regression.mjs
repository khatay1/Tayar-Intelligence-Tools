import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-files-')), originalFetch = globalThis.fetch;
globalThis.crypto ??= webcrypto;
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const recordId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', fileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-validation', 'application-schema-sql', 'application-files-sql', 'application-files-runtime',
    'application-data-view', 'application-data-view-controller', 'application-requirements'].map(name =>
    `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n')
    + `\nexport * from ${JSON.stringify(resolve('server/website-owned-files-catalog'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate,
    applicationFilesManifest: manifest, verifyOwnedFilesCatalog: verify, createApplicationFilesRuntime: runtime,
    compileApplicationDataView: view, applicationRequirementIssues: requirements, createApplicationDataViewController: controller } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const table = { id: 'documents', key: 'documents', name: 'Documents', fields: [{ id: 'title', key: 'title', name: 'Title', type: 'text', required: true }],
    permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })),
    attachments: { maxBytes: 1024, mimeTypes: ['application/pdf'] } };
  const app = { version: 1, tables: [table], roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true } };
  const binding = { tableId: table.id, columns: ['title'], pageSize: 10, actions: ['attachments'] };
  validate(app); view(app, binding);
  for (const attachments of [{ maxBytes: 0, mimeTypes: ['application/pdf'] }, { maxBytes: 1024, mimeTypes: ['image/svg+xml'] },
    { maxBytes: 1024, mimeTypes: ['application/pdf', 'application/pdf'] }, { maxBytes: 26214401, mimeTypes: ['application/pdf'] },
    { maxBytes: 1024, mimeTypes: ['application/pdf'], credentials: 'forbidden' }]) assert.throws(() => validate({ ...app, tables: [{ ...table, attachments }] }));
  assert.throws(() => view({ ...app, tables: [{ ...table, attachments: undefined }] }, binding));
  const noFiles = { ...app, tables: [{ ...table, attachments: undefined }] };
  const sql = compile(app).join('\n'), additive = migrate(noFiles, app).join('\n');
  assert.match(sql, /storage.buckets.*false, 1024/); assert.match(sql, /as restrictive for UPDATE/);
  assert.match(additive, /insert into storage.buckets/);
  assert.throws(() => migrate(app, noFiles), /reviewed storage migration/);
  const changed = { ...app, tables: [{ ...table, permissions: [...table.permissions, { operation: 'read', access: 'authenticated' }] }] };
  assert.match(migrate(app, changed).join('\n'), /create or replace function private.app_files_0_access/);
  const withManifest = { ...app, requirements: { version: 1, request: 'Upload documents', items: [{ id: 'req-files', summary: 'Attach files', capability: 'files', evidence: ['files:documents'] }] } };
  validate(withManifest);
  assert.deepEqual(requirements(withManifest, [{ id: 'dashboard', sections: [{ applicationDataView: binding }] }]), []);
  assert.equal(requirements(withManifest, [{ id: 'dashboard', sections: [] }]).length, 1);

  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  let identity = owner, closed = false, requests = [], stored = new Map(), lost = false, switchAfterResponse = false;
  const auth = { auth: { getSession: async () => ({ data: { session: { user: { id: identity } } }, error: null }) } };
  const token = 'captured-customer-token';
  const files = runtime(backend, auth, id => { assert.equal(id, table.id); return table; }, async id => {
    if (id !== identity) throw Error('identity changed'); return token;
  }, () => closed);
  const blob = new Blob(['%PDF-fixture'], { type: 'application/pdf' });
  globalThis.fetch = async (resource, init) => {
    const url = new URL(String(resource)), headers = new Headers(init.headers);
    assert.equal(url.origin, backend.url); assert.equal(headers.get('authorization'), `Bearer ${token}`);
    requests.push({ url, method: init.method });
    const key = `${recordId}/${fileId}`;
    if (url.pathname.endsWith('/list/app_files_documents')) {
      const options = JSON.parse(init.body); assert.equal(options.prefix, recordId); assert.equal(options.limit, 21);
      return Response.json(Array.from({ length: 21 }, (_, index) => ({ id: `${index}`, name: fileId, metadata: { size: blob.size } })));
    }
    if (init.method === 'POST') {
      assert.equal(headers.get('x-upsert'), 'false');
      if (stored.has(key)) return Response.json({ message: 'exists' }, { status: 409 });
      stored.set(key, blob); if (lost) return Response.json({ message: 'response lost' }, { status: 503 });
      return Response.json({ Key: key });
    }
    if (init.method === 'GET') {
      if (switchAfterResponse) identity = other;
      return new Response(stored.get(key), { headers: { 'content-type': 'application/pdf' } });
    }
    if (init.method === 'DELETE') { stored.delete(key); return Response.json([]); }
    throw Error('Unexpected storage request');
  };
  await assert.rejects(files.upload(table.id, recordId, fileId, new Blob(['x'], { type: 'text/html' }), owner), /type or size/);
  await assert.rejects(files.upload(table.id, '../bad', fileId, blob, owner), /identity/);
  assert.equal(requests.length, 0, 'Invalid attachments never reach Storage');
  lost = true; await files.upload(table.id, recordId, fileId, blob, owner);
  await files.upload(table.id, recordId, fileId, blob, owner); assert.equal(stored.size, 1, 'Retry cannot duplicate immutable files');
  await assert.rejects(files.upload(table.id, recordId, fileId, new Blob(['different'], { type: 'application/pdf' }), owner), /uncertain|different bytes/);
  const listing = await files.list(table.id, recordId, owner, 1); assert.equal(listing.files.length, 20); assert.equal(listing.hasNext, true);
  const downloaded = await files.download(table.id, recordId, fileId, owner); assert.equal(downloaded.type, 'application/octet-stream'); assert.equal(await downloaded.text(), await blob.text());
  switchAfterResponse = true; await assert.rejects(files.download(table.id, recordId, fileId, owner), /identity changed/);
  switchAfterResponse = false; identity = owner; await files.remove(table.id, recordId, fileId, owner); assert.equal(stored.size, 0);
  closed = true; const count = requests.length; await assert.rejects(files.list(table.id, recordId, owner), /identity changed/); assert.equal(requests.length, count);
  // Read-only accounts can open the panel, but writes never reach Storage.
  const readerApp = { ...app, tables: [{ ...table, permissions: [{ operation: 'read', access: 'authenticated' }, { operation: 'update', access: 'role', roleId: 'manager' }] }], roles: [{ id: 'manager', name: 'Manager' }] };
  let writes = 0;
  const readController = controller(readerApp, binding, { auth: { currentUser: async () => ({ id: owner }), currentRoles: async () => [] },
    files: { list: async () => ({ files: [], hasNext: false }), upload: async () => { writes++; } } }, () => fileId);
  assert.deepEqual(await readController.permissions(), ['attachments']); assert.equal(await readController.fileWritesAllowed(), false);
  await readController.listFiles(recordId); await assert.rejects(readController.uploadFile(recordId, fileId, blob), /not permitted/); assert.equal(writes, 0);
  console.log('PASS attachments: strict schema, migration/evidence, pinned Storage JWT, immutable retry, download-only, stale-account rejection and reader controls');

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tayar_booking_test') throw Error('Isolated local fixture database required');
    const query = sql => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject);
      child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(sql);
    });
    await query(`drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;
      drop schema if exists storage cascade; create schema storage; grant usage on schema storage to anon,authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
      alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to anon,authenticated;`);
    await query(sql);
    await query(`create or replace function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous',coalesce(nullif(current_setting('request.jwt.claim.is_anonymous',true),''),'false')::boolean) $$;`);
    const asUser = (id, anon = false) => `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claim.is_anonymous','${anon}',false);`;
    await query(`${asUser(owner)} insert into public.app_documents(id,title) values('${recordId}','Invoice');
      insert into storage.objects(bucket_id,name,owner_id) values('app_files_documents','${recordId}/${fileId}','${owner}');`);
    const catalog = async sql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${sql}) x;`));
    assert.equal(await verify(app, catalog), true, 'Actual private bucket, invoker body and restrictive policy catalog');
    assert.equal(await query(`${asUser(other)} select count(*) from storage.objects;`), `22222222-2222-4222-8222-222222222222\nfalse\n0`);
    await assert.rejects(query(`${asUser(other)} insert into storage.objects(bucket_id,name,owner_id) values('app_files_documents','${recordId}/cccccccc-cccc-4ccc-8ccc-cccccccccccc','${other}');`), /row-level security/);
    await query(`${asUser(owner)} update storage.objects set name='${recordId}/cccccccc-cccc-4ccc-8ccc-cccccccccccc';`);
    assert.equal(await query('select name from storage.objects;'), `${recordId}/${fileId}`, 'RLS hides immutable objects from UPDATE');
    // A broad customer policy cannot bypass the generated restrictive guard.
    await query('create policy customer_broad on storage.objects for all to public using(true) with check(true);');
    await query(`insert into storage.objects(bucket_id,name,owner_id) values('other_bucket','public-file',null);`);
    assert.equal((await query('set role anon; select count(*) from storage.objects;')).split('\n').at(-1), '1', 'Restrictive guards preserve unrelated bucket access');
    await query(`delete from storage.objects where bucket_id='other_bucket';`);
    assert.equal((await query(`${asUser(other)} select count(*) from storage.objects;`)).split('\n').at(-1), '0');
    assert.equal((await query(`${asUser(owner, true)} select count(*) from storage.objects;`)).split('\n').at(-1), '0');
    await assert.rejects(query(`${asUser(other)} insert into storage.objects(bucket_id,name,owner_id) values('app_files_documents','${recordId}/cccccccc-cccc-4ccc-8ccc-cccccccccccc','${other}');`), /row-level security/);
    await query(`update storage.buckets set public=true;`); assert.equal(await verify(app, catalog), false);
    await query('update storage.buckets set public=false; drop policy app_files_0_select_guard on storage.objects;'); assert.equal(await verify(app, catalog), false);
    assert.equal(manifest(app)[0].policies.length, 7);
    console.log('PASS PostgreSQL attachments: owner/foreign/anonymous isolation, broad-policy bypass blocked and tampered catalog rejected');
  }
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
