import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const require = createRequire(import.meta.url), dir = await mkdtemp(join(tmpdir(), 'tayar-data-view-'));
const originalFetch = globalThis.fetch;
const owner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', other = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const recordId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
try {
  await build({ entryPoints: ['src/modules/website-builder/core/application-data-view.ts', 'src/modules/website-builder/core/application-data-view-controller.ts',
    'src/modules/website-builder/core/application-data-runtime.ts', 'src/modules/website-builder/core/application-published-data-views.ts',
    'src/modules/website-builder/core/website-builder-rendering.ts', 'src/modules/website-builder/core/editor-native-operation.ts',
    'src/modules/website-builder/core/editor-command.ts', 'src/modules/website-builder/core/editor-operation-policy.ts', 'src/modules/website-builder/core/editor-history.ts'],
    bundle: true, platform: 'node', format: 'cjs', outdir: dir, alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' } });
  const { compileApplicationDataView, parseApplicationDataViewValues } = require(join(dir, 'application-data-view.js'));
  const { createApplicationDataViewController } = require(join(dir, 'application-data-view-controller.js'));
  const { createOwnedApplicationDataRuntime } = require(join(dir, 'application-data-runtime.js'));
  const { preparePublishedApplicationDataViews } = require(join(dir, 'application-published-data-views.js'));
  const { sectionToHtml } = require(join(dir, 'website-builder-rendering.js'));
  const { adaptEditorNativeOperation } = require(join(dir, 'editor-native-operation.js'));
  const { runEditorCommand } = require(join(dir, 'editor-command.js'));
  const { createEditorHistory } = require(join(dir, 'editor-history.js'));
  const { preflightEditorNativeOperations } = require(join(dir, 'editor-operation-policy.js'));
  const fields = [
    { id: 'record_name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'record_amount', key: 'amount', name: 'Amount', type: 'number', required: true },
    { id: 'record_active', key: 'active', name: 'Active', type: 'boolean', required: true },
    { id: 'record_state', key: 'state', name: 'State', type: 'enum', options: ['open', 'closed'], required: true },
    { id: 'record_date', key: 'due', name: 'Due', type: 'date', required: false },
    { id: 'record_meta', key: 'meta', name: 'Metadata', type: 'json', required: false },
  ];
  const app = { version: 1, roles: [{ id: 'admin', name: 'Admin' }], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    tables: [{ id: 'records', key: 'records', name: 'Records', fields, permissions: [
      ...['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })), { operation: 'delete', access: 'role', roleId: 'admin' },
    ] }] };
  const binding = { tableId: 'records', columns: fields.map(field => field.id), actions: ['create', 'update', 'delete'], pageSize: 2, searchFieldId: 'record_name' };
  assert.equal(compileApplicationDataView(app, binding).table.key, 'records');
  for (const invalid of [{ ...binding, credentials: 'forbidden' }, { ...binding, columns: ['owner_id'] }, { ...binding, columns: ['record_name', 'record_name'] },
    { ...binding, pageSize: 51 }, { ...binding, searchFieldId: 'record_amount' }, { ...binding, actions: ['execute'] }, { ...binding, tableId: 'missing' }]) assert.throws(() => compileApplicationDataView(app, invalid));
  assert.throws(() => compileApplicationDataView({ ...app, auth: { ...app.auth, enabled: false, signUpEnabled: false } }, binding));
  const input = { name: 'Invoice <script>', amount: '12.5', active: 'false', state: 'open', due: '2026-10-09', meta: '{"safe":true}' };
  const parsed = parseApplicationDataViewValues(app.tables[0], input, true);
  assert.equal(parsed.amount, 12.5); assert.equal(parsed.active, false); assert.deepEqual(parsed.meta, { safe: true });
  for (const invalid of [{ ...input, due: '2026-02-31' }, { ...input, amount: 'Infinity' }, { ...input, active: 'yes' }, { ...input, state: 'invalid' },
    { ...input, meta: '{broken' }, { ...input, name: '' }, { ...input, owner_id: other }]) assert.throws(() => parseApplicationDataViewValues(app.tables[0], invalid, true));
  const section = { id: 'records-section', type: 'features', title: 'Records', description: '', buttonText: '', buttonUrl: '', background: '#ffffff', accent: '#123456', elements: [{ id: 'record-heading', type: 'heading', content: 'Records', style: {} }], applicationDataView: binding };
  const prepared = preparePublishedApplicationDataViews(app, 'dashboard', [section]);
  assert.equal(prepared[0].sectionId, section.id); assert.deepEqual(prepared[0].binding, binding);
  assert.throws(() => preparePublishedApplicationDataViews(app, 'dashboard', [section, section]));
  assert.throws(() => preparePublishedApplicationDataViews(app, 'dashboard', [{ ...section, type: 'contact' }]));
  const html = sectionToHtml(section, 'home', undefined, 'ar');
  assert.match(html, /data-tayar-data-view-id="records-section"/); assert.doesNotMatch(html, /Invoice/);
  const project = { pages: [{ id: 'dashboard', sections: [{ ...section, applicationDataView: undefined }] }] };
  const operation = { action: 'update_section', source: 'manual', pageId: 'dashboard', sectionId: section.id, changes: { applicationDataView: binding } };
  assert.equal(preflightEditorNativeOperations([operation], { project }).ok, true);
  const changed = runEditorCommand(project, adaptEditorNativeOperation(operation).command, { history: createEditorHistory() });
  assert.equal(changed.transaction.ok, true); assert.deepEqual(changed.project.pages[0].sections[0].applicationDataView, binding);
  assert.equal(project.pages[0].sections[0].applicationDataView, undefined, 'Native edit preserves the previous snapshot');
  assert.equal(preflightEditorNativeOperations([{ ...operation, changes: { applicationDataView: { ...binding, token: 'forbidden' } } }], { project }).ok, false);

  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  let userId = owner, roles = [], rows = [], calls = [], insertCount = 0, uncertain = false, revealUncertain = true, switchAfterList = false;
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  const relatedRows = Array.from({ length: 25 }, (_, index) => ({ id: `${String(index).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, name: `Resource ${index}`, secretNote: 'must-not-leave-reference-options' }));
  let switchAfterReference = false;
  globalThis.fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    assert.equal(url.origin, backend.url, 'All SDK requests must use the isolated customer backend');
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'refresh-fixture', token_type: 'bearer', expires_in: 3600, user: { id: userId, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: userId, is_anonymous: false });
    if (url.pathname === '/rest/v1/rpc/app_my_roles') return Response.json(roles);
    if (url.pathname === '/rest/v1/app_resources') {
      const filtered = url.searchParams.has('name') ? relatedRows.filter(row => row.name === 'Resource 24') : relatedRows;
      const result = filtered.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 100));
      if (switchAfterReference) userId = other;
      return Response.json(result);
    }
    assert.equal(url.pathname, '/rest/v1/app_records');
    if (init?.method === 'POST') {
      const values = JSON.parse(init.body); insertCount++;
      if (rows.some(row => row._tayar_request_id === values._tayar_request_id)) return Response.json({ code: '23505', message: 'duplicate request' }, { status: 409 });
      rows.push({ ...values, id: recordId, owner_id: userId });
      if (uncertain) throw new TypeError('Lost response after database commit');
      return new Response(null, { status: 201 });
    }
    if (init?.method === 'PATCH') { const row = rows.find(row => `eq.${row.id}` === url.searchParams.get('id') && row.owner_id === userId); if (row) Object.assign(row, JSON.parse(init.body)); return Response.json(row ?? null); }
    if (init?.method === 'DELETE') { if (!roles.includes('admin')) return Response.json(null); const row = rows.find(row => `eq.${row.id}` === url.searchParams.get('id')); rows = rows.filter(item => item !== row); return Response.json(row ? { id: row.id } : null); }
    if (url.searchParams.has('_tayar_request_id')) return Response.json(revealUncertain ? rows.find(row => `eq.${row._tayar_request_id}` === url.searchParams.get('_tayar_request_id') && `eq.${row.owner_id}` === url.searchParams.get('owner_id')) ?? null : null);
    const owned = rows.filter(row => row.owner_id === userId);
    const result = owned.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 100));
    if (switchAfterList) userId = other;
    return Response.json(result);
  };
  const runtime = createOwnedApplicationDataRuntime(app, backend, backend.projectRef);
  try {
    await runtime.auth.signIn('owner@example.com', 'fixture-password');
    const beforeWrongIdentity = calls.length;
    await assert.rejects(runtime.update('records', recordId, parsed, other), /identity changed/);
    await assert.rejects(runtime.remove('records', recordId, other), /identity changed/);
    assert.ok(!calls.slice(beforeWrongIdentity).some(call => ['PATCH', 'DELETE'].includes(call.method)), 'Wrong account cannot start a mutation');
    const controller = createApplicationDataViewController(app, binding, runtime, () => '11111111-1111-4111-8111-111111111111');
    assert.deepEqual(await controller.permissions(), ['create', 'update']);
    await controller.create(input); assert.equal(rows.length, 1);
    assert.equal((await controller.load()).rows[0].amount, 12.5);
    await controller.update(recordId, { ...input, amount: '20' }); assert.equal(rows[0].amount, 20);
    const deletes = calls.filter(call => call.method === 'DELETE').length;
    await assert.rejects(controller.remove(recordId), /not permitted/);
    assert.equal(calls.filter(call => call.method === 'DELETE').length, deletes, 'Forbidden actions never reach the backend');
    roles = ['admin']; await controller.remove(recordId); assert.equal(rows.length, 0);
    await controller.load(1, '%_');
    const search = calls.findLast(call => call.url.searchParams.has('name')).url;
    assert.equal(search.searchParams.get('name'), 'ilike.%\\%\\_%'); assert.equal(search.searchParams.get('offset'), '2'); assert.equal(search.searchParams.get('limit'), '3');
    uncertain = true; revealUncertain = false;
    await assert.rejects(controller.create(input), /uncertain/); assert.equal(rows.length, 1);
    uncertain = false; revealUncertain = true; await controller.create(input);
    assert.equal(rows.length, 1, 'Retry reconciles the same request instead of creating another record'); assert.equal(insertCount, 3);
    switchAfterList = true; await assert.rejects(controller.load(), /identity changed/);
    assert.equal(controller.closed(), true);
    await assert.rejects(controller.update(recordId, input), /closed/);
    controller.dispose();
    userId = owner; switchAfterList = false; rows = []; uncertain = true; revealUncertain = false;
    const storage = new Map();
    const scope = { keyPrefix: 'tayar-app-form:sgewokeojtzsqjaeluan:project:dashboard:data:records', crypto: webcrypto,
      storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
    const durable = () => createApplicationDataViewController(app, binding, runtime, () => recordId, scope);
    const beforeReload = durable(); await assert.rejects(beforeReload.create(input), /uncertain/);
    const identityOnly = [...storage.values()][0]; assert.doesNotMatch(identityOnly, /Invoice|12\.5|safe/);
    beforeReload.dispose(); revealUncertain = true; uncertain = false;
    const afterReload = durable(); await afterReload.create(input);
    assert.equal(rows.length, 1, 'Pending create identity survives view recreation without duplicating a committed row'); assert.equal(storage.size, 0);
    afterReload.dispose();
    const failedStorage = createApplicationDataViewController(app, binding, runtime, () => recordId, {
      ...scope, storage: { ...scope.storage, setItem() { throw new Error('Storage unavailable'); } },
    });
    const beforeWrites = insertCount; await assert.rejects(failedStorage.create(input), /identity is unavailable/);
    assert.equal(insertCount, beforeWrites, 'No create request is sent when durable request identity cannot be saved'); failedStorage.dispose();
  } finally { runtime.dispose(); }
  userId = owner; roles = [];
  const relatedApp = structuredClone(app);
  relatedApp.tables[0].fields.push({ id: 'record_resource', key: 'resource_id', name: 'Resource', type: 'reference', required: true, referenceTableId: 'resources' });
  relatedApp.tables.push({ id: 'resources', key: 'resources', name: 'Resources', fields: [{ id: 'resource_name', key: 'name', name: 'Name', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'role', roleId: 'admin' }] });
  const noRead = structuredClone(relatedApp); noRead.tables[1].permissions = [];
  assert.throws(() => compileApplicationDataView(noRead, binding), /related table/);
  const relatedRuntime = createOwnedApplicationDataRuntime(relatedApp, backend, backend.projectRef);
  try {
    await relatedRuntime.auth.signIn('owner@example.com', 'fixture-password');
    const controller = createApplicationDataViewController(relatedApp, binding, relatedRuntime, () => recordId);
    const beforeDenied = calls.length;
    await assert.rejects(controller.referenceOptions('record_resource'), /not accessible/);
    assert.equal(calls.slice(beforeDenied).filter(call => call.url.pathname === '/rest/v1/app_resources').length, 0);
    roles = ['admin']; const options = await controller.referenceOptions('record_resource');
    assert.equal(options.options.length, 20); assert.equal(options.hasNext, true); assert.equal(options.searchable, true);
    assert.deepEqual(Object.keys(options.options[0]), ['id', 'label']); assert.doesNotMatch(JSON.stringify(options), /secretNote|must-not-leave/);
    assert.equal((await controller.referenceOptions('record_resource', 1)).options.length, 5);
    await controller.referenceOptions('record_resource', 0, '%_');
    const relatedQuery = calls.findLast(call => call.url.pathname === '/rest/v1/app_resources').url;
    assert.equal(relatedQuery.searchParams.get('name'), 'ilike.%\\%\\_%');
    assert.equal(relatedQuery.searchParams.get('order'), 'name.asc,id.asc');
    await assert.rejects(controller.referenceOptions('record_name'), /Unknown relationship/);
    await assert.rejects(controller.referenceOptions('record_resource', -1), /Invalid relationship/);
    relatedApp.tables[1].fields[0].key = 'tampered';
    assert.equal((await controller.referenceOptions('record_resource')).options[0].label, 'Resource 0', 'Controller captures immutable relationship metadata');
    switchAfterReference = true; await assert.rejects(controller.referenceOptions('record_resource'), /identity changed/);
    assert.equal(controller.closed(), true); controller.dispose();
  } finally { relatedRuntime.dispose(); }
  console.log('PASS data views: validated native bindings/rendering, actual isolated SDK CRUD, role denial, escaped search/pagination, uncertain-submit retry and stale-user refusal');
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
