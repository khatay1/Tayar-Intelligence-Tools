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
  create extension if not exists pgcrypto;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  end $$;
  create schema auth;
  create table auth.users(id uuid primary key);
  create table public.ai_usage (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null, model text not null, tool text not null, tokens_in integer not null,
    tokens_out integer not null, duration_ms integer not null, status text not null,
    cost_usd numeric not null default 0, created_at timestamptz not null default now()
  );
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
psql('-f', resolve('supabase/migrations/20261005165000_atomic_ai_quota_reservations.sql'));
psql('-f', resolve('supabase/migrations/20261014195000_count_custom_execution_errors.sql'));
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

const userId = '11111111-1111-4111-8111-111111111111';
psql('-c', `insert into auth.users(id) values ('${userId}');`);
const asServiceRole = query => psql('--quiet', '-c', `set role service_role; ${query}; reset role;`);
const reserve = tool => asServiceRole(`select public.reserve_ai_tool_usage('${userId}', '${tool}', 1, '2026-10-01T00:00:00Z')`);
const customReservation = reserve('website-custom-execution').split('\n').filter(Boolean).at(-1);
assert.match(customReservation, /^[0-9a-f-]{36}$/i);
asServiceRole(`select public.complete_ai_tool_usage('${customReservation}', '${userId}', 'vercel-sandbox', 'node22', 'website-custom-execution', 0, 0, 5, 'error')`);
assert.throws(() => reserve('website-custom-execution'), error =>
  /usage limit reached/i.test(`${error.stdout ?? ''}${error.stderr ?? ''}`),
  'an errored custom sandbox attempt still consumes its quota');

const ordinaryReservation = reserve('ai-writer').split('\n').filter(Boolean).at(-1);
asServiceRole(`select public.complete_ai_tool_usage('${ordinaryReservation}', '${userId}', 'fixture', 'fixture', 'ai-writer', 0, 0, 5, 'error')`);
assert.match(reserve('ai-writer'), /^[0-9a-f-]{36}$/i,
  'ordinary tool errors retain the existing non-consuming behavior');
console.log('Website custom execution quota PostgreSQL migration regression passed.');
