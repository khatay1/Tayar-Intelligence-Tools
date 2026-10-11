import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const root = new URL('../supabase/migrations/', import.meta.url);
const migration = await readFile(new URL('20261011183711_phase_zero_advisor_hardening.sql', root), 'utf8');
const baseline = await readFile(new URL('20260925094500_disable_unsafe_website_publish_scheduler.sql', root), 'utf8');
const indexes = [...migration.matchAll(/create index if not exists (\w+) on private\.(\w+)\((\w+)\);/g)]
  .map(([, name, table, column]) => ({ name, table, column }));
assert.equal(indexes.length, 16);
let embedded;
let query;
if (process.argv.includes('--postgres')) {
  const databaseUrl = process.env.TAYAR_ADVISOR_TEST_DATABASE_URL;
  const url = new URL(databaseUrl ?? 'http://invalid');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.pathname !== '/tayar_advisor_test') throw Error('Separate local advisor fixture database required');
  query = sql => new Promise((resolve, reject) => {
    const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.once('error', reject);
    child.once('close', code => code ? reject(Error(error)) : resolve(output.trim()));
    child.stdin.end(sql);
  });
} else {
  const { PGlite } = createRequire(import.meta.url)(process.env.TAYAR_PGLITE_MODULE ?? '@electric-sql/pglite');
  embedded = new PGlite();
}
const execute = sql => embedded ? embedded.exec(sql) : query(sql);
const scalar = async sql => embedded ? String((await embedded.exec(sql)).flatMap(result => result.rows ?? []).at(-1).value) : query(sql);
const roleCall = role => `set role ${role}; select public.website_publish_scheduler_ready()::text as value; reset role;`;
try {
  await execute(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema private; create table private.fixture_refs(id uuid primary key);
    create table public.website_publish_schedules(status text);
    grant usage on schema public to anon,authenticated,service_role;`);
  const tables = Map.groupBy(indexes, item => item.table);
  for (const [table, fields] of tables) await execute(`create table private.${table}(id uuid primary key,
    ${fields.map(field => `${field.column} uuid references private.fixture_refs(id)`).join(',')});
    alter table private.${table} enable row level security;`);
  await execute(baseline);
  const snapshotSql = `select jsonb_build_object(
    'acl',(select proacl::text from pg_proc where oid='public.website_publish_scheduler_ready()'::regprocedure),
    'constraints',(select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where connamespace='private'::regnamespace),
    'tables',(select jsonb_agg(jsonb_build_array(relname,relrowsecurity,relacl::text) order by relname) from pg_class where relnamespace='private'::regnamespace and relkind='r')
  )::text as value;`;
  const before = await scalar(snapshotSql);
  for (const role of ['authenticated', 'service_role']) assert.match(await scalar(roleCall(role)), /false/);
  await assert.rejects(execute(roleCall('anon')), /permission denied/);
  await execute('reset role');
  await execute(migration);
  await execute(migration);
  assert.equal(await scalar(snapshotSql), before, 'ACLs, RLS, tables and foreign keys must be preserved');
  assert.equal(await scalar(`select prosecdef::text as value from pg_proc where oid='public.website_publish_scheduler_ready()'::regprocedure;`), 'false');
  for (const role of ['authenticated', 'service_role']) assert.match(await scalar(roleCall(role)), /false/);
  await assert.rejects(execute(roleCall('anon')), /permission denied/);
  await execute('reset role');
  for (const index of indexes) assert.equal(await scalar(`select count(*)::text as value from pg_index i
    join pg_class c on c.oid=i.indexrelid join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
    where c.oid='private.${index.name}'::regclass and i.indisvalid and i.indpred is null
      and i.indrelid='private.${index.table}'::regclass and a.attname='${index.column}';`), '1');
  await assert.rejects(execute("insert into public.website_publish_schedules values ('scheduled');"), /unavailable/);
  // A newer implementation must abort the whole migration, including indexes.
  await execute(`drop index private.${indexes[0].name};
    create or replace function public.website_publish_scheduler_ready() returns boolean language sql as $$select true$$;`);
  await assert.rejects(execute(migration), /source changed/);
  await execute('rollback');
  assert.equal(await scalar(`select (to_regclass('private.${indexes[0].name}') is null)::text as value;`), 'true');
  assert.match(await scalar(roleCall('authenticated')), /true/);
  console.log('PASS advisor migration: 16 covering indexes, repeat safety, unchanged ACL/RLS/FKs, invoker readiness, anon denial, schedule guard and atomic source-drift refusal');
} finally { await embedded?.close(); }
