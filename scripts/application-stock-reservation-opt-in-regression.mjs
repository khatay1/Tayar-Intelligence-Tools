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
    'export { prepareGeneratedApplication, requestedApplicationCapabilities } from ' + JSON.stringify(resolve('src/modules/website-builder/core/editor-generated-application')) + ';',
    'export { createSection } from ' + JSON.stringify(resolve('src/modules/website-builder/core/defaults')) + ';',
    'export { applicationRepairSafetyIssues } from ' + JSON.stringify(resolve('src/modules/website-builder/core/editor-application-repair-safety')) + ';',
    'export { compileInitialApplicationStockReservationPackage } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-stock-reservation-package')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], platform: 'node', format: 'cjs', outfile, bundle: true });
  const require = createRequire(import.meta.url);
  const { validateApplicationDefinition: issues, compileInitialApplicationSchema: compile, compileInitialApplicationStockReservationPackage: packageFor, compileAdditiveApplicationMigration: migrate, compileApplicationDataView: view, prepareGeneratedApplication: generatedApplication, requestedApplicationCapabilities: requested, createSection, applicationRepairSafetyIssues: repairIssues } = require(outfile);
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
    assert.throws(()=>generatedApplication(generated,pages,prompt),/customer controls are not yet supported/,
      'A read-only availability view cannot falsely satisfy reservation controls');
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
