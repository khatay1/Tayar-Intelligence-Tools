import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const refused = sql => assert.throws(() => psql(sql), error => /Production (source candidate|runtime environment)|permission denied/.test(String(error.stderr)));
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

// Reuse the historical receipt table/rotation DDL without installing unrelated
// promotion/deployment coordinators into this isolated fixture database.
for (const [path, boundary] of [
  ['20261002084455_website_byo_runtime_environment_receipts.sql', 'create function public.website_begin_vercel_runtime_environment('],
  ['20261002085813_website_byo_runtime_environment_rotation.sql', 'create or replace function public.website_begin_vercel_runtime_environment('],
  ['20261002100908_website_byo_production_runtime_environment.sql', 'create function public.website_begin_vercel_production_runtime_environment('],
]) {
  const source = readFileSync('supabase/migrations/' + path, 'utf8');
  assert.equal(source.split(boundary).length, 2); psql(source.split(boundary)[0]);
}
psql(`create table private.website_vercel_integration_custody(
 connection_id uuid primary key,project_id uuid,owner_id uuid,environment text,connection_version bigint,
 vercel_project_id text,account_id text,custody_expires_at timestamptz,
 repository_id text,repository_owner text,repository_name text,production_branch text);
 insert into private.website_vercel_integration_custody values
 ('${pv}','${project}','${owner}','preview',1,'prj_customer1234','team_customer1234',now()+interval '1 hour','88','customer','app','main'),
 ('${v}','${project}','${owner}','production',1,'prj_customer1234','team_customer1234',now()+interval '1 hour','88','customer','app','main');`);
migration('supabase/migrations/20261016103000_website_production_backend_receipt_isolation.sql');
const runtimeOperation = id(80), runtimeCommit = id(81);
const pairDigests = environment => psql(`select jsonb_build_object(
 'SUPABASE_URL',encode(sha256(convert_to('https://'||s.target_id||'.supabase.co','UTF8')),'hex'),
 'SUPABASE_ANON_KEY',encode(sha256(convert_to(b.publishable_key,'UTF8')),'hex'))
 from private.website_byo_runtime_bindings b join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 where b.project_id='${project}' and b.environment='${environment}'`);
const productionDigests = pairDigests('production'), previewDigests = pairDigests('preview');
const beginRuntime = (backend = s, digests = productionDigests, operation = runtimeOperation) => `select public.website_begin_vercel_production_runtime_environment(
 '${project}','${owner}',1,'${backend}',1,'${v}',1,'prj_customer1234','${digests}'::jsonb,'${operation}')`;
const environmentIds = JSON.stringify({ SUPABASE_ANON_KEY: 'env_production_anon', SUPABASE_URL: 'env_production_url' });
const commitRuntime = (ids = environmentIds) => `select public.website_commit_vercel_production_runtime_environment(
 '${project}','${owner}',1,'${runtimeOperation}','${ids}'::jsonb,'[]'::jsonb,'${runtimeCommit}')`;
const reconcileRuntime = `select public.website_reconcile_vercel_production_runtime_environment(
 '${project}','${owner}',1,'${runtimeOperation}','${environmentIds}'::jsonb,'[]'::jsonb,'${runtimeCommit}')`;
