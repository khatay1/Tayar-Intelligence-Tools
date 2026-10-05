import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { PGlite } = await import(process.env.TAYAR_PGLITE_MODULE || '@electric-sql/pglite');
const { pgcrypto } = await import(process.env.TAYAR_PGCRYPTO_MODULE || '@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const userId = '11111111-1111-4111-8111-111111111111';

try {
  await db.exec(`
    create extension pgcrypto;
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.ai_usage(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      provider text not null default 'openai', model text not null default 'fixture',
      tool text not null, tokens_in int not null default 0, tokens_out int not null default 0,
      duration_ms int default 0, status text not null default 'success',
      cost_usd numeric(10,6) default 0, created_at timestamptz default now()
    );
    insert into auth.users values ('${userId}');
  `);
  const migration = await fs.readFile(new URL('../supabase/migrations/20261005165000_atomic_ai_quota_reservations.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec('set role service_role');

  const reserve = (tool = 'ai-chat') => db.query(
    'select public.reserve_ai_tool_usage($1,$2,$3,$4) as id',
    [userId, tool, 1, '2026-10-01T00:00:00.000Z'],
  );
  const attempts = await Promise.allSettled([reserve(), reserve(), reserve()]);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((item) => item.status === 'rejected').length, 2);
  const reservationId = attempts.find((item) => item.status === 'fulfilled').value.rows[0].id;

  await db.query('select public.complete_ai_tool_usage($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
    reservationId, userId, 'fixture', 'fixture-model', 'ai-chat', 2, 3, 20, 'success',
  ]);
  await assert.rejects(reserve(), /usage limit reached/i);
  await db.exec('reset role');
  const usage = await db.query("select status,tokens_in,tokens_out from public.ai_usage where tool='ai-chat'");
  assert.deepEqual(usage.rows, [{ status: 'success', tokens_in: 2, tokens_out: 3 }]);

  await db.exec('set role service_role');
  const errorReservation = (await reserve('ai-writer')).rows[0].id;
  await db.query('select public.complete_ai_tool_usage($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
    errorReservation, userId, 'fixture', 'fixture-model', 'ai-writer', 0, 0, 5, 'error',
  ]);
  await reserve('ai-writer');

  await db.exec('reset role');
  const privileges = await db.query(`select
    has_function_privilege('authenticated','public.reserve_ai_tool_usage(uuid,text,integer,timestamptz)','execute') as authenticated_reserve,
    has_function_privilege('service_role','public.reserve_ai_tool_usage(uuid,text,integer,timestamptz)','execute') as service_reserve`);
  assert.deepEqual(privileges.rows[0], { authenticated_reserve: false, service_reserve: true });
  console.log('AI quota reservation regression: PASS (atomic bound, completion, release, grants)');
} finally {
  await db.close();
}
