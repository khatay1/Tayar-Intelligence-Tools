import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const temp = await mkdtemp(join(tmpdir(), 'tayar-social-hub-'));
try {
  const output = join(temp, 'social.cjs');
  await build({ entryPoints: ['supabase/functions/_shared/social-channels.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: output });
  const { normalizeSocialWebhook, verifyMetaSignature } = require(output);

  const whatsappPayload = { entry: [{ changes: [{ value: { contacts: [{ wa_id: '46700000000', profile: { name: 'Ada' } }], messages: [{ id: 'wamid.1', from: '46700000000', type: 'text', text: { body: 'Hello' } }] } }] }] };
  assert.deepEqual(normalizeSocialWebhook('whatsapp', whatsappPayload), [{ eventId: 'wamid.1', eventType: 'message.text', providerUserId: '46700000000', providerThreadId: '46700000000', providerMessageId: 'wamid.1', displayName: 'Ada', body: 'Hello', contentType: 'text', profile: {} }]);

  const metaPayload = { entry: [{ messaging: [{ sender: { id: 'sender-1' }, recipient: { id: 'page-1' }, message: { mid: 'mid.1', text: 'Need help' } }] }] };
  for (const provider of ['messenger', 'instagram']) {
    const [event] = normalizeSocialWebhook(provider, metaPayload);
    assert.equal(event.providerUserId, 'sender-1');
    assert.equal(event.providerMessageId, 'mid.1');
    assert.equal(event.body, 'Need help');
  }

  const [telegram] = normalizeSocialWebhook('telegram', { update_id: 99, message: { message_id: 4, text: 'Hej', chat: { id: -123, type: 'group' }, from: { id: 7, first_name: 'Lin', username: 'lin' } } });
  assert.equal(telegram.eventId, '99');
  assert.equal(telegram.providerThreadId, '-123');
  assert.equal(telegram.providerMessageId, '-123:4');
  assert.equal(telegram.displayName, 'Lin');

  const secret = 'meta-webhook-secret-long-enough', raw = JSON.stringify(metaPayload);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const signature = `sha256=${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  assert.equal(await verifyMetaSignature(raw, signature, secret), true);
  assert.equal(await verifyMetaSignature(`${raw} `, signature, secret), false);
  assert.equal(normalizeSocialWebhook('telegram', { update_id: 1 }).length, 0);

  const migration = await readFile(resolve('supabase/migrations/20261011120000_social_hub_foundation.sql'), 'utf8');
  for (const table of ['social_hubs', 'social_channel_connections', 'social_contacts', 'social_conversations', 'social_messages', 'social_delivery_jobs', 'social_webhook_events', 'social_automation_rules', 'social_ai_drafts', 'social_audit_log']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} must enable RLS`);
  }
  assert.match(migration, /revoke all on table[\s\S]+from anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.ingest_social_webhook[\s\S]+to service_role/i);
  assert.match(migration, /on conflict \(hub_id, client_request_id\)[\s\S]+do nothing/i, 'manual replies must be idempotent');
  assert.match(migration, /for update skip locked limit 1/i, 'workers must claim jobs without double delivery');
  assert.match(migration, /unique \(contact_id, connection_id\)/i, 'each conversation route must resolve to one provider recipient');
  assert.match(migration, /join lateral \([\s\S]+limit 1[\s\S]+\) i on true/i, 'delivery claims must resolve one deterministic recipient');
  assert.match(migration, /attempt_count < 8[\s\S]+then 'retry' else 'dead'/i, 'retries must be bounded');
  assert.match(migration, /scope in \('customer', 'tayar_official'\)/i, 'official Tayar channels must have a separate scope');
  assert.match(migration, /action_type <> 'ai_reply' or ai_requires_approval = true/i, 'AI automations may never bypass approval');
  assert.match(migration, /create or replace function public\.review_social_ai_draft[\s\S]+state = 'approved'[\s\S]+social_delivery_jobs/i, 'AI drafts must be explicitly approved before delivery');
  assert.match(migration, /for v_rule in select[\s\S]+action_type = 'reply_template'[\s\S]+social_automation_runs/i, 'enabled keyword templates must execute through audited delivery jobs');

  const worker = await readFile(resolve('supabase/functions/social-delivery-worker/index.ts'), 'utf8');
  assert.match(worker, /SOCIAL_WORKER_CRON_SECRET/);
  assert.match(worker, /api\.telegram\.org/);
  assert.match(worker, /graph\.facebook\.com/);
  assert.doesNotMatch(worker, /console\.(?:log|error).*token/i, 'provider tokens must never be logged');
  const webhook = await readFile(resolve('supabase/functions/social-channel-webhook/index.ts'), 'utf8');
  assert.match(webhook, /x-telegram-bot-api-secret-token/i);
  assert.match(webhook, /x-hub-signature-256/i);
  assert.match(webhook, /readBoundedBody/);

  const ui = await readFile(resolve('src/modules/social-hub/SocialHubTool.tsx'), 'utf8');
  assert.match(ui, /Account and credential linking is reserved for the final activation step/);
  assert.doesNotMatch(ui, /type=["']password["']|apiKey|accessToken/, 'the pre-activation UI must not collect credentials');

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_SOCIAL_HUB_TEST_DATABASE_URL;
    const url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/tayar_social_hub_test') {
      throw new Error('An isolated local tayar_social_hub_test database is required.');
    }
    const query = input => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolveQuery(stdout.trim()) : reject(new Error(stderr)));
      child.stdin.end(input);
    });
    const owner = '10000000-0000-4000-8000-000000000001';
    const outsider = '10000000-0000-4000-8000-000000000002';
    const workspace = '20000000-0000-4000-8000-000000000001';
    const connection = '30000000-0000-4000-8000-000000000001';
    const setup = `
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth; create schema private; create schema vault;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.team_workspaces(id uuid primary key, name text not null);
create table public.team_workspace_members(workspace_id uuid not null, user_id uuid not null, role text not null, primary key(workspace_id,user_id));
create function public.team_workspace_role(p_workspace_id uuid) returns text language sql stable security definer set search_path=public
as $$ select role from public.team_workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() $$;
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
create table public.tool_access_rules(tool_id text primary key, minimum_plan text not null, enabled boolean not null);
create table vault.decrypted_secrets(id uuid primary key, decrypted_secret text not null);
grant usage on schema public, auth to authenticated, service_role;
insert into auth.users values ('${owner}'),('${outsider}');
insert into public.team_workspaces values ('${workspace}','Regression Workspace');
insert into public.team_workspace_members values ('${workspace}','${owner}','owner');
${migration}
`;
    await query(setup);
    const asUser = user => `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`;
    const hub = (await query(`${asUser(owner)} select public.ensure_social_hub('${workspace}');`)).split('\n').at(-1);
    assert.match(hub, /^[0-9a-f-]{36}$/i);
    await assert.rejects(query(`${asUser(outsider)} select public.resolve_social_hub('${workspace}');`), /Workspace access required/);
    await assert.rejects(query(`${asUser(owner)} select count\(\*\) from public.social_messages;`), /permission denied/i, 'clients must use scoped RPCs instead of reading tables directly');
    await query(`reset role;
      insert into public.social_channel_connections(id,hub_id,provider,provider_account_id,display_name,status)
      values ('${connection}','${hub}','telegram','bot-1','Regression bot','connected');`);
    const ingest = eventId => `set role service_role; select public.ingest_social_webhook('${connection}','${eventId}','message.text','recipient-1','thread-1','message-${eventId}','Ada','pricing please','text','{}','{}');`;
    assert.equal((await query(ingest('event-1'))).split('\n').at(-1), 'processed');
    assert.equal((await query(ingest('event-1'))).split('\n').at(-1), 'duplicate');
    const conversation = await query(`reset role; select id from public.social_conversations where hub_id='${hub}';`);
    const requestId = '40000000-0000-4000-8000-000000000001';
    const firstReply = (await query(`${asUser(owner)} select public.queue_social_reply('${hub}','${conversation}','I can help.','${requestId}');`)).split('\n').at(-1);
    const repeatedReply = (await query(`${asUser(owner)} select public.queue_social_reply('${hub}','${conversation}','I can help.','${requestId}');`)).split('\n').at(-1);
    assert.equal(repeatedReply, firstReply, 'manual reply retries must return the committed message');
    assert.equal(await query(`reset role; select count(*) from public.social_delivery_jobs where message_id='${firstReply}';`), '1');
    const draft = (await query(`${asUser(owner)} select public.create_social_ai_draft('${hub}','${conversation}',null,'Suggested answer');`)).split('\n').at(-1);
    assert.equal(await query(`reset role; select count(*) from public.social_delivery_jobs where message_id in (select id from public.social_messages where sender_kind='ai');`), '0');
    const aiRequest = '40000000-0000-4000-8000-000000000002';
    const aiMessage = (await query(`${asUser(owner)} select public.review_social_ai_draft('${hub}','${draft}',true,'${aiRequest}');`)).split('\n').at(-1);
    assert.equal(await query(`reset role; select count(*) from public.social_delivery_jobs where message_id='${aiMessage}';`), '1');
    const claimed = JSON.parse((await query(`set role service_role; select public.claim_social_delivery_job('regression-worker');`)).split('\n').at(-1));
    assert.equal(claimed.recipientId, 'recipient-1');
    assert.equal(claimed.attemptCount, 1);
    console.log('PASS Social Hub PostgreSQL: migration, RPC isolation, webhook idempotency, manual retry, AI approval and deterministic delivery claim');
  }
  console.log('PASS Social Hub: four-provider normalization/signatures, tenant isolation, idempotent inbox, bounded delivery and deferred credential activation');
} finally {
  await rm(temp, { recursive: true, force: true });
}
