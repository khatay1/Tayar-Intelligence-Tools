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
    'export { compileInitialApplicationStockReservationPackage } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-stock-reservation-package')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], platform: 'node', format: 'cjs', outfile, bundle: true });
  const require = createRequire(import.meta.url);
  const { validateApplicationDefinition: issues, compileInitialApplicationSchema: compile, compileInitialApplicationStockReservationPackage: packageFor } = require(outfile);
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
