import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-app-form-'));
try {
  const outfile = join(dir, 'form.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-form-runtime.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { compileApplicationCreateForm: compile, createApplicationFormSubmission: create, createDurableApplicationFormSubmission: durable } = (await import(pathToFileURL(outfile))).default;
  const definitions = [
    ['label', 'text', 'text'], ['count', 'number', 'number'], ['enabled', 'boolean', 'checkbox'], ['date', 'date', 'date'],
    ['timestamp', 'datetime', 'text'], ['reference', 'uuid', 'text'], ['choice', 'enum', 'select'], ['metadata', 'json', 'textarea'],
  ];
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], pageAccess: [],
    tables: [{ id: 'records', key: 'records', name: 'Records', permissions: [{ operation: 'create', access: 'owner' }],
      fields: definitions.map(([key, type]) => ({ id: `db_${key}`, key, name: key, type, required: key === 'label', ...(type === 'enum' ? { options: ['one', 'two'] } : {}) })),
    }],
  };
  const section = { id: 'form', type: 'contact', title: 'Create record', formFields: definitions.map(([name, , type]) => ({ id: `form_${name}`, name, label: name, type, required: name === 'label', ...(type === 'select' ? { options: ['one', 'two'] } : {}) })) };
  const binding = { operation: 'create', tableId: 'records', fields: definitions.map(([key]) => ({ formFieldId: `form_${key}`, tableFieldId: `db_${key}` })) };
  const payload = { label: 'Example', count: '2.5', enabled: 'on', date: '2024-02-29', timestamp: '2026-09-28T07:00:00Z', reference: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', choice: 'two', metadata: '{"count":1}' };
  const entries = patch => Object.entries({ ...payload, ...patch });
  const compiled = compile(app, section, binding);
  assert.deepEqual(compiled.values(entries()), { ...payload, count: 2.5, enabled: true, timestamp: '2026-09-28T07:00:00.000Z', reference: payload.reference.toLowerCase(), metadata: { count: 1 } });
  assert.equal(compiled.values(entries({ enabled: undefined }).filter(([key]) => key !== 'enabled')).enabled, false);
  assert.equal(compiled.values(entries({ count: '' })).count, null);
  for (const patch of [{ count: 'NaN' }, { count: 'Infinity' }, { count: '0x10' }, { count: '9007199254740993' }, { enabled: 'yes' }, { date: '2026-02-29' }, { timestamp: '2026-09-28T25:00:00Z' }, { timestamp: '2026-09-28T10:00:00' }, { choice: 'unknown' }, { reference: 'not-uuid' }, { metadata: '{bad}' }, { metadata: '1e400' }, { label: ' ' }, { label: 'x'.repeat(4001) }]) {
    assert.throws(() => compiled.values(entries(patch)), /form does not match/);
  }
  for (const extras of [[['owner_id', 'other-user']], [['label', 'duplicate']], [['_tayar_company', 'bot']], [['count', new Blob(['file'])]]]) {
    assert.throws(() => compiled.values([...entries(), ...extras]));
  }
  assert.doesNotThrow(() => compiled.values([...entries(), ['_tayar_company', '']]));
  assert.throws(() => compiled.values(entries({ metadata: '['.repeat(30) + '0' + ']'.repeat(30) })));
  assert.throws(() => compile(app, section, { ...binding, secret: 'PRIVATE' }));
  assert.throws(() => compile(app, section, { ...binding, fields: binding.fields.map((item, index) => index === 0 ? { ...item, tableFieldId: 'owner_id' } : item) }));
  assert.throws(() => compile(app, section, { ...binding, fields: binding.fields.map(item => binding.fields[0]) }));
  assert.throws(() => compile(app, { ...section, formSuccessAction: 'redirect' }, binding));
  assert.throws(() => compile(app, { ...section, formAutomations: [{ enabled: true }] }, binding));
  for (const patch of [{ type: 'file' }, { conditions: [{ fieldName: 'other', operator: 'empty' }] }, { validation: { pattern: '(a+)+$' } }]) {
    assert.throws(() => compile(app, { ...section, formFields: section.formFields.map((field, index) => index === 0 ? { ...field, ...patch } : field) }, binding));
  }
  const numericBounds = structuredClone(section); numericBounds.formFields[1].validation = { min: 1, max: 5 };
  const bounded = compile(app, numericBounds, binding);
  assert.throws(() => bounded.values(entries({ count: '6' })));
  assert.doesNotThrow(() => bounded.values(entries({ count: '1' })));
  const required = structuredClone(app); required.tables[0].fields.push({ id: 'extra', key: 'extra', name: 'Extra', type: 'text', required: true });
  assert.throws(() => compile(required, section, binding));
  required.tables[0].fields.at(-1).defaultValue = 'default';
  assert.doesNotThrow(() => compile(required, section, binding));
  const noPermission = structuredClone(app); noPermission.tables[0].permissions = [];
  assert.throws(() => compile(noPermission, section, binding));
  const runtimeApp = structuredClone(app);
  const captured = compile(app, section, binding);
  section.formFields[0].name = 'changed'; binding.fields[0].tableFieldId = 'changed'; app.tables[0].fields[0].key = 'changed';
  assert.equal(captured.values(entries()).label, 'Example', 'Compilation captures immutable references');

  const calls = []; let release;
  const pending = new Promise(resolve => { release = resolve; });
  const submission = create(captured, { async create(tableId, values) { calls.push({ tableId, values }); await pending; return { id: 'private-row' }; } });
  await assert.rejects(submission.submit(entries({ count: 'bad' })));
  assert.equal(submission.status().state, 'idle'); assert.equal(calls.length, 0);
  const first = submission.submit(entries());
  assert.equal(submission.status().state, 'submitting');
  await assert.rejects(submission.submit(entries())); assert.equal(calls.length, 1);
  release(); assert.equal(await first, 'confirmed');
  assert.equal(calls[0].tableId, 'records'); assert.equal(calls[0].values.label, 'Example');
  await assert.rejects(submission.submit(entries()));
  submission.resetConfirmed(); assert.equal(submission.status().state, 'idle');
  let attempts = 0;
  const uncertain = create(captured, { async create() { attempts++; throw new Error('SECRET_DB_MESSAGE'); } });
  assert.equal(await uncertain.submit(entries()), 'uncertain');
  assert.throws(() => uncertain.resetConfirmed());
  await assert.rejects(uncertain.submit(entries())); assert.equal(attempts, 1, 'Lost insert response never retries implicitly');
  let finish;
  const abandoned = create(captured, { create: () => new Promise(resolve => { finish = resolve; }) });
  const old = abandoned.submit(entries()); abandoned.dispose(); finish({ id: 'saved' });
  assert.equal(await old, 'uncertain'); await assert.rejects(abandoned.submit(entries()));
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); }, removeItem: key => { saved.delete(key); } };
  const scope = { key: 'tayar-app-form:project:user:page:form', storage, crypto: webcrypto };
  const onceCalls = [];
  let loseResponse = true;
  const onceRuntime = { async createOnce(tableId, values, requestId) {
    onceCalls.push({ tableId, values, requestId });
    if (loseResponse) throw new Error('PRIVATE_UPSTREAM_ERROR');
    return 'already-created';
  } };
  const durableFirst = durable(captured, onceRuntime, scope);
  assert.equal(await durableFirst.submit(entries()), 'uncertain');
  assert.equal(saved.size, 1, 'Pending request survives a lost response');
  assert.equal(onceCalls.length, 1);
  await assert.rejects(durableFirst.submit(entries({ label: 'Changed' })), /identity is unavailable/);
  await assert.rejects(durable({ ...captured, tableId: 'different-table' }, onceRuntime, scope).submit(entries()), /identity is unavailable/);
  assert.equal(onceCalls.length, 1, 'Changed values cannot inherit a committed request identity');
  durableFirst.dispose(); loseResponse = false;
  const reloaded = durable(captured, onceRuntime, scope);
  assert.equal(await reloaded.submit(entries()), 'confirmed', 'Reload uses the exact same request identity');
  assert.equal(onceCalls[1].requestId, onceCalls[0].requestId);
  assert.equal(saved.size, 0);
  reloaded.resetConfirmed();
  assert.equal(await reloaded.submit(entries()), 'confirmed');
  assert.notEqual(onceCalls[2].requestId, onceCalls[0].requestId, 'A new intentional record receives a new identity');
  const brokenStorage = { ...storage, setItem() { throw new Error('STORAGE_DENIED'); } };
  await assert.rejects(durable(captured, onceRuntime, { ...scope, storage: brokenStorage }).submit(entries()), /identity is unavailable/);
  assert.equal(onceCalls.length, 3, 'Storage failure cannot start a mutation');
  storage.setItem(scope.key, '{bad');
  await assert.rejects(durable(captured, onceRuntime, scope).submit(entries()), /identity is unavailable/);
  assert.equal(onceCalls.length, 3);
  storage.removeItem(scope.key);
  let completeRequest;
  const inFlightRuntime = { createOnce: () => new Promise(resolve => { completeRequest = resolve; }) };
  const active = durable(captured, inFlightRuntime, scope);
  const duplicate = durable(captured, inFlightRuntime, scope);
  const activeRequest = active.submit(entries());
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(duplicate.submit(entries()), /not available/);
  completeRequest('created');
  assert.equal(await activeRequest, 'confirmed');
  const runtimeFile = join(dir, 'runtime.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-data-runtime.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: runtimeFile });
  const { createApplicationDataRuntime } = (await import(pathToFileURL(runtimeFile))).default;
  const previousFetch = globalThis.fetch;
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  let deny = false, inserts = 0, dataRuntime;
  globalThis.fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    assert.equal(url.origin, backend.url); assert.equal(url.pathname, '/rest/v1/app_records');
    assert.equal(init.method, 'POST'); assert.equal(new Headers(init.headers).get('apikey'), backend.publishableKey);
    const body = JSON.parse(init.body); assert.equal(body.label, 'Example'); assert.ok(!Object.hasOwn(body, 'owner_id'));
    inserts++;
    return deny ? Response.json({ message: 'SECRET_RLS_ERROR' }, { status: 403 }) : Response.json({ id: 'saved-row', ...body });
  };
  try {
    dataRuntime = createApplicationDataRuntime(runtimeApp, backend, 'https://pnbllxdlskljcakyaylt.supabase.co');
    const actual = create(captured, dataRuntime);
    assert.equal(await actual.submit(entries()), 'confirmed');
    deny = true;
    const rejected = create(captured, dataRuntime);
    assert.equal(await rejected.submit(entries()), 'uncertain');
    await assert.rejects(rejected.submit(entries()));
    assert.equal(inserts, 2, 'Actual dedicated SDK: exactly one POST per attempt, no retry after denied/lost response');
  } finally { dataRuntime?.dispose(); globalThis.fetch = previousFetch; }
  console.log('PASS application form boundary: existing field IDs, typed/bounded values, system-field denial, unsupported-flow refusal, immutable capture, single submission and uncertain commit preservation');
} finally { await rm(dir, { recursive: true, force: true }); }