refused(asService(beginRuntime(ps, previewDigests)));
refused(asService(beginRuntime(s, previewDigests)));
assert.equal(psql('select count(*) from private.website_vercel_runtime_environment_receipts'), '0', 'Preview cannot claim a Production receipt');
const claim = JSON.parse(psql(asService(beginRuntime())));
assert.equal(claim.status, 'preparing'); assert.equal(claim.newlyClaimed, true);
assert.equal(JSON.parse(psql(asService(beginRuntime()))).newlyClaimed, false, 'Uncertain retry cannot authorize another provider write');
refused(asService(commitRuntime('{}')));
refused(asService(commitRuntime('{"SUPABASE_ANON_KEY":"env_duplicate","SUPABASE_URL":"env_duplicate"}')));
const runtimeChanges = [
  `update public.projects set content=jsonb_set(content,'{application}','{"version":2}') where id='${project}'`,
  `update private.website_byo_runtime_bindings set version=version+1 where project_id='${project}' and environment='production'`,
  `update private.website_infrastructure_connections set version=version+1 where id='${s}'`,
  `update private.website_infrastructure_connections set status='credentials-revoked' where id='${v}'`,
  `update private.website_infrastructure_connections set target_id='zyxwvutsrqponmlkjihg' where id='${ps}'`,
  `update private.website_vercel_integration_custody set custody_expires_at=now()-interval '1 minute' where connection_id='${v}'`,
  `update private.website_vercel_integration_custody set repository_id='99' where connection_id='${pv}'`,
];
for (const change of runtimeChanges) refused(`begin;${change};${asService(commitRuntime())}rollback;`);
assert.equal(psql(asService(commitRuntime())), '2');
assert.equal(psql(asService(reconcileRuntime)), '2');
assert.equal(JSON.parse(psql(asService(beginRuntime()))).status, 'verified');
for (const change of runtimeChanges) assert.equal(psql(`begin;${change};${asService(reconcileRuntime)}rollback;`), '', change);
// A historical Production receipt copied from Preview cannot be recovered or
// silently reused as a verified independent Production binding.
const historical = `update private.website_vercel_runtime_environment_receipts set supabase_connection_id='${ps}',value_digests='${previewDigests}'::jsonb where project_id='${project}' and environment='production'`;
assert.equal(psql(`begin;${historical};${asService(reconcileRuntime)}rollback;`), '');
refused(`begin;${historical};${asService(beginRuntime())}rollback;`);
const historicalRotation = JSON.parse(psql(`begin;${historical};${asService(beginRuntime(s, productionDigests, id(82)))}rollback;`));
assert.equal(historicalRotation.status, 'preparing'); assert.equal(historicalRotation.newlyClaimed, true);
assert.deepEqual(historicalRotation.supersededEnvironmentIds, JSON.parse(environmentIds));
for (const role of ['anon', 'authenticated']) {
  refused(`set role ${role};${beginRuntime()}`); refused(`set role ${role};${commitRuntime()}`); refused(`set role ${role};${reconcileRuntime}`);
}
console.log('PASS Production runtime PostgreSQL: distinct backend digests, exact one-shot preparation/recovery, historical Preview refusal, invalid IDs and stale binding/lease/repository denial (receipt DDL reused; provider transport absent)');

migration('supabase/migrations/20261016110000_website_production_source_targets.sql');
const readTargets = `select public.website_byo_publish_targets('${project}','${owner}')`;
const targets = JSON.parse(psql(asService(readTargets)));
assert.deepEqual(targets, { githubPreview: { connectionId: pg, version: 1 }, githubProduction: { connectionId: g, version: 1 },
  vercelPreview: { connectionId: pv, version: 1 }, vercelProduction: { connectionId: v, version: 1 } });
assert.doesNotMatch(JSON.stringify(targets), /publishable|accessToken|backend|sourceDigest/);
for (const change of [
  `update private.website_infrastructure_connections set target_id='99' where id='${g}'`,
  `update private.website_infrastructure_connections set account_id='78' where id='${g}'`,
  `update private.website_infrastructure_connections set owner_id='${id(99)}' where id='${g}'`,
  `update private.website_infrastructure_connections set status='credentials-revoked' where id='${g}'`,
]) {
  const changed = JSON.parse(psql(`begin;${change};${asService(readTargets)}rollback;`));
  assert.equal(changed.githubProduction, null); assert.deepEqual(changed.githubPreview, targets.githubPreview);
}
assert.equal(JSON.parse(psql(`begin;update private.website_vercel_integration_custody set repository_id='99' where connection_id='${v}';${asService(readTargets)}rollback;`)).vercelProduction, null);
assert.equal(psql(asService(`select public.website_byo_publish_targets('${project}','${id(99)}')`)), '');
for (const role of ['anon', 'authenticated']) refused(`set role ${role};${readTargets}`);
console.log('PASS Production target PostgreSQL: service-selected exact repository/account, separate environment IDs, revoked/foreign/lease mismatch refusal and preserved Preview selection');

migration('supabase/migrations/20261017212657_website_production_staging_claims.sql');
const stagingScope = { candidate: result, accountId: 'team_customer1234', projectId: 'prj_customer1234', repositoryId: '88',
  sourceBranch: `tayar/${project}/production`, runtimeEnvironmentReceiptVersion: 2, runtimeEnvironmentIds: JSON.parse(environmentIds) };
