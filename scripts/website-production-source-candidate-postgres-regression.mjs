import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const databaseUrl = process.env.TAYAR_PRODUCTION_CANDIDATE_TEST_DATABASE_URL;
if (!databaseUrl) throw Error('A dedicated local Production candidate test database is required.');
const target = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || target.pathname !== '/tayar_production_candidate_test') throw Error('Refusing a non-local/non-dedicated candidate test database.');
const psql = sql => execFileSync('psql', [databaseUrl, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const migration = path => execFileSync('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', resolve(path)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [owner, project, previewOperation, operation, pg, g, ps, s, pv, v] = Array.from({ length: 10 }, (_, n) => id(n + 1));
const snapshot = JSON.stringify({ siteName: 'Prepared fixture', application: { version: 1 } });
psql(`do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql as 'select null::uuid';
create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
create table public.projects(id uuid primary key,user_id uuid not null,type text not null,deleted_at timestamptz,content jsonb not null);
insert into public.projects values('${project}','${owner}','website-builder',null,'${snapshot}'::jsonb);`);
for (const path of [
  '20260928205027_website_byo_infrastructure_connections.sql',
  '20260929001500_website_byo_github_export_cursor.sql',
  '20260930030000_website_byo_publish_checkpoint.sql',
  '20260930053000_website_byo_runtime_binding.sql',
  '20261016100000_website_production_source_candidates.sql',
]) migration('supabase/migrations/' + path);
for (const [index, connection, provider, environment, account, targetId, status] of [
  [0, pg, 'github', 'preview', '77', '88', 'connected'], [1, g, 'github', 'production', '77', '88', 'connected'],
  [2, ps, 'supabase', 'preview', 'customer', 'abcdefghijklmnopqrst', 'ready'], [3, s, 'supabase', 'production', 'customer', 'zyxwvutsrqponmlkjihg', 'ready'],
  [4, pv, 'vercel', 'preview', 'team_customer1234', 'prj_customer1234', 'connected'], [5, v, 'vercel', 'production', 'team_customer1234', 'prj_customer1234', 'connected'],
]) psql(`insert into private.website_infrastructure_connections(id,project_id,owner_id,provider,environment,account_id,target_id,status,version,last_commit_id,verified_at)
 values('${connection}','${project}','${owner}','${provider}','${environment}','${account}','${targetId}','${status}',1,'${id(20 + index)}','2026-10-16T00:00:00Z');`);
for (const [connection, environment, source, head, backend, host, commit] of [
  [pg, 'preview', 'a', 'b', ps, pv, id(30)], [g, 'production', 'c', 'd', s, v, id(31)],
]) {
  psql(`insert into private.website_github_export_cursors(connection_id,project_id,owner_id,repository_id,environment,branch,connection_version,last_head_sha,last_source_digest,last_operation_id,version)
   values('${connection}','${project}','${owner}','88','${environment}','tayar/${project}/${environment}',1,'${head.repeat(40)}','${source.repeat(64)}','${commit}',2);
  insert into private.website_byo_runtime_bindings(project_id,owner_id,environment,supabase_connection_id,supabase_connection_version,vercel_connection_id,vercel_connection_version,
   application_origin,publishable_key,application_definition,version,last_commit_id,verified_at)
   values('${project}','${owner}','${environment}','${backend}',1,'${host}',1,'https://customer.example','sb_publishable_${environment}_fixture','{"version":1}',1,'${commit}','2026-10-16T00:00:00Z');`);
}
psql(`insert into private.website_byo_publish_operations(operation_id,project_id,owner_id,environment,stage,version,source_digest,head_sha,attempt_version,deployment_id,live_url,last_transition_key)
 values('${previewOperation}','${project}','${owner}','preview','ready',7,'${'a'.repeat(64)}','${'b'.repeat(40)}',2,'dpl_preview1234','https://preview.vercel.app','fixture');`);
const read = `select public.website_read_production_source_candidate('${operation}','${project}','${owner}')`;
const record = (overrides = {}) => {
  const values = { operation, project, owner, previewOperation, github: g, previewDigest: 'a'.repeat(64), snapshotDigest: 'e'.repeat(64), runtimeDigest: 'f'.repeat(64), sourceDigest: 'c'.repeat(64), head: 'd'.repeat(40), ...overrides };
  return `select public.website_record_production_source_candidate('${values.operation}','${values.project}','${values.owner}','${values.previewOperation}','${values.github}',
   '${values.previewDigest}','${values.snapshotDigest}','${values.runtimeDigest}','${values.sourceDigest}','${values.head}','${snapshot}'::jsonb)`;
};
const asService = sql => `set role service_role;${sql};reset role;`;
const result = JSON.parse(psql(asService(record())));
assert.equal(result.status, 'source-prepared'); assert.equal(result.headSha, 'd'.repeat(40));
assert.deepEqual(JSON.parse(psql(asService(record()))), result, 'Exact retry is idempotent');
assert.equal(psql('select count(*) from private.website_production_source_candidates'), '1');
assert.deepEqual(JSON.parse(psql(asService(read))), result);
assert.equal(psql(asService(`select public.website_read_production_source_candidate('${operation}','${project}','${id(99)}')`)), '');
assert.equal(psql(asService(`select public.website_read_production_source_candidate('${operation}','${id(99)}','${owner}')`)), '');
assert.doesNotMatch(JSON.stringify(result), /publishable|backend|scope|liveUrl|deploymentId|ready/);
const refused = sql => assert.throws(() => psql(sql), error => /Production source candidate|permission denied/.test(String(error.stderr)));
for (const change of [{ owner: id(99) }, { project: id(99) }, { previewOperation: operation }, { github: pg },
  { previewDigest: '0'.repeat(64) }, { sourceDigest: '0'.repeat(64) }, { head: '0'.repeat(40) },
  { runtimeDigest: '0'.repeat(64) }, { snapshotDigest: 'bad' }]) refused(asService(record(change)));
// Every current-scope mutation invalidates reads and forbids overwriting the
// old operation. Rollback restores the exact original valid source handoff.
for (const change of [
  `update public.projects set content=jsonb_set(content,'{siteName}','"Changed"') where id='${project}'`,
  `update public.projects set user_id='${id(99)}' where id='${project}'`,
  `update public.projects set deleted_at=now() where id='${project}'`,
  `update private.website_byo_publish_operations set version=version+1 where operation_id='${previewOperation}'`,
  `update private.website_byo_publish_operations set stage='blocked',live_url=null where operation_id='${previewOperation}'`,
  `update private.website_github_export_cursors set last_head_sha='${'0'.repeat(40)}' where connection_id='${g}'`,
  `update private.website_github_export_cursors set version=version+1 where connection_id='${pg}'`,
  `update private.website_byo_runtime_bindings set version=version+1 where project_id='${project}' and environment='production'`,
  `update private.website_infrastructure_connections set version=version+1 where id='${v}'`,
  `update private.website_infrastructure_connections set status='credentials-revoked' where id='${g}'`,
  `update private.website_infrastructure_connections set target_id='abcdefghijklmnopqrst' where id='${s}'`,
  `update private.website_infrastructure_connections set account_id='team_foreign1234' where id='${v}'`,
]) {
  assert.equal(psql(`begin;${change};${asService(read)}rollback;`), '', change);
  refused(`begin;${change};${asService(record())}rollback;`);
}
for (const role of ['anon', 'authenticated']) {
  refused(`set role ${role};${read}`); refused(`set role ${role};${record()}`);
  refused(`set role ${role};select * from private.website_production_source_candidates`);
}
refused('set role service_role;select * from private.website_production_source_candidates');
refused('set role service_role;delete from private.website_production_source_candidates');
assert.equal(psql("select relrowsecurity from pg_class where oid='private.website_production_source_candidates'::regclass"), 't');
assert.equal(psql('select count(*) from private.website_production_source_candidates'), '1');
assert.deepEqual(JSON.parse(psql(asService(read))), result);
console.log('PASS Production source PostgreSQL: actual registry/cursor/binding migrations, private service-only immutable record, isolation, stale-scope refusal and exact retries (isolated fixture; no provider/deployment approval)');
