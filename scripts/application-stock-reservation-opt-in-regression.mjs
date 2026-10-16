import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-stock-optin-'));
try {
  const entry = join(dir, 'entry.ts'), outfile = join(dir, 'test.cjs');
  await writeFile(entry, [
    'export { validateApplicationDefinition } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-validation')) + ';',
    'export { compileInitialApplicationSchema } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql')) + ';',
    'export { compileAdditiveApplicationMigration } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql')) + ';',
    'export { compileApplicationDataView } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-data-view')) + ';',
    'export { createApplicationDataViewController } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-data-view-controller')) + ';',
    'export { prepareGeneratedApplication, requestedApplicationCapabilities } from ' + JSON.stringify(resolve('src/modules/website-builder/core/editor-generated-application')) + ';',
    'export { createSection } from ' + JSON.stringify(resolve('src/modules/website-builder/core/defaults')) + ';',
    'export { applicationRepairSafetyIssues } from ' + JSON.stringify(resolve('src/modules/website-builder/core/editor-application-repair-safety')) + ';',
    'export { compileInitialApplicationStockReservationPackage } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-stock-reservation-package')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], platform: 'node', format: 'cjs', outfile, bundle: true });
  const require = createRequire(import.meta.url);
  const { validateApplicationDefinition: issues, compileInitialApplicationSchema: compile, compileInitialApplicationStockReservationPackage: packageFor, compileAdditiveApplicationMigration: migrate, compileApplicationDataView: view, createApplicationDataViewController: controller, prepareGeneratedApplication: generatedApplication, requestedApplicationCapabilities: requested, createSection, applicationRepairSafetyIssues: repairIssues } = require(outfile);
  const base = {
    version: 1, roles: [], pageAccess: [],
    auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    tables: [{
      id: 'items', key: 'items', name: 'Stock items',
      fields: [{ id: 'quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 }],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      counter: { fieldId: 'quantity', minimum: 0, integer: true },
    }],
  };
  assert.deepEqual(issues(base), []);
  const baseline = compile(base);
  const packaged = packageFor(base, 'items');
  assert.deepEqual(packaged.slice(0, baseline.length), baseline, 'existing generated-app SQL must remain unchanged');
  assert.equal(packaged.length > baseline.length, true);
  const added = packaged.slice(baseline.length).join('\n');
  assert.match(added, /create function private\.app_stock_reserve_0/);
  assert.match(added, /create function private\.app_stock_finalize_0/);
  assert.match(added, /create trigger app_stock_reservation_floor_0/);
  assert.match(added, /alter table private\.app_stock_reservations_0 enable row level security/);
  assert.match(added, /revoke all on private\.app_stock_reservations_0 from public, anon, authenticated/);
  assert.doesNotMatch(baseline.join('\n'), /app_stock_reserve_0/);
  const saved = structuredClone(base); saved.tables[0].stockReservations = true;
  assert.deepEqual(issues(saved), [], 'A saved explicit owner-stock declaration is valid');
  const action = { tableId: 'items', columns: ['quantity'], actions: ['stock-reservation'], pageSize: 10 };
  assert.equal(view(saved, action).binding.actions[0], 'stock-reservation');
  assert.throws(() => view(base, action), 'Unsaved tables cannot expose mutation controls');
  const actor = '11111111-1111-4111-8111-111111111111', item = '22222222-2222-4222-8222-222222222222';
  const location = '33333333-3333-4333-8333-333333333333', receiptId = '44444444-4444-4444-8444-444444444444';
  const nextReceipt = '55555555-5555-4555-8555-555555555555';
  const memory = new Map(), storage = { getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  let currentActor = actor, lostReserve = true, lostSettle = true, calls = [];
  const runtime = { auth: { currentUser: async () => ({ id: currentActor, is_anonymous: false }), currentRoles: async () => [] },
    stockReservations: (_table, owner) => ({
      reserve: async (...args) => { assert.equal(owner, actor); calls.push(['reserve', ...args]);
        if (lostReserve) { lostReserve = false; throw Error('response lost'); } return 'already-reserved'; },
      settle: async (...args) => { assert.equal(owner, actor); calls.push(['settle', ...args]);
        if (lostSettle) { lostSettle = false; throw Error('response lost'); }
        return args[1] === 'release' ? 'already-released' : 'already-fulfilled'; },
    }) };
  const scope = { keyPrefix: 'customer:project:page', storage, crypto: {} };
  let generatedReceipts = 0;
  const makeController = () => controller(saved, action, runtime, () => generatedReceipts++ ? nextReceipt : receiptId, scope);
  let controls = makeController();
  await assert.rejects(controls.stockReserve(item, location, 2), /response lost/);
  assert.equal((await controls.stockState(item)).phase, 'reserve');
  await assert.rejects(controls.stockReserve(item, location, 3), /existing stock receipt/);
  controls.dispose(); controls = makeController();
  assert.equal(await controls.stockReserve(item, location, 2), 'already-reserved');
  assert.deepEqual(calls.slice(0, 2), [
    ['reserve', item, location, receiptId, 2], ['reserve', item, location, receiptId, 2],
  ], 'A reload and lost response cannot create a second hold');
  await assert.rejects(controls.stockSettle(item, 'fulfill'), /response lost/);
  assert.equal((await controls.stockState(item)).phase, 'fulfill');
  await assert.rejects(controls.stockSettle(item, 'release'), /existing stock receipt|confirmed/);
  controls.dispose(); controls = makeController();
  assert.equal(await controls.stockSettle(item, 'fulfill'), 'already-fulfilled');
  assert.equal(await controls.stockState(item), null);
  assert.deepEqual(calls.slice(2), [['settle', receiptId, 'fulfill'], ['settle', receiptId, 'fulfill']],
    'A lost settlement result cannot switch its decision');
  assert.equal(await controls.stockReserve(item, location, 1), 'already-reserved');
  assert.equal(await controls.stockSettle(item, 'release'), 'already-released');
  assert.deepEqual(calls.slice(4), [['reserve', item, location, nextReceipt, 1], ['settle', nextReceipt, 'release']],
    'A new hold uses a new receipt and can be released independently');
  assert.equal(await controls.stockState(item), null);
  const key = `${scope.keyPrefix}:stock:${actor}:items:${item}`;
  memory.set(key, '{"version":1,"reservationId":"someone-else"}');
  await assert.rejects(controls.stockReserve(item, location, 1), /Stock receipt is unavailable/);
  assert.equal(calls.length, 6, 'Invalid persisted receipt cannot authorize or replace an in-flight hold');
  memory.delete(key);
  const storageBlocked = controller(saved, action, runtime, () => receiptId, {
    ...scope, storage: { ...storage, setItem() { throw Error('storage unavailable'); } },
  });
  await assert.rejects(storageBlocked.stockReserve(item, location, 1), /storage unavailable/);
  assert.equal(calls.length, 6, 'Without durable receipt storage the controller sends no stock RPC');
  storageBlocked.dispose();
  currentActor = location;
  await assert.rejects(controls.stockState(item), /identity changed/,
    'A switched account cannot inspect the previous owner receipt');
  await assert.rejects(controls.stockReserve(item, location, 2), /closed|identity changed/);
  assert.equal(calls.length, 6, 'Account switches never submit another stock operation');
  controls.dispose();
  const savedSql = compile(saved).join('\n');
  assert.equal((savedSql.match(/create function private.app_stock_reserve_0\(/g) ?? []).length, 1);
  assert.match(savedSql, /"stockReservations":true/);
  assert.deepEqual(packageFor(saved, 'items'), compile(saved), 'Saved opt-in never installs its SQL twice');
  const availability = { tableId:'items', columns:['quantity'], actions:['stock-availability'], pageSize:10 };
  assert.equal(view(saved, availability).table.stockReservations, true);
  assert.throws(() => view(base, availability), /saved stock reservation opt-in/);
  const section=createSection('hero');section.applicationDataView=availability;section.buttonUrl='#'+section.id;
  section.elements=section.elements.map(element=>element.type==='button'?{...element,href:'#'+section.id}:element);
  const pages=[{id:'home',slug:'home',name:'Home',sections:[section]}];
  const generated={projectKind:'application',application:saved,requirements:[{id:'available_stock',summary:'View available stock',capability:'records',evidence:['view:items:stock-availability']}]};
  const plainPages=structuredClone(pages);plainPages[0].sections[0].applicationDataView.actions=[];
  assert.ok(repairIssues(saved,plainPages,plainPages,base).some(issue=>issue.includes('stockReservations')),'AI repairs must preserve an existing stock declaration even on a read-only page');
  for (const prompt of ['Show stock availability','Show available inventory','اعرض المخزون المتاح','Visa tillgängligt lager']) {
    assert.equal(requested(prompt).has('records'),true);
    assert.equal(requested(prompt).has('booking'),false,'Stock availability cannot be misclassified as appointment booking');
    assert.equal(generatedApplication(generated,pages,prompt).tables[0].stockReservations,true);
    const missing=structuredClone(pages);missing[0].sections[0].applicationDataView.actions=[];
    assert.throws(()=>generatedApplication(generated,missing,prompt));
  }
  for (const prompt of ['Build stock reservations','Reserve inventory','حجز المخزون','Lagerreservationer']) {
    assert.throws(()=>generatedApplication(generated,pages,prompt),/bound stock-reservation view/,
      'A read-only availability view cannot falsely satisfy reservation controls');
    const managed=structuredClone(pages);managed[0].sections[0].applicationDataView.actions.push('stock-reservation');
    const requirement={...generated,requirements:[...generated.requirements,
      {id:'reserved_stock',summary:'Reserve and settle stock',capability:'records',evidence:['view:items:stock-reservation']}]};
    assert.equal(generatedApplication(requirement,managed,prompt).tables[0].stockReservations,true,
      'Reservation generation requires its actual saved and bound mutation control');
  }
  for (const flag of [false, 'true', {}, 1]) {
    const malformed = structuredClone(saved); malformed.tables[0].stockReservations = flag;
    assert.ok(issues(malformed).length, 'Only an explicit true stock declaration is accepted');
  }
  assert.throws(() => migrate(base, saved), /separately reviewed/);
  assert.throws(() => migrate(saved, base), /separately reviewed/);
  assert.deepEqual(migrate(saved, saved), [], 'An already installed identical stock definition is a read-only no-op');
  const reordered=JSON.parse(JSON.stringify(saved,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value));
  assert.deepEqual(migrate(reordered,saved),[],'PostgreSQL jsonb key order cannot turn a no-op into a stock migration');
  const edited=structuredClone(saved);edited.tables[0].name='Changed stock';
  assert.throws(()=>migrate(saved,edited),/separately reviewed/,'Actual stock application changes cannot enter automatic migration');
  assert.ok(packaged.join('\n').indexOf('create function private.app_adjust_counter_0')
    < packaged.join('\n').indexOf('create function private.app_stock_reserve_0'));
  assert.throws(() => packageFor(base, 'missing'));
  const invalid = [
    { counter: { fieldId: 'quantity', minimum: 0, integer: false } },
    { counter: { fieldId: 'quantity', minimum: 1, integer: true } },
    { counter: undefined },
    { permissions: [{ operation: 'read', access: 'authenticated' }, { operation: 'update', access: 'owner' }] },
    { permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'authenticated' }] },
    { permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }, { operation: 'read', access: 'authenticated' }] },
    { permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }, { operation: 'update', access: 'public' }] },
  ];
  for (const override of invalid) {
    const variant = structuredClone(base);
    Object.assign(variant.tables[0], override);
    assert.throws(() => packageFor(variant, 'items'), 'unsafe stock package must fail closed');
  }
  const noAuth = structuredClone(base);
  noAuth.auth.enabled = false;
  assert.throws(() => packageFor(noAuth, 'items'));
  console.log('PASS opt-in stock SQL package: unchanged base, append-only install, owner-only controls and negative cases');
} finally { await rm(dir, { recursive: true, force: true }); }
