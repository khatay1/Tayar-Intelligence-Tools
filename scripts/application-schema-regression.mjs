import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-schema-'));
try {
  const outfile = join(dir, 'schema.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-schema-sql.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { compileInitialApplicationSchema: compile } = (await import(pathToFileURL(outfile))).default;
  const table = (id, fields, permissions) => ({ id, key: id, name: id, fields, permissions });
  const app = {
    version: 1,
    auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    roles: [{ id: 'manager', name: 'Manager' }], pageAccess: [],
    tables: [
      table('bookings', [
        { id: 'customer-note', key: 'note', name: 'Note', type: 'text', required: false, defaultValue: "O'Brien" },
        { id: 'booking-vehicle', key: 'vehicle_id', name: 'Vehicle', type: 'reference', required: true, referenceTableId: 'vehicles' },
      ], [
        { operation: 'read', access: 'owner' }, { operation: 'read', access: 'role', roleId: 'manager' },
        { operation: 'create', access: 'authenticated' }, { operation: 'update', access: 'owner' },
        { operation: 'delete', access: 'role', roleId: 'manager' },
      ]),
      table('vehicles', [{ id: 'license-plate', key: 'plate', name: 'Plate', type: 'text', required: true, unique: true }], [{ operation: 'read', access: 'public' }]),
    ],
  };
  const sql = compile(app).join('\n');
  assert.match(sql, /create table public\."app_bookings"/);
  assert.match(sql, /create table public\."app_vehicles"/);
  assert.ok(sql.indexOf('create table public."app_vehicles"') < sql.indexOf('add constraint "app_fk_0_1"'), 'Relationships apply after all tables exist');
  assert.match(sql, /default 'O''Brien'/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /revoke all on public\."app_bookings" from public, anon, authenticated/);
  assert.match(sql, /create policy "app_p_0_create_2".*with check .*is_anonymous.*owner_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /new\.owner_id is distinct from old\.owner_id/);
  assert.match(sql, /create policy "app_p_0_read_0".*owner_id/);
  assert.match(sql, /create policy "app_p_0_delete_4".*private\.app_has_role\('manager'\)/);
  assert.match(sql, /revoke all on private\.app_user_roles from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant select on private\.app_user_roles to authenticated/);
  assert.match(sql, /create policy "app_p_1_read_0".*to anon, authenticated using \(true\)/);
  assert.doesNotMatch(sql, /grant (insert|update|delete) on public\."app_vehicles" to anon/i);
  assert.doesNotMatch(sql, /user_metadata/);
  assert.match(sql, /auth\.jwt\(\)->>'is_anonymous'/);
  assert.throws(() => compile({ ...app, tables: [{ ...app.tables[0], key: 'bookings; DROP TABLE users' }] }));
  assert.throws(() => compile({ ...app, tables: [{ ...app.tables[0], key: 'user_roles' }] }));
  assert.throws(() => compile({ ...app, tables: [{ ...app.tables[0], permissions: [{ operation: 'create', access: 'public' }] }] }));
  console.log('PASS initial isolated-app schema compiler: references, RLS, immutable ownership, role rules and safe identifiers');
} finally { await rm(dir, { recursive: true, force: true }); }