const stagingClaim = (scope = stagingScope, who = owner) => `select public.website_claim_production_staging('${scope.candidate.operationId}','${project}','${who}','${JSON.stringify(scope)}'::jsonb)`;
const stagingRecord = (deployment = 'dpl_staged1234', scope = stagingScope) => `select public.website_record_production_staging('${scope.candidate.operationId}','${project}','${owner}','${JSON.stringify(scope)}'::jsonb,'${deployment}')`;
const stagingRefused = sql => assert.throws(() => psql(sql), error => /Production staging|permission denied/.test(String(error.stderr)));
stagingRefused(asService(stagingRecord()));
const concurrent = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolveQuery, reject) => {
  execFile('psql', [databaseUrl, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', asService(stagingClaim())],
    { encoding: 'utf8' }, (error, stdout) => error ? reject(error) : resolveQuery(JSON.parse(stdout.trim())));
})));
assert.equal(concurrent.filter(value => value.issueCreate).length, 1, 'Only one concurrent claimant may create the provider deployment');
assert.ok(concurrent.every(value => value.deploymentId === null));
assert.deepEqual(JSON.parse(psql(asService(stagingClaim()))), { issueCreate: false, deploymentId: null });
assert.equal(psql(asService(stagingRecord())), 'dpl_staged1234');
assert.equal(psql(asService(stagingRecord())), 'dpl_staged1234', 'Record response loss recovers the same immutable provider ID');
assert.deepEqual(JSON.parse(psql(asService(stagingClaim()))), { issueCreate: false, deploymentId: 'dpl_staged1234' });
stagingRefused(asService(stagingRecord('dpl_different1234')));
stagingRefused(asService(stagingClaim(stagingScope, id(99))));
for (const patch of [{ accountId: 'team_other1234' }, { projectId: 'prj_other1234' }, { repositoryId: '99' },
  { runtimeEnvironmentReceiptVersion: 1 }, { runtimeEnvironmentIds: {} }, { secret: 'must-not-store' },
  { candidate: { ...result, headSha: '0'.repeat(40) } }]) stagingRefused(asService(stagingClaim({ ...stagingScope, ...patch })));
for (const change of [...runtimeChanges,
  `update public.projects set content=jsonb_set(content,'{siteName}','"Changed"') where id='${project}'`,
  `update private.website_github_export_cursors set version=version+1 where connection_id='${g}'`,
  `update private.website_vercel_runtime_environment_receipts set vercel_environment_ids='{}'::jsonb where project_id='${project}' and environment='production'`,
  `update private.website_vercel_integration_custody set production_branch='tayar/${project}/production' where connection_id='${v}'`,
]) {
  stagingRefused(`begin;${change};${asService(stagingClaim())}rollback;`);
  stagingRefused(`begin;${change};${asService(stagingRecord())}rollback;`);
}
for (const role of ['anon', 'authenticated']) {
  stagingRefused(`set role ${role};${stagingClaim()}`); stagingRefused(`set role ${role};${stagingRecord()}`);
}
for (const role of ['anon', 'authenticated', 'service_role']) {
  stagingRefused(`set role ${role};select * from private.website_production_staging_claims`);
  stagingRefused(`set role ${role};delete from private.website_production_staging_claims`);
}
assert.equal(psql("select relrowsecurity from pg_class where oid='private.website_production_staging_claims'::regclass"), 't');
assert.equal(psql('select count(*) from private.website_production_staging_claims'), '1');
console.log('PASS Production staging PostgreSQL: single concurrent durable claim, immutable provider ID, exact source/runtime/custody scope, retry recovery and service-only RPCs');

