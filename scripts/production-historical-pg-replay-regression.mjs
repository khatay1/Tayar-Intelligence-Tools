import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { withHistoricalRehearsalSources } from './prepare-production-history-rehearsal.mjs';

const image = 'postgres:17.11';
const database = 'tayar_history_rehearsal';
const restore = 'tayar_history_rehearsal_restore';
const archive = '/tmp/tayar-history-fixture.dump';
const fixtureCount = 31;

function run(args, { input, timeout = 12000 } = {}) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', timeout, maxBuffer: 2_000_000 });
  if (r.error || r.status !== 0) {
    const operation = args[0] === 'exec' ? args.slice(3, 6).join(' ') : args[0];
    throw new Error('Disposable PostgreSQL operation failed: ' + operation
      + ': ' + (r.error?.message ?? r.stderr ?? 'unknown error').slice(0, 400));
  }
  return r.stdout.trim();
}
const inside = (name, ...command) => run(['exec', name, ...command]);
const sql = (name, db, query) => run(['exec', '-i', name, 'psql', '-X',
  '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-A', '-t', '-f', '-'], { input: query });
const statsSql = [
  'select jsonb_build_object(',
  " 'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and c.relkind in ('r','p')),",
  " 'rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity),",
  " 'policies',(select count(*) from pg_policies where schemaname='public'),",
  " 'indexes',(select count(*) from pg_indexes where schemaname='public'),",
  " 'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),",
  " 'auth_rows',(select count(*) from auth.users),",
  " 'profile_rows',(select count(*) from public.profiles),",
  " 'storage_buckets',(select count(*) from storage.buckets),",
  " 'storage_policies',(select count(*) from pg_policies where schemaname='storage'),",
  " 'storage_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects' and c.relrowsecurity),"
  " 'has_website_versions',to_regclass('public.website_publish_versions') is not null",
  ')::text;',
].join('\n');
const bootstrap = [
  'CREATE ROLE anon NOLOGIN;',
  'CREATE ROLE authenticated NOLOGIN;',
  'CREATE ROLE service_role NOLOGIN;',
  'CREATE SCHEMA auth;',
  'CREATE SCHEMA storage;',
  'CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);',
  'CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL REFERENCES storage.buckets(id), name text NOT NULL);',
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;',
  "CREATE OR REPLACE FUNCTION storage.foldername(object_name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(object_name, '/') $$;",
  "CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);",
  "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
  "CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;",
].join('\n');
if (process.env.GITHUB_ACTIONS !== 'true'
 || process.env.GITHUB_REPOSITORY !== 'khatay1/Tayar-Intelligence-Tools') {
  console.error('REFUSED: use the existing public-repo GitHub Actions job only.');
  process.exitCode = 2;
} else {
  await withHistoricalRehearsalSources(process.cwd(), async evidence => {
    assert.equal(evidence.releaseAuthorized, false);
    assert.equal(evidence.migrationExecutionAuthorized, false);
    assert.equal(evidence.sources.length, 119);
    assert.equal(evidence.quarantinedCount, 30);
    const selected = evidence.sources.slice(0, fixtureCount);
    assert.equal(selected[0].target, '20260802152522_create_profiles_table.sql');
    assert.equal(selected.at(-1).target, '20260828152500_create_website_publish_versions.sql');
    // These 31 reviewed migrations include the website publish version table and isolated Storage stubs.
    // Do NOT extend this count without independent fixture review.
    const name = 'tayar-history-' + randomUUID().replaceAll('-', '').slice(0, 15);
    let started = false;
    try {
      // Fresh, deleted-on-exit, portless and NETWORK-DISCONNECTED container.
      // The separate GitHub Actions PostgreSQL service is NEVER reused here.
      run(['run', '--detach', '--rm', '--network', 'none', '--name', name,
        '--memory', '384m', '--pids-limit', '192', '-e', 'POSTGRES_PASSWORD=ci-fixture-only',
        '-e', 'POSTGRES_DB=' + database, image], { timeout: 30000 });
      started = true;
      let ready = false;
      for (let attempt = 0; attempt < 24; attempt++) {
        const ping = spawnSync('docker', ['exec', name, 'psql', '-X', '-A', '-t',
          '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-c', 'select 1;'],
          { encoding: 'utf8', timeout: 2000 });
        if (ping.status === 0 && ping.stdout?.trim() === '1') { ready = true; break; }
        await sleep(350);
      }
      if (!ready) throw new Error('Fresh PostgreSQL fixture was not ready.');
      sql(name, database, bootstrap);
      for (const item of selected) {
        const bytes = await readFile(join(evidence.migrationDirectory, item.target));
        if (!bytes.length) throw new Error('Empty reviewed migration source.');
        try {
          run(['exec', '-i', name, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
            '-U', 'postgres', '-d', database, '-f', '-'], { input: bytes, timeout: 15000 });
        } catch (error) {
          throw new Error('Failed isolated migration ' + item.target + ': ' + error.message);
        }
      }
      // Prove historical user-created trigger and data restoration without real user records.
      sql(name, database, "INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ('00000000-0000-4000-8000-000000000001','synthetic@example.invalid','{\"full_name\":\"Fixture\"}'::jsonb);");
      const before = sql(name, database, statsSql).split('\n').at(-1);
      const values = JSON.parse(before);
      assert.ok(Number(values.tables) >= 18, 'Historical base tables must be present.');
      assert.ok(Number(values.rls) >= 14, 'Historical RLS must be present.');
      assert.ok(Number(values.policies) >= 30, 'Historical policies must be present.');
      assert.equal(Number(values.storage_buckets), 2, 'Both reviewed Storage bucket records must exist.');
      assert.equal(Number(values.storage_policies), 8, 'Storage object RLS policy definitions must exist.');
      assert.equal(Number(values.storage_rls), 1, 'Storage objects must have RLS enabled.');
      assert.equal(values.has_website_versions, true, 'Reviewed publish-version table must exist and survive restore.');
      assert.equal(Number(values.auth_rows), 1, 'Synthetic auth account must exist.');
      assert.equal(Number(values.profile_rows), 1, 'Historical profile trigger must insert owner profile.');
      inside(name, 'pg_dump', '-U', 'postgres', '-d', database, '-Fc',
        '--no-owner', '--no-acl', '-f', archive);
      inside(name, 'createdb', '-U', 'postgres', restore);
      inside(name, 'pg_restore', '-U', 'postgres', '-d', restore,
        '--no-owner', '--no-acl', '--exit-on-error', archive);
      const after = sql(name, restore, statsSql).split('\n').at(-1);
      assert.deepEqual(JSON.parse(after), values, 'Restored PostgreSQL schema must match.');
      console.log('PASS disposable PG17: applied ' + selected.length +
        ' reviewed historical SQL migrations; pg_dump/pg_restore preserved tables, RLS, policies, indexes and functions. No network or Production data.');
      return { applied: selected.length, stats: values };
    } finally {
      if (started) {
        const cleanup = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8', timeout: 12000 });
        if (cleanup.error || cleanup.status !== 0) throw new Error('Disposable test container cleanup failed.');
      }
    }
  });
}
