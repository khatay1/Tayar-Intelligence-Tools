import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-schema-'));
try {
  const outfile = join(dir, 'schema.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-schema-sql.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate } = (await import(pathToFileURL(outfile))).default;
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
  assert.match(sql, /create table private\.app_schema_revisions/);
  assert.match(sql, /revoke all on private\.app_schema_revisions from public, anon, authenticated/);
  assert.match(sql, /create table public\."app_vehicles"/);
  assert.ok(sql.indexOf('create table public."app_vehicles"') < sql.indexOf('add constraint "app_fk_0_1"'), 'Relationships apply after all tables exist');
  assert.match(sql, /default 'O''Brien'/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /revoke all on public\."app_bookings" from public, anon, authenticated/);
  assert.match(sql, /create policy "app_p_0_create".*with check .*is_anonymous.*owner_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /new\.owner_id is distinct from old\.owner_id/);
  assert.match(sql, /create function public\.app_guard_audit_fields\(\).*set search_path = ''/);
  assert.match(sql, /create index "app_i_0_owner" on public\."app_bookings" \(owner_id\)/);
  assert.match(sql, /create policy "app_p_0_read".*owner_id.*or.*private\.app_has_role\('manager'\)/);
  assert.equal((sql.match(/create policy "app_p_0_read"/g) ?? []).length, 1);
  assert.match(sql, /create policy "app_p_0_delete".*private\.app_has_role\('manager'\)/);
  assert.match(sql, /revoke all on private\.app_user_roles from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant select on private\.app_user_roles to authenticated/);
  assert.match(sql, /create policy "app_p_1_read".*to anon, authenticated using \(true\)/);
  assert.doesNotMatch(sql, /grant (insert|update|delete) on public\."app_vehicles" to anon/i);
  assert.doesNotMatch(sql, /user_metadata/);
  assert.match(sql, /\(select auth\.jwt\(\)\)->>'is_anonymous'/);
  assert.throws(() => compile({ ...app, tables: [{ ...app.tables[0], key: 'bookings; DROP TABLE users' }] }));
  assert.throws(() => compile({ ...app, tables: [{ ...app.tables[0], key: 'user_roles' }] }));
  assert.throws(() => compile({ ...app, tables: [{ ...app.tables[0], permissions: [{ operation: 'create', access: 'public' }] }] }));
  assert.deepEqual(migrate(app, structuredClone(app)), []);
  const upgraded = structuredClone(app);
  upgraded.tables[0].fields.push({ id: 'booking-status', key: 'status', name: 'Status', type: 'enum', required: true, defaultValue: 'pending', options: ['pending', 'confirmed'] });
  upgraded.tables[0].fields.push({ id: 'pickup-location', key: 'location_id', name: 'Location', type: 'reference', required: false, referenceTableId: 'locations' });
  upgraded.tables[0].permissions = upgraded.tables[0].permissions.filter(rule => rule.operation !== 'delete');
  upgraded.tables.push(table('locations', [{ id: 'location-title', key: 'title', name: 'Title', type: 'text', required: true }], [{ operation: 'read', access: 'public' }]));
  const changes = migrate(app, upgraded).join('\n');
  assert.match(changes, /from private\.app_schema_revisions where id = true for update/);
  assert.match(changes, /Application schema revision does not match deployed definition/);
  assert.match(changes, /update private\.app_schema_revisions set definition/);
  if (process.env.APPLICATION_MIGRATION_OUTPUT) await writeFile(process.env.APPLICATION_MIGRATION_OUTPUT, `${changes}\n`);
  assert.match(changes, /alter table public\."app_bookings" add column "status" text not null default 'pending'/);
  assert.match(changes, /create table public\."app_locations"/);
  assert.ok(changes.indexOf('create table public."app_locations"') < changes.indexOf('add constraint "app_fk_0_3"'));
  assert.match(changes, /revoke all on public\."app_bookings" from anon, authenticated/);
  assert.match(changes, /drop policy "app_p_0_delete"/);
  assert.doesNotMatch(changes, /create policy "app_p_0_delete"/);
  assert.throws(() => migrate(app, { ...app, tables: app.tables.slice(1) }), /Removing/);
  const destructive = structuredClone(app);
  destructive.tables[0].fields[0].type = 'number';
  delete destructive.tables[0].fields[0].defaultValue;
  assert.throws(() => migrate(app, destructive), /changing existing/);
  const unbackfilled = structuredClone(app);
  unbackfilled.tables[0].fields.push({ id: 'new-required', key: 'must_supply', name: 'Must supply', type: 'text', required: true });
  assert.throws(() => migrate(app, unbackfilled), /needs a default/);
  assert.throws(() => migrate(app, { ...app, roles: [...app.roles, { id: 'staff', name: 'Staff' }] }), /Role or authentication/);
  console.log('PASS initial isolated-app schema compiler: references, RLS, immutable ownership, role rules and safe identifiers');
  console.log('PASS additive schema migration: new tables/fields, cross-references, policy removal and destructive change rejection');
} finally { await rm(dir, { recursive: true, force: true }); }
