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
    'export { validateApplicationDefinition, readApplicationDefinition } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-validation')) + ';',
    'export { compileInitialApplicationSchema, compileAdditiveApplicationMigration } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], platform: 'node', format: 'cjs', outfile, bundle: true });
  const require = createRequire(import.meta.url);
  const { validateApplicationDefinition: issues, compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate } = require(outfile);
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
  const enabled = structuredClone(base);
  enabled.tables[0].stockReservations = { mode: 'owner' };
  assert.deepEqual(issues(base), []);
  assert.deepEqual(issues(enabled), []);
  assert.throws(() => compile(enabled), /verified owner-only customer backend/);
  const ordinary = compile(base).join('\n');
  assert.doesNotMatch(ordinary, /app_stock_reserve_0/);
  const sql = compile(enabled, { stockReservationsProvisioned: true }).join('\n');
  assert.match(sql, /create function private\.app_stock_reserve_0/);
  assert.match(sql, /create function private\.app_stock_finalize_0/);
  assert.match(sql, /create trigger app_stock_reservation_floor_0/);
  assert.match(sql, /alter table private\.app_stock_reservations_0 enable row level security/);
  assert.match(sql, /revoke all on private\.app_stock_reservations_0 from public, anon, authenticated/);
  assert.ok(sql.indexOf('create function private.app_adjust_counter_0') < sql.indexOf('create function private.app_stock_reserve_0'),
    'The counter engine must exist before stock reservation installation');
  assert.throws(() => migrate(base, enabled), /separately verified backend migration/);
  assert.throws(() => migrate(enabled, base), /separately verified backend migration/);

  const bad = [
    { stockReservations: { mode: 'everyone' } },
    { stockReservations: true },
    { stockReservations: { mode: 'owner', credentials: 'bad' } },
    { counter: { fieldId: 'quantity', minimum: 0, integer: false } },
    { counter: { fieldId: 'quantity', minimum: 1, integer: true } },
    { counter: undefined },
    { permissions: [{ operation: 'read', access: 'authenticated' }, { operation: 'update', access: 'owner' }] },
    { permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'authenticated' }] },
    { permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }, { operation: 'read', access: 'public' }] },
  ];
  for (const override of bad) {
    const variant = structuredClone(enabled);
    Object.assign(variant.tables[0], override);
    assert.ok(issues(variant).length > 0, 'Unsupported reservation configurations must fail closed');
    assert.throws(() => compile(variant, { stockReservationsProvisioned: true }));
  }
  console.log('PASS optional owner-scoped stock reservation contract, explicit provisioning gate, generated SQL, and migration refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
