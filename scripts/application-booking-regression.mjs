import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-booking-')), require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const resource = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', resource2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let embeddedDatabase;
try {
  const entry = join(dir, 'test.ts');
  await writeFile(entry, ['application-model', 'application-validation', 'application-schema-sql', 'application-form-runtime', 'application-booking', 'application-data-view', 'application-data-runtime', 'application-booking-schedule', 'application-booking-schedule-sql']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n')
    + `\nexport * from ${JSON.stringify(resolve('server/website-owned-supabase-catalog'))};\nexport * from ${JSON.stringify(resolve('server/website-owned-booking-schedule-catalog'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate, readApplicationDefinition: validate,
    parseApplicationDataViewValues: parse, ApplicationBookingRejected: Rejected, createDurableApplicationFormSubmission: durable,
    validApplicationBookingSchedule:validSchedule,applicationBookingWithinSchedule:withinSchedule,applicationBookingScheduleManifest:scheduleManifest,compileApplicationBookingSchedule:scheduleSQL,verifyOwnedBookingScheduleCatalog:verifySchedule,verifyOwnedSupabaseBookingConstraints: verify, createOwnedApplicationDataRuntime: runtimeFor } = require(join(dir, 'test.cjs'));
  const fields = [
    { id: 'resource', key: 'resource_id', name: 'Resource', type: 'uuid', required: true },
    { id: 'start', key: 'starts_at', name: 'Start', type: 'datetime', required: true },
    { id: 'end', key: 'ends_at', name: 'End', type: 'datetime', required: true },
    { id: 'status', key: 'status', name: 'Status', type: 'enum', required: true, options: ['pending', 'confirmed', 'cancelled'], defaultValue: 'pending' },
  ];
  const booking = { resourceFieldId: 'resource', startFieldId: 'start', endFieldId: 'end', statusFieldId: 'status', blockingStatuses: ['pending', 'confirmed'] };
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    tables: [{ id: 'appointments', key: 'appointments', name: 'Appointments', fields, booking,
      permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })) }] };
  const table = app.tables[0], sql = compile(app).join('\n');
  assert.match(sql, /create extension if not exists btree_gist with schema extensions/);
  assert.match(sql, /exclude using gist.*gist_uuid_ops with =.*tstzrange.*with &&/);
  assert.match(sql, /where \("status" in \(''pending'', ''confirmed''\)\)/);
  assert.match(sql, /isfinite\("starts_at"\).*isfinite\("ends_at"\)/);
  for (const rule of [{ ...booking, startFieldId: 'missing' }, { ...booking, endFieldId: 'start' }, { ...booking, resourceFieldId: 'status' },
    { ...booking, blockingStatuses: ['unknown'] }, { ...booking, blockingStatuses: [] }, { ...booking, statusFieldId: undefined }, { ...booking, secrets: 'no' }]) {
    assert.throws(() => validate({ ...app, tables: [{ ...table, booking: rule }] }));
  }
  assert.throws(() => validate({ ...app, tables: [{ ...table, fields: fields.map(field => ({ ...field, required: false })) }] }));
  const legacy = { ...app, tables: [{ ...table, booking: undefined }] };
  assert.match(migrate(legacy, app).join('\n'), /app_booking_overlap_0/);
  assert.throws(() => migrate(app, legacy), /reviewed/);
  assert.throws(() => migrate(app, { ...app, tables: [{ ...table, booking: { ...booking, blockingStatuses: ['confirmed'] } }] }), /reviewed/);
  const values = { resource_id: resource, starts_at: '2026-10-09T10:00:00+02:00', ends_at: '2026-10-09T11:00:00+02:00', status: 'pending' };
  assert.equal(parse(table, values, true).starts_at, '2026-10-09T08:00:00.000Z');
  assert.throws(() => parse(table, { ...values, ends_at: values.starts_at }, true), /after start/);
  const schedule={timeZone:'Europe/Stockholm',maxDurationMinutes:120,weekly:[{day:5,startMinute:540,endMinute:1020}]};
  const scheduledTable={...table,booking:{...booking,schedule}},scheduledApp={...app,tables:[scheduledTable]};
  assert.equal(validSchedule(schedule),true);validate(scheduledApp);
  assert.equal(parse(scheduledTable,values,true).starts_at,'2026-10-09T08:00:00.000Z');
  for(const bad of [{...schedule,timeZone:'bad/zone'},{...schedule,maxDurationMinutes:0},{...schedule,weekly:[]},
    {...schedule,weekly:[{day:0,startMinute:540,endMinute:1020}]},{...schedule,weekly:[{day:5,startMinute:1020,endMinute:540}]},
    {...schedule,weekly:[...schedule.weekly,{day:5,startMinute:600,endMinute:660}]},{...schedule,extra:true}])assert.equal(validSchedule(bad),false);
  const interval=(from,to,rule=schedule)=>withinSchedule(rule,Date.parse(from),Date.parse(to));
  assert.equal(interval('2026-10-09T07:00Z','2026-10-09T08:00Z'),true,'opening inclusive');
  assert.equal(interval('2026-10-09T14:00Z','2026-10-09T15:00Z'),true,'closing inclusive');
  assert.equal(interval('2026-10-09T14:00Z','2026-10-09T15:00:00.001Z'),false,'one millisecond past close');
  assert.equal(interval('2026-10-09T06:59Z','2026-10-09T08:00Z'),false);
  assert.equal(interval('2026-10-10T08:00Z','2026-10-10T09:00Z'),false,'closed day');
  assert.equal(interval('2026-10-09T08:00Z','2026-10-09T10:01Z'),false,'actual duration limit');
  assert.equal(interval('2026-12-11T08:00Z','2026-12-11T09:00Z'),true,'winter offset');
  const midnight={...schedule,weekly:[{day:5,startMinute:1320,endMinute:1440}]};
  assert.equal(interval('2026-10-09T21:00Z','2026-10-09T22:00Z',midnight),true,'midnight closes the preceding day');
  const sunday={...schedule,weekly:[{day:7,startMinute:60,endMinute:240}]};
  assert.equal(interval('2026-03-29T00:30Z','2026-03-29T01:30Z',sunday),true,'spring transition uses absolute instants');
  assert.equal(interval('2026-10-25T00:30Z','2026-10-25T01:30Z',sunday),false,'repeated local end must be after local start');
  assert.throws(()=>parse(scheduledTable,{...values,starts_at:'2026-10-09T06:00Z'},true),error=>error instanceof Rejected&&error.reason==='schedule');
  assert.doesNotThrow(()=>parse(scheduledTable,{...values,starts_at:'2026-10-09T06:00Z',status:'cancelled'},true));
  const windows=applicationScheduleFixture();
  function applicationScheduleFixture(){const [manifest]=scheduleManifest(scheduledApp);return{...manifest,table_name:manifest.table,trigger_name:manifest.name,
    time_zone_available:true,security_definer:false,volatility:'v',kind:'f',result:'trigger',arguments:'',language:'plpgsql',owner:'postgres',
    configuration:['search_path=""'],anon_execute:false,authenticated_execute:false,service_execute:false,enabled:'O',type:23,trigger_arguments:'\\x'};}
  assert.equal(await verifySchedule(scheduledApp,async()=>[windows]),true);
  for(const mutation of [{time_zone_available:false},{source:'return new;'},{enabled:'D'},{security_definer:true},{anon_execute:true},{service_execute:true},{type:7},{table_name:'other'},{configuration:['search_path=public']}])
    assert.equal(await verifySchedule(scheduledApp,async()=>[{...windows,...mutation}]),false);
  assert.match(compile(scheduledApp).join('\n'),/Application booking outside schedule/);
  assert.throws(()=>migrate(app,scheduledApp),/reviewed/);
  console.log('PASS booking schedule: strict windows/time zones, boundaries, duration, DST, cancellation and exact catalog guard proof');
  const rows = [
    { name: 'app_booking_interval_0', type: 'c', definition: 'CHECK ((isfinite(starts_at) AND isfinite(ends_at) AND (starts_at < ends_at)))' },
    { name: 'app_booking_overlap_0', type: 'x', definition: "EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['pending'::text, 'confirmed'::text])))" },
  ].map(row => ({ ...row, table_name: 'app_appointments', validated: true, deferrable: false, index_valid: true,
    fields: Object.fromEntries(fields.map(field => [field.key, { required: true, type: field.type === 'datetime' ? 'timestamp with time zone' : field.type === 'enum' ? 'text' : 'uuid' }])) }));
  assert.equal(await verify(app, async () => rows), true);
  for (const mutation of [{ definition: 'CHECK (true)' }, { validated: false }, { deferrable: true }, { index_valid: false }, { fields: {} }, { name: 'wrong' }]) {
    assert.equal(await verify(app, async () => [{ ...rows[0], ...mutation }, rows[1]]), false);
  }
  assert.equal(await verify(app, async () => [rows[0], { ...rows[1], definition: rows[1].definition.replace("'[)'", "'[]'") }]), false);
  assert.equal(await verify(app, async () => [rows[0]]), false);
  // A definite first-attempt conflict may be corrected. A conflict on replay may
  // follow an earlier committed response loss, so it never abandons that UUID.
  let payload = values, writes = 0;
  const storage = new Map(), scope = { key: 'tayar-app-form:booking:user', crypto: webcrypto,
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  const form = durable({ tableId: table.id, values: () => payload }, { createOnce: async () => { if (++writes === 1) throw new Rejected('conflict'); return 'created'; } }, scope);
  await assert.rejects(form.submit([]), /already booked/); assert.equal(form.status().state, 'idle'); assert.equal(storage.size, 0);
  payload = { ...values, starts_at: '2026-10-09T12:00:00+02:00', ends_at: '2026-10-09T13:00:00+02:00' };
  assert.equal(await form.submit([]), 'confirmed'); assert.equal(storage.size, 0);
  const uncertain = durable({ tableId: table.id, values: () => payload }, { createOnce: async () => { throw Error('response lost'); } }, scope);
  assert.equal(await uncertain.submit([]), 'uncertain'); const pending = storage.get(scope.key);
  const replay = durable({ tableId: table.id, values: () => payload }, { createOnce: async () => { throw new Rejected('conflict'); } }, scope);
  assert.equal(await replay.submit([]), 'uncertain'); assert.equal(storage.get(scope.key), pending);
  const originalFetch = globalThis.fetch;
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_booking_fixture' };
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  let responseCode = '23P01', savedRow = null;
  globalThis.fetch = async (resourceUrl, init) => {
    const url = new URL(String(resourceUrl)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: owner, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: owner, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/app_appointments');
    if (['POST', 'PATCH'].includes(init?.method)) return Response.json({ code: responseCode, message: responseCode === '23514' ? 'app_booking_interval_0 failed' : 'exclusion violation' }, { status: 409 });
    return Response.json(savedRow);
  };
  const sdk = runtimeFor(app, backend, backend.projectRef);
  try {
    await sdk.auth.signIn('test@example.com', 'test-password');
    await assert.rejects(sdk.createOnce(table.id, values, resource2, owner), error => error instanceof Rejected && error.reason === 'conflict');
    await assert.rejects(sdk.update(table.id, resource2, values, owner), error => error instanceof Rejected && error.reason === 'conflict');
    responseCode = '23514'; await assert.rejects(sdk.createOnce(table.id, values, resource2, owner), error => error instanceof Rejected && error.reason === 'interval');
    responseCode = '42501'; await assert.rejects(sdk.createOnce(table.id, values, resource2, owner), /uncertain/);
    // A retried request already visible with identical values wins over a later
    // rejection; it must never reset a successfully committed request identity.
    responseCode = '23P01'; savedRow = { id: resource2, ...values };
    assert.equal(await sdk.createOnce(table.id, values, resource2, owner), 'already-created');
  } finally { sdk.dispose(); globalThis.fetch = originalFetch; }
  console.log('PASS booking configuration, safe additive migrations, typed times, mandatory catalog constraints and retry identity');

  const authSetup = `create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key, is_anonymous boolean default false);
insert into auth.users values ('${owner}',false),('${other}',false);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{"is_anonymous":false}'::jsonb $$;
grant usage on schema public,auth to anon,authenticated,service_role;`;
  const constraints = compile(app).filter(statement => statement.includes('add constraint "app_booking_'));
  const probeSql = `begin; create schema if not exists extensions; create extension if not exists btree_gist with schema extensions;
create temporary table tayar_booking_probe (id uuid default gen_random_uuid(), owner_id uuid, resource_id uuid not null, starts_at timestamptz not null, ends_at timestamptz not null, status text not null);
${constraints.map(statement => statement.replaceAll('public."app_appointments"', 'pg_temp.tayar_booking_probe')).join('\n')}
insert into tayar_booking_probe(resource_id,starts_at,ends_at,status) values ('${resource}','2026-10-09 10:00Z','2026-10-09 11:00Z','pending');
do $test$ begin
  begin insert into tayar_booking_probe(resource_id,starts_at,ends_at,status) values ('${resource}','2026-10-09 10:30Z','2026-10-09 11:30Z','confirmed'); raise exception 'Overlap accepted'; exception when exclusion_violation then null; end;
  begin update tayar_booking_probe set ends_at=starts_at; raise exception 'Empty interval accepted'; exception when check_violation then null; end;
  begin update tayar_booking_probe set starts_at='-infinity'; raise exception 'Infinity accepted'; exception when check_violation then null; end;
end $test$;
insert into tayar_booking_probe(resource_id,starts_at,ends_at,status) values ('${resource}','2026-10-09 11:00Z','2026-10-09 12:00Z','pending'),('${resource2}','2026-10-09 10:30Z','2026-10-09 11:30Z','pending'),('${resource}','2026-10-09 10:30Z','2026-10-09 11:30Z','cancelled');
do $test$ begin
  begin update tayar_booking_probe set status='confirmed' where status='cancelled'; raise exception 'Reactivation conflict accepted'; exception when exclusion_violation then null; end;
end $test$;
select 'booking overlap, adjacency, different resources, cancellation and finite interval checks passed' as result; rollback;`;
  if (process.env.TAYAR_BOOKING_PROBE_SQL) await writeFile(process.env.TAYAR_BOOKING_PROBE_SQL, probeSql);
  if (process.argv.includes('--postgres') || process.argv.includes('--pglite')) {
    let query;
    const embedded = process.argv.includes('--pglite');
    if (embedded) {
      const modulePath = process.env.TAYAR_PGLITE_MODULE ?? '@electric-sql/pglite';
      const { PGlite } = require(modulePath);
      const { btree_gist } = require(join(require.resolve(modulePath), '..', 'contrib', 'btree_gist.cjs'));
      embeddedDatabase = new PGlite({ extensions: { btree_gist } });
      query = async input => {
        try {
          const results = await embeddedDatabase.exec(`reset role; ${input}`);
          return results.flatMap(result => result.rows.map(row => Object.values(row).map(value => typeof value === 'object' ? JSON.stringify(value) : String(value)).join('|'))).join('\n');
        } catch (error) { await embeddedDatabase.exec('rollback; reset role;'); throw error; }
      };
    } else {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL;
    const url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/tayar_booking_test') throw Error('An isolated local tayar_booking_test database is required.');
    query = input => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', error = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data);
      child.on('error', reject); child.on('close', code => code === 0 ? resolveQuery(output.trim()) : reject(Error(error))); child.stdin.end(input);
    });
    }
    await query(authSetup + '\n' + sql);
    await query(probeSql);
    // Two independent connections contend for the same invisible resource interval.
    const asUser = user => `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`;
    const insert = (r, from, to, status = 'pending') => `insert into public.app_appointments(resource_id,starts_at,ends_at,status) values ('${r}','2026-10-10 ${from}Z','2026-10-10 ${to}Z','${status}');`;
    if (embedded) {
      await query(`${asUser(owner)} ${insert(resource, '10:00', '11:00')}`);
      await assert.rejects(query(`${asUser(other)} ${insert(resource, '10:30', '11:30')}`), /exclusion constraint/);
    } else {
      const results = await Promise.allSettled([
        query(`begin; ${asUser(owner)} ${insert(resource, '10:00', '11:00')} select pg_sleep(0.3); commit;`),
        query(`begin; ${asUser(other)} ${insert(resource, '10:30', '11:30')} select pg_sleep(0.3); commit;`),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.match(String(results.find(result => result.status === 'rejected').reason), /exclusion constraint/);
    }
    assert.equal(await query('select count(*) from public.app_appointments;'), '1');
    const winner = await query('select owner_id from public.app_appointments limit 1;');
    const loser = winner === owner ? other : owner;
    const visible = await query(`${asUser(loser)} select count(*) from public.app_appointments;`);
    assert.equal(visible.split('\n').at(-1), '0', 'RLS hides competing booking without allowing a conflict');
    await query(`${asUser(loser)} ${insert(resource2, '10:30', '11:30')}`);
    await assert.rejects(query(`${asUser(loser)} update public.app_appointments set resource_id='${resource}' where owner_id=auth.uid();`), /exclusion constraint/);
    await query(`${asUser(winner)} update public.app_appointments set status='cancelled';`);
    await query(`${asUser(loser)} update public.app_appointments set resource_id='${resource}' where owner_id=auth.uid();`);
    await assert.rejects(query(`${asUser(winner)} update public.app_appointments set status='confirmed';`), /exclusion constraint/);
    await assert.rejects(query(`${asUser(loser)} update public.app_appointments set ends_at=starts_at;`), /check constraint/);
    const catalog = await verify(app, async querySql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${querySql}) x;`)));
    assert.equal(catalog, true, 'Actual PostgreSQL constraints match customer publish catalog proof');
    // One bulk INSERT is one transaction: a conflict on its second occurrence
    // must roll back the first row and its durable form-request receipt.
    const countBeforeSeries = await query('select count(*) from public.app_appointments;');
    await assert.rejects(query(`${asUser(loser)} insert into public.app_appointments(resource_id,starts_at,ends_at,status)
      values ('${resource2}','2026-10-12 10:00Z','2026-10-12 11:00Z','pending'),
      ('${resource}','2026-10-10 10:30Z','2026-10-10 11:30Z','pending');`), /exclusion constraint/);
    assert.equal(await query('select count(*) from public.app_appointments;'), countBeforeSeries);
    const allDays={...schedule,weekly:[1,2,3,4,5,6,7].map(day=>({day,startMinute:540,endMinute:1020}))};
    const guardedApp={...app,tables:[{...table,booking:{...booking,schedule:allDays}}]};
    await query(scheduleSQL(guardedApp,0).join('\n'));
    await assert.rejects(query(`${asUser(loser)} ${insert(resource2,'05:00','06:00')}`),/outside schedule/);
    await assert.rejects(query(`${asUser(loser)} update public.app_appointments set ends_at=starts_at+interval '3 hours' where owner_id=auth.uid();`),/outside schedule/);
    await query(`${asUser(loser)} ${insert(resource2,'05:00','06:00','cancelled')}`);
    const actualScheduleQuery=async querySql=>JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${querySql}) x;`));
    assert.equal(await verifySchedule(guardedApp,actualScheduleQuery),true);
    await query('alter table public.app_appointments disable trigger app_booking_schedule_0;');
    assert.equal(await verifySchedule(guardedApp,actualScheduleQuery),false);
    await query('alter table public.app_appointments drop constraint app_booking_overlap_0;');
    assert.equal(await verify(app, async querySql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${querySql}) x;`))), false);
    console.log(`PASS actual PostgreSQL: ${embedded ? 'isolated inserts/updates' : 'concurrent inserts/updates'}, invisible-row conflicts, cancellation, atomic series rollback, schedule guards, invalid intervals and removed-constraint refusal`);
  }
} finally { await embeddedDatabase?.close(); await rm(dir, { recursive: true, force: true }); }
