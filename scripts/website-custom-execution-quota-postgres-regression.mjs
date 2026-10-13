import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const databaseUrl = process.env.TAYAR_CUSTOM_EXECUTION_QUOTA_TEST_DATABASE_URL;
if (!databaseUrl) {
  console.log('Website custom execution quota PostgreSQL regression skipped (test database URL is not set).');
  process.exit(0);
}

const psql = (...args) => execFileSync('psql', [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', ...args], { encoding: 'utf8' }).trim();
psql('-c', `
  create table public.tool_access_rules (
    tool_id text primary key,
    minimum_plan text not null check (minimum_plan in ('free','pro','business')),
    enabled boolean not null default true
  );
  create table public.tool_plan_limits (
    tool_id text primary key references public.tool_access_rules(tool_id) on delete cascade,
    free_limit integer, pro_limit integer, business_limit integer,
    period text not null check (period in ('daily','monthly','lifetime'))
  );
`);
const migration = resolve('supabase/migrations/20261013233709_website_custom_execution_quota.sql');
psql('-f', migration);
assert.equal(psql('-c', `
  select r.tool_id || '|' || r.minimum_plan || '|' || r.enabled::text || '|'
      || l.free_limit || '|' || l.pro_limit || '|' || l.business_limit || '|' || l.period
  from public.tool_access_rules r join public.tool_plan_limits l using (tool_id)
  where r.tool_id='website-custom-execution';
`), 'website-custom-execution|pro|false|0|10|50|monthly');
psql('-c', `update public.tool_access_rules set enabled=true where tool_id='website-custom-execution';`);
psql('-f', migration);
assert.equal(psql('-c', `select enabled::text from public.tool_access_rules where tool_id='website-custom-execution';`), 'true',
  'rerunning the source migration must not overwrite an administrator setting');
console.log('Website custom execution quota PostgreSQL migration regression passed.');