migration('supabase/migrations/20261017213501_website_production_staging_target.sql');
const stagingTarget = `select public.website_production_staging_target('${operation}','${project}','${owner}')`;
assert.deepEqual(JSON.parse(psql(asService(stagingTarget))), { scope: stagingScope, vercelConnectionId: v, vercelConnectionVersion: 1 });
assert.doesNotMatch(psql(asService(stagingTarget)), /accessToken|publishableKey|value_digests|snapshot"/);
assert.equal(psql(asService(`select public.website_production_staging_target('${operation}','${project}','${id(99)}')`)), '');
assert.equal(psql(asService(`select public.website_production_staging_target('${id(99)}','${project}','${owner}')`)), '');
for (const change of [...runtimeChanges,
  `update private.website_github_export_cursors set last_head_sha='${'0'.repeat(40)}' where connection_id='${g}'`,
  `update private.website_vercel_runtime_environment_receipts set status='preparing' where project_id='${project}' and environment='production'`,
  `update private.website_vercel_integration_custody set production_branch='tayar/${project}/production' where connection_id='${v}'`,
]) assert.equal(psql(`begin;${change};${asService(stagingTarget)}rollback;`), '', change);
for (const role of ['anon', 'authenticated']) stagingRefused(`set role ${role};${stagingTarget}`);
console.log('PASS Production staging target PostgreSQL: read-only private source/runtime/custody selection, stale and foreign refusal, no provider grant exposure');

migration('supabase/migrations/20261017215601_website_production_runtime_attestations.sql');
const attestation = { status: 'runtime-verified', operationId: operation, deploymentId: 'dpl_staged1234',
  liveUrl: 'https://clinic-staged.vercel.app', sourceDigest: result.sourceDigest, runtimeDigest: result.runtimeDigest };
const recordAttestation = (overrides = {}) => {
  const value = { scope: stagingScope, deploymentId: attestation.deploymentId, liveUrl: attestation.liveUrl,
    sourceDigest: attestation.sourceDigest, runtimeDigest: attestation.runtimeDigest, ...overrides };
  return `select public.website_record_production_runtime_attestation('${operation}','${project}','${owner}',
   '${JSON.stringify(value.scope)}'::jsonb,'${value.deploymentId}','${value.liveUrl}','${value.sourceDigest}','${value.runtimeDigest}')`;
};
const readAttestation = (who = owner) => `select public.website_read_production_runtime_attestation('${operation}','${project}','${who}')`;
const attestationRefused = sql => assert.throws(() => psql(sql), error => /Production runtime attestation|permission denied/.test(String(error.stderr)));
assert.equal(psql(asService(readAttestation())), '');
const concurrentAttestations = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolveQuery, reject) => {
  execFile('psql', [databaseUrl, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', asService(recordAttestation())],
    { encoding: 'utf8' }, (error, stdout) => error ? reject(error) : resolveQuery(JSON.parse(stdout.trim())));
})));
assert.ok(concurrentAttestations.every(value => JSON.stringify(value) === JSON.stringify(attestation)));
assert.deepEqual(JSON.parse(psql(asService(recordAttestation()))), attestation, 'Exact response-loss retry is immutable and idempotent');
assert.deepEqual(JSON.parse(psql(asService(readAttestation()))), attestation);
assert.equal(psql(asService(readAttestation(id(99)))), '');
for (const patch of [{ deploymentId: 'dpl_other1234' }, { liveUrl: 'https://other.vercel.app' },
  { liveUrl: 'https://customer.example' }, { sourceDigest: '0'.repeat(64) }, { runtimeDigest: '0'.repeat(64) },
  { scope: { ...stagingScope, accountId: 'team_other1234' } }]) attestationRefused(asService(recordAttestation(patch)));
for (const change of [...runtimeChanges,
  `update public.projects set content=jsonb_set(content,'{siteName}','"Changed"') where id='${project}'`,
  `update private.website_github_export_cursors set version=version+1 where connection_id='${g}'`,
  `update private.website_vercel_runtime_environment_receipts set vercel_environment_ids='{}'::jsonb where project_id='${project}' and environment='production'`,
  `update private.website_vercel_integration_custody set production_branch='tayar/${project}/production' where connection_id='${v}'`,
  `update private.website_production_staging_claims set deployment_id='dpl_other1234' where operation_id='${operation}'`,
]) {
  assert.equal(psql(`begin;${change};${asService(readAttestation())}rollback;`), '', change);
  attestationRefused(`begin;${change};${asService(recordAttestation())}rollback;`);
}
for (const role of ['anon', 'authenticated']) {
  attestationRefused(`set role ${role};${recordAttestation()}`); attestationRefused(`set role ${role};${readAttestation()}`);
}
for (const role of ['anon', 'authenticated', 'service_role']) {
  attestationRefused(`set role ${role};select * from private.website_production_runtime_attestations`);
  attestationRefused(`set role ${role};delete from private.website_production_runtime_attestations`);
}
assert.equal(psql("select relrowsecurity from pg_class where oid='private.website_production_runtime_attestations'::regclass"), 't');
assert.equal(psql('select count(*) from private.website_production_runtime_attestations'), '1');
console.log('PASS Production runtime attestation PostgreSQL: immutable concurrent receipt, exact deployment/source/runtime binding, stale-scope invisibility and service-only access');
