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
const fixtureCount = 79;

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
  'select (jsonb_build_object(',
  " 'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and c.relkind in ('r','p')),",
  " 'rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity),",
  " 'policies',(select count(*) from pg_policies where schemaname='public'),",
  " 'indexes',(select count(*) from pg_indexes where schemaname='public'),",
  " 'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),",
  " 'auth_rows',(select count(*) from auth.users),",
  " 'profile_rows',(select count(*) from public.profiles),",
  " 'storage_buckets',(select count(*) from storage.buckets),",
  " 'template_library_bucket',(select count(*) from storage.buckets where id='template-library'),", 
  " 'storage_policies',(select count(*) from pg_policies where schemaname='storage'),",
  " 'storage_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects' and c.relrowsecurity),",
  " 'has_website_versions',to_regclass('public.website_publish_versions') is not null,",
  " 'has_billing_entitlements',to_regprocedure('public.website_builder_plan_entitlements(text)') is not null,",
  " 'has_team_workspaces',to_regclass('public.team_workspaces') is not null,",
  " 'team_workspaces_rls',(select relrowsecurity from pg_class where oid='public.team_workspaces'::regclass),",
  " 'has_website_rate_limits',to_regclass('public.website_public_rate_limits') is not null,",
  " 'has_ai_rate_limits',to_regclass('public.ai_rate_limits') is not null,",
  " 'has_template_sources',to_regclass('public.template_sources') is not null,",
  " 'has_account_blocks',to_regclass('public.account_blocks') is not null,",
  " 'has_access_overrides',to_regclass('public.admin_access_overrides') is not null,",
  " 'has_tool_access_rules',to_regclass('public.tool_access_rules') is not null,",
  " 'has_tool_plan_limits',to_regclass('public.tool_plan_limits') is not null,",
  " 'has_tool_access_state',(select count(*) > 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tool_access_state'),",
  " 'has_check_tool_usage',(select count(*) > 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='check_tool_usage'),",
  " 'has_tool_plan_rank',(select count(*) > 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='tool_plan_rank'),",
  " 'has_subscription_grace',(select count(*) > 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='subscription_effective_paid_plan'),",
  " 'has_ai_providers',to_regclass('public.ai_provider_configs') is not null,",
  " 'ai_provider_rls',(select relrowsecurity from pg_class where oid='public.ai_provider_configs'::regclass),",
  " 'has_ai_provider_runtime',to_regprocedure('public.ai_provider_runtime(text)') is not null,",
  " 'ai_provider_anon_exec',has_function_privilege('anon','public.ai_provider_runtime(text)','EXECUTE'),",
  " 'ai_provider_service_exec',has_function_privilege('service_role','public.ai_provider_runtime(text)','EXECUTE'),",
  " 'has_admin_audit_trigger',(select count(*) = 3 from pg_trigger where tgname in ('admin_audit_admin_settings','admin_audit_tool_access_rules','admin_audit_tool_plan_limits') and not tgisinternal),",
  " 'has_signup_auth_hook',to_regprocedure('public.hook_enforce_tayar_signup_policy(jsonb)') is not null,",
  " 'auth_hook_anon_exec',has_function_privilege('anon','public.hook_enforce_tayar_signup_policy(jsonb)','EXECUTE'),",
  " 'auth_hook_admin_exec',has_function_privilege('supabase_auth_admin','public.hook_enforce_tayar_signup_policy(jsonb)','EXECUTE'),",
  " 'has_stripe_event_claim',to_regprocedure('public.claim_stripe_webhook_event(text,text,text,bigint)') is not null,",
  " 'has_webhook_events',to_regclass('public.stripe_webhook_events') is not null,",
  " 'has_custom_domains',to_regclass('public.website_custom_domains') is not null,",
  " 'custom_domains_rls',(select relrowsecurity from pg_class where oid='public.website_custom_domains'::regclass),",
  " 'custom_domains_anon_insert',has_table_privilege('anon','public.website_custom_domains','INSERT'),",
  " 'custom_domains_user_insert',has_table_privilege('authenticated','public.website_custom_domains','INSERT'),",
  " 'has_citext_in_extensions',(select extnamespace::regnamespace::text = 'extensions' from pg_extension where extname='citext'),",
  " 'vault_fixture_empty',(select count(*)=0 from vault.decrypted_secrets)",
  ') || jsonb_build_object(',
  " 'form_upload_bucket',(select count(*) from storage.buckets where id='website-form-uploads'),",
  " 'has_project_comments',to_regclass('public.website_project_comments') is not null,",
  " 'has_project_presence',to_regclass('public.website_project_presence') is not null,",
  " 'has_forms',to_regclass('public.website_forms') is not null,",
  " 'has_form_deliveries',to_regclass('public.website_form_deliveries') is not null,",
  " 'has_publish_schedules',to_regclass('public.website_publish_schedules') is not null,",
  " 'has_redirects',to_regclass('public.website_redirects') is not null,",
  " 'collaboration_rls',(select count(*)=2 from pg_class where oid in ('public.website_project_comments'::regclass,'public.website_project_presence'::regclass) and relrowsecurity),",
  " 'form_rls',(select count(*)=2 from pg_class where oid in ('public.website_forms'::regclass,'public.website_form_deliveries'::regclass) and relrowsecurity),",
  " 'publishing_rls',(select count(*)=2 from pg_class where oid in ('public.website_publish_schedules'::regclass,'public.website_redirects'::regclass) and relrowsecurity),",
  " 'realtime_collaboration',(select count(*)=2 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('website_project_comments','website_project_presence')),",
  " 'scheduler_ready',public.website_publish_scheduler_ready(),",
  " 'scheduler_guard',(select count(*)=1 from pg_trigger where tgname='website_publish_scheduler_safety_guard' and not tgisinternal),",
  " 'cron_absent',to_regnamespace('cron') is null,",
  " 'net_absent',to_regnamespace('net') is null,",
  " 'has_ai_reservations',to_regclass('public.ai_usage_reservations') is not null,",
  " 'ai_reservations_rls',(select relrowsecurity from pg_class where oid='public.ai_usage_reservations'::regclass),",
  " 'ai_reservations_anon_insert',has_table_privilege('anon','public.ai_usage_reservations','INSERT'),",
  " 'ai_reservations_user_insert',has_table_privilege('authenticated','public.ai_usage_reservations','INSERT'),",
  " 'ai_reserve_service_exec',has_function_privilege('service_role','public.reserve_ai_tool_usage(uuid,text,integer,timestamptz)','EXECUTE'),",
  " 'ai_reserve_anon_exec',has_function_privilege('anon','public.reserve_ai_tool_usage(uuid,text,integer,timestamptz)','EXECUTE'),",
  " 'ai_complete_service_exec',has_function_privilege('service_role','public.complete_ai_tool_usage(uuid,uuid,text,text,text,integer,integer,integer,text)','EXECUTE'),",
  " 'ai_complete_anon_exec',has_function_privilege('anon','public.complete_ai_tool_usage(uuid,uuid,text,text,text,integer,integer,integer,text)','EXECUTE')" ,
  '))::text;',
].join('\n');
const bootstrap = [
  'CREATE ROLE anon NOLOGIN;',
  'CREATE ROLE authenticated NOLOGIN;',
  'CREATE ROLE service_role NOLOGIN;',
  'CREATE ROLE supabase_auth_admin NOLOGIN;',
  'CREATE SCHEMA auth;',
  'CREATE SCHEMA storage;',
  'CREATE SCHEMA vault;',
  'CREATE SCHEMA extensions;',
  'CREATE PUBLICATION supabase_realtime;',
  // Empty structural stand-in ONLY. No actual Vault decryption or secret handling is modeled.
  "CREATE VIEW vault.decrypted_secrets AS SELECT NULL::uuid AS id, NULL::text AS decrypted_secret WHERE false;",
  'CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);',
  'CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL REFERENCES storage.buckets(id), name text NOT NULL);',
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;',
  "CREATE OR REPLACE FUNCTION storage.foldername(object_name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(object_name, '/') $$;",
  "CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);",
  "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
  "CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;",
  "CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;",
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
    assert.equal(selected.at(-1).target, '20261005150724_atomic_ai_quota_reservations.sql');
    // These 79 reviewed migrations include historical disabled scheduler and atomic AI quota receipts.
    // No cron or net schema is installed: historical schedule SQL must skip side effects.
    // Synthetic Realtime publication has no subscribers, network, replication or credentials.
    // Synthetic Auth/Storage/Vault dependencies are ONLY disposable structural fixtures.
    // Empty Vault view is NOT a substitute for real Supabase encrypted Vault behavior.
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
      assert.equal(Number(values.storage_buckets), 4, 'All four reviewed Storage buckets must exist.');
      assert.equal(Number(values.template_library_bucket), 1, 'Historical template-library bucket must exist.');
      assert.equal(Number(values.storage_policies), 13, 'Thirteen reviewed Storage object RLS policies must exist.');
      assert.equal(Number(values.storage_rls), 1, 'Storage objects must have RLS enabled.');
      assert.equal(values.has_website_versions, true, 'Reviewed publish-version table must exist and survive restore.');
      for (const key of [
        'has_billing_entitlements', 'has_team_workspaces', 'has_website_rate_limits',
        'has_ai_rate_limits', 'has_template_sources', 'has_account_blocks',
        'has_access_overrides', 'has_tool_access_rules', 'has_tool_plan_limits',
      ]) {
        assert.equal(values[key], true, 'Reviewed historical object missing: ' + key);
      }
      assert.equal(values.team_workspaces_rls, true, 'Reviewed team workspaces must enforce RLS.');
      for (const key of [
        'has_tool_access_state', 'has_check_tool_usage', 'has_tool_plan_rank',
        'has_subscription_grace',
      ]) {
        assert.equal(values[key], true, 'Reviewed historical tool/billing RPC missing: ' + key);
      }
      for (const key of [
        'has_ai_providers', 'ai_provider_rls', 'has_ai_provider_runtime',
        'ai_provider_service_exec', 'has_admin_audit_trigger', 'has_signup_auth_hook',
        'auth_hook_admin_exec', 'has_stripe_event_claim', 'has_webhook_events',
        'has_custom_domains', 'custom_domains_rls', 'has_citext_in_extensions',
        'vault_fixture_empty',
      ]) {
        assert.equal(values[key], true, 'Historical AI/Auth/domain requirement missing: ' + key);
      }
      for (const key of ['ai_provider_anon_exec', 'auth_hook_anon_exec',
        'custom_domains_anon_insert', 'custom_domains_user_insert']) {
        assert.equal(values[key], false, 'Historical API permission unexpectedly open: ' + key);
      }
      assert.equal(Number(values.form_upload_bucket), 1, 'Private website-form-uploads bucket must be present.');
      for (const key of [
        'has_project_comments', 'has_project_presence', 'has_forms', 'has_form_deliveries',
        'has_publish_schedules', 'has_redirects', 'collaboration_rls', 'form_rls',
        'publishing_rls', 'realtime_collaboration',
      ]) {
        assert.equal(values[key], true, 'Historical collaboration/forms/publish object missing: ' + key);
      }
      for (const key of [
        'scheduler_guard', 'cron_absent', 'net_absent', 'has_ai_reservations',
        'ai_reservations_rls', 'ai_reserve_service_exec', 'ai_complete_service_exec',
      ]) {
        assert.equal(values[key], true, 'Historical scheduler/quota guard missing: ' + key);
      }
      for (const key of [
        'scheduler_ready', 'ai_reservations_anon_insert', 'ai_reservations_user_insert',
        'ai_reserve_anon_exec', 'ai_complete_anon_exec',
      ]) {
        assert.equal(values[key], false, 'Historical scheduler/quota boundary unexpectedly enabled: ' + key);
      }
      assert.equal(Number(values.auth_rows), 1, 'Synthetic auth account must exist.');
      assert.equal(Number(values.profile_rows), 1, 'Historical profile trigger must insert owner profile.');
      // Preserve ACLs: stripping grants silently reopens SECDEF RPCs to PUBLIC on restore.
      // All referenced roles exist only in this disposable PostgreSQL container.
      inside(name, 'pg_dump', '-U', 'postgres', '-d', database, '-Fc',
        '--no-owner', '-f', archive);
      inside(name, 'createdb', '-U', 'postgres', restore);
      inside(name, 'pg_restore', '-U', 'postgres', '-d', restore,
        '--no-owner', '--exit-on-error', archive);
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
