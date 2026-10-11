-- Unified social inbox foundation. Provider credentials stay in server-managed secret storage.

create table public.social_hubs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.team_workspaces(id) on delete cascade,
  scope text not null default 'customer' check (scope in ('customer', 'tayar_official')),
  name text not null check (length(btrim(name)) between 2 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'customer' and workspace_id is not null) or (scope = 'tayar_official' and workspace_id is null))
);
create unique index social_hubs_customer_workspace_uq on public.social_hubs(workspace_id) where scope = 'customer';
create unique index social_hubs_official_uq on public.social_hubs(scope) where scope = 'tayar_official';

create table public.social_channel_connections (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  provider text not null check (provider in ('whatsapp', 'telegram', 'messenger', 'instagram')),
  provider_account_id text not null check (length(provider_account_id) between 1 and 200),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected', 'degraded', 'error', 'revoked')),
  secret_ref text check (secret_ref is null or secret_ref ~ '^secret://social/[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9_-]+$'),
  webhook_secret_ref text check (webhook_secret_ref is null or webhook_secret_ref ~ '^secret://social/[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9_-]+$'),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  last_error_code text,
  last_error_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hub_id, provider, provider_account_id)
);
create index social_connections_hub_status_idx on public.social_channel_connections(hub_id, status, provider);

create table public.social_contacts (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  display_name text not null default '',
  email text,
  phone text,
  lifecycle text not null default 'lead' check (lifecycle in ('lead', 'qualified', 'customer', 'inactive')),
  assigned_to uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(tags) <= 50 and length(notes) <= 20000)
);
create index social_contacts_hub_updated_idx on public.social_contacts(hub_id, updated_at desc, id desc);
create index social_contacts_assigned_idx on public.social_contacts(hub_id, assigned_to) where assigned_to is not null;

create table public.social_contact_identities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.social_contacts(id) on delete cascade,
  connection_id uuid not null references public.social_channel_connections(id) on delete cascade,
  provider_user_id text not null check (length(provider_user_id) between 1 and 300),
  username text,
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_user_id),
  unique (contact_id, connection_id)
);
create index social_contact_identities_contact_idx on public.social_contact_identities(contact_id);

create table public.social_conversations (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  connection_id uuid not null references public.social_channel_connections(id) on delete cascade,
  contact_id uuid not null references public.social_contacts(id) on delete cascade,
  provider_thread_id text not null check (length(provider_thread_id) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'spam')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  unread_count integer not null default 0 check (unread_count between 0 and 1000000),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_thread_id)
);
create index social_conversations_inbox_idx on public.social_conversations(hub_id, status, last_message_at desc, id desc);
create index social_conversations_assigned_idx on public.social_conversations(hub_id, assigned_to, last_message_at desc) where assigned_to is not null;

create table public.social_messages (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  conversation_id uuid not null references public.social_conversations(id) on delete cascade,
  connection_id uuid not null references public.social_channel_connections(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_kind text not null check (sender_kind in ('contact', 'agent', 'automation', 'ai')),
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 16000),
  content_type text not null default 'text' check (content_type in ('text', 'image', 'audio', 'video', 'file', 'location', 'template')),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  provider_message_id text,
  client_request_id uuid,
  delivery_status text not null default 'received' check (delivery_status in ('received', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  failure_code text,
  reply_to_message_id uuid references public.social_messages(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index social_messages_provider_id_uq on public.social_messages(connection_id, provider_message_id) where provider_message_id is not null;
create unique index social_messages_request_uq on public.social_messages(hub_id, client_request_id) where client_request_id is not null;
create index social_messages_thread_idx on public.social_messages(conversation_id, created_at desc, id desc);
create index social_messages_hub_status_idx on public.social_messages(hub_id, delivery_status, created_at) where direction = 'outbound';

create table public.social_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  message_id uuid not null unique references public.social_messages(id) on delete cascade,
  state text not null default 'queued' check (state in ('queued', 'processing', 'retry', 'succeeded', 'dead', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_delivery_jobs_ready_idx on public.social_delivery_jobs(next_attempt_at, id) where state in ('queued', 'retry');

create table public.social_webhook_events (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  connection_id uuid not null references public.social_channel_connections(id) on delete cascade,
  provider_event_id text not null check (length(provider_event_id) between 1 and 500),
  event_type text not null check (length(event_type) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) in ('object', 'array')),
  signature_verified boolean not null,
  state text not null default 'received' check (state in ('received', 'processed', 'ignored', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (connection_id, provider_event_id)
);
create index social_webhook_events_pending_idx on public.social_webhook_events(received_at, id) where state in ('received', 'failed');

create table public.social_automation_rules (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  enabled boolean not null default false,
  trigger_type text not null check (trigger_type in ('message_received', 'conversation_opened', 'keyword', 'outside_hours')),
  conditions jsonb not null default '{}'::jsonb check (jsonb_typeof(conditions) = 'object'),
  action_type text not null check (action_type in ('assign', 'tag', 'reply_template', 'ai_draft', 'ai_reply')),
  action_config jsonb not null default '{}'::jsonb check (jsonb_typeof(action_config) = 'object'),
  ai_requires_approval boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (action_type <> 'ai_reply' or ai_requires_approval = true)
);
create index social_automation_rules_hub_idx on public.social_automation_rules(hub_id, enabled, trigger_type);

create table public.social_automation_runs (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  rule_id uuid not null references public.social_automation_rules(id) on delete cascade,
  trigger_message_id uuid not null references public.social_messages(id) on delete cascade,
  outbound_message_id uuid references public.social_messages(id) on delete set null,
  state text not null check (state in ('queued','completed','skipped','failed')),
  created_at timestamptz not null default now(),
  unique (rule_id, trigger_message_id)
);
create index social_automation_runs_hub_idx on public.social_automation_runs(hub_id, created_at desc);

create table public.social_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  conversation_id uuid not null references public.social_conversations(id) on delete cascade,
  source_message_id uuid references public.social_messages(id) on delete set null,
  body text not null check (length(body) between 1 and 16000),
  state text not null default 'draft' check (state in ('draft', 'approved', 'rejected', 'expired')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index social_ai_drafts_review_idx on public.social_ai_drafts(hub_id, state, created_at desc);

create table public.social_audit_log (
  id bigint generated always as identity primary key,
  hub_id uuid not null references public.social_hubs(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 160),
  target_type text not null check (length(target_type) between 1 and 80),
  target_id text not null check (length(target_id) between 1 and 300),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index social_audit_log_hub_idx on public.social_audit_log(hub_id, created_at desc, id desc);

insert into public.tool_access_rules(tool_id, minimum_plan, enabled)
values ('social-hub', 'business', true)
on conflict (tool_id) do nothing;

alter table public.social_hubs enable row level security;
alter table public.social_channel_connections enable row level security;
alter table public.social_contacts enable row level security;
alter table public.social_contact_identities enable row level security;
alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;
alter table public.social_delivery_jobs enable row level security;
alter table public.social_webhook_events enable row level security;
alter table public.social_automation_rules enable row level security;
alter table public.social_automation_runs enable row level security;
alter table public.social_ai_drafts enable row level security;
alter table public.social_audit_log enable row level security;

create or replace function public.social_hub_has_access(p_hub_id uuid, p_min_role text default 'viewer')
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.social_hubs h
    where h.id = p_hub_id and (
      (h.scope = 'tayar_official' and public.is_admin()) or
      (h.scope = 'customer' and public.team_workspace_role(h.workspace_id) is not null and
        case p_min_role
          when 'viewer' then true
          when 'editor' then public.team_workspace_role(h.workspace_id) in ('owner','admin','editor')
          when 'admin' then public.team_workspace_role(h.workspace_id) in ('owner','admin')
          when 'owner' then public.team_workspace_role(h.workspace_id) = 'owner'
          else false
        end)
    )
  )
$$;
revoke all on function public.social_hub_has_access(uuid, text) from public, anon;
grant execute on function public.social_hub_has_access(uuid, text) to authenticated;

create policy social_hubs_read on public.social_hubs for select to authenticated using (public.social_hub_has_access(id));
create policy social_connections_read on public.social_channel_connections for select to authenticated using (public.social_hub_has_access(hub_id));
create policy social_contacts_read on public.social_contacts for select to authenticated using (public.social_hub_has_access(hub_id));
create policy social_identities_read on public.social_contact_identities for select to authenticated using (exists (
  select 1 from public.social_contacts c where c.id = contact_id and public.social_hub_has_access(c.hub_id)
));
create policy social_conversations_read on public.social_conversations for select to authenticated using (public.social_hub_has_access(hub_id));
create policy social_messages_read on public.social_messages for select to authenticated using (public.social_hub_has_access(hub_id));
create policy social_automations_read on public.social_automation_rules for select to authenticated using (public.social_hub_has_access(hub_id));
create policy social_ai_drafts_read on public.social_ai_drafts for select to authenticated using (public.social_hub_has_access(hub_id));
create policy social_audit_read on public.social_audit_log for select to authenticated using (public.social_hub_has_access(hub_id, 'admin'));

revoke all on table public.social_hubs, public.social_channel_connections, public.social_contacts,
  public.social_contact_identities, public.social_conversations, public.social_messages,
  public.social_delivery_jobs, public.social_webhook_events, public.social_automation_rules,
  public.social_automation_runs, public.social_ai_drafts, public.social_audit_log from anon, authenticated;

create or replace function public.ensure_social_hub(p_workspace_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_role text; v_id uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select public.team_workspace_role(p_workspace_id), name into v_role, v_name from public.team_workspaces where id = p_workspace_id;
  if v_role is null or v_role not in ('owner','admin') then raise exception 'Workspace manager access required'; end if;
  insert into public.social_hubs(workspace_id, scope, name, created_by)
  values (p_workspace_id, 'customer', coalesce(v_name, 'Workspace') || ' Social Hub', auth.uid())
  on conflict (workspace_id) where scope = 'customer' do update set updated_at = public.social_hubs.updated_at
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolve_social_hub(p_workspace_id uuid)
returns uuid language plpgsql stable security definer set search_path = public
as $$
declare v_id uuid;
begin
  if public.team_workspace_role(p_workspace_id) is null then raise exception 'Workspace access required'; end if;
  select id into v_id from public.social_hubs where workspace_id = p_workspace_id and scope = 'customer';
  return v_id;
end;
$$;

create or replace function public.social_hub_overview(p_hub_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.social_hub_has_access(p_hub_id) then raise exception 'Social hub access required'; end if;
  select jsonb_build_object(
    'hub', jsonb_build_object('id', h.id, 'name', h.name, 'scope', h.scope, 'workspaceId', h.workspace_id),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'provider', c.provider, 'displayName', c.display_name,
      'status', c.status, 'lastErrorCode', c.last_error_code, 'lastErrorAt', c.last_error_at) order by c.provider, c.display_name)
      from public.social_channel_connections c where c.hub_id = h.id), '[]'::jsonb),
    'counts', jsonb_build_object(
      'open', (select count(*) from public.social_conversations x where x.hub_id = h.id and x.status = 'open'),
      'unread', (select coalesce(sum(unread_count),0) from public.social_conversations x where x.hub_id = h.id),
      'failed', (select count(*) from public.social_delivery_jobs j where j.hub_id = h.id and j.state = 'dead'),
      'pendingDrafts', (select count(*) from public.social_ai_drafts d where d.hub_id = h.id and d.state = 'draft')
    )
  ) into v_result from public.social_hubs h where h.id = p_hub_id;
  return v_result;
end;
$$;

create or replace function public.list_social_conversations(
  p_hub_id uuid, p_status text default null, p_provider text default null, p_limit integer default 50,
  p_before timestamptz default null, p_before_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.social_hub_has_access(p_hub_id) then raise exception 'Social hub access required'; end if;
  if p_status is not null and p_status not in ('open','pending','resolved','spam') then raise exception 'Invalid status'; end if;
  if p_provider is not null and p_provider not in ('whatsapp','telegram','messenger','instagram') then raise exception 'Invalid provider'; end if;
  if p_limit < 1 or p_limit > 100 or ((p_before is null) <> (p_before_id is null)) then raise exception 'Invalid pagination'; end if;
  select coalesce(jsonb_agg(row_data order by sort_at desc, sort_id desc), '[]'::jsonb) into v_result from (
    select x.last_message_at sort_at, x.id sort_id, jsonb_build_object(
      'id', x.id, 'status', x.status, 'priority', x.priority, 'assignedTo', x.assigned_to, 'unreadCount', x.unread_count,
      'lastMessageAt', x.last_message_at, 'provider', c.provider, 'connectionName', c.display_name,
      'contact', jsonb_build_object('id', k.id, 'displayName', k.display_name, 'lifecycle', k.lifecycle, 'tags', k.tags),
      'lastMessage', (select jsonb_build_object('id', m.id, 'direction', m.direction, 'body', left(m.body, 500), 'deliveryStatus', m.delivery_status, 'createdAt', m.created_at)
        from public.social_messages m where m.conversation_id = x.id order by m.created_at desc, m.id desc limit 1)
    ) row_data
    from public.social_conversations x
    join public.social_channel_connections c on c.id = x.connection_id
    join public.social_contacts k on k.id = x.contact_id
    where x.hub_id = p_hub_id and (p_status is null or x.status = p_status) and (p_provider is null or c.provider = p_provider)
      and (p_before is null or (x.last_message_at, x.id) < (p_before, p_before_id))
    order by x.last_message_at desc, x.id desc limit p_limit
  ) q;
  return v_result;
end;
$$;

create or replace function public.get_social_conversation(p_hub_id uuid, p_conversation_id uuid, p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.social_hub_has_access(p_hub_id) or p_limit < 1 or p_limit > 200 then raise exception 'Social hub access required'; end if;
  if public.social_hub_has_access(p_hub_id, 'editor') then
    update public.social_conversations set unread_count = 0, updated_at = now()
    where id = p_conversation_id and hub_id = p_hub_id;
  end if;
  select jsonb_build_object(
    'conversation', jsonb_build_object('id', x.id, 'status', x.status, 'priority', x.priority, 'assignedTo', x.assigned_to,
      'provider', c.provider, 'connectionName', c.display_name),
    'contact', jsonb_build_object('id', k.id, 'displayName', k.display_name, 'email', k.email, 'phone', k.phone,
      'lifecycle', k.lifecycle, 'tags', k.tags, 'notes', k.notes, 'assignedTo', k.assigned_to),
    'messages', coalesce((select jsonb_agg(msg order by "createdAt", id) from (
      select m.id, m.direction, m.sender_kind as "senderKind", m.sender_user_id as "senderUserId", m.body,
        m.content_type as "contentType", m.media, m.delivery_status as "deliveryStatus", m.failure_code as "failureCode",
        m.created_at as "createdAt", m.sent_at as "sentAt"
      from public.social_messages m where m.conversation_id = x.id order by m.created_at desc, m.id desc limit p_limit
    ) msg), '[]'::jsonb)
  ) into v_result
  from public.social_conversations x join public.social_channel_connections c on c.id = x.connection_id
  join public.social_contacts k on k.id = x.contact_id where x.id = p_conversation_id and x.hub_id = p_hub_id;
  if v_result is null then raise exception 'Conversation not found'; end if;
  return v_result;
end;
$$;

create or replace function public.queue_social_reply(p_hub_id uuid, p_conversation_id uuid, p_body text, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_message_id uuid; v_connection_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  if not public.social_hub_has_access(p_hub_id, 'editor') then raise exception 'Editor access required'; end if;
  if length(v_body) < 1 or length(v_body) > 4000 or p_request_id is null then raise exception 'Invalid reply'; end if;
  select connection_id into v_connection_id from public.social_conversations where id = p_conversation_id and hub_id = p_hub_id and status <> 'spam';
  if v_connection_id is null then raise exception 'Conversation unavailable'; end if;
  select id into v_message_id from public.social_messages where hub_id = p_hub_id and client_request_id = p_request_id;
  if v_message_id is not null then return v_message_id; end if;
  insert into public.social_messages(hub_id, conversation_id, connection_id, direction, sender_kind, sender_user_id, body, client_request_id, delivery_status)
  values (p_hub_id, p_conversation_id, v_connection_id, 'outbound', 'agent', auth.uid(), v_body, p_request_id, 'queued')
  on conflict (hub_id, client_request_id) where client_request_id is not null do nothing returning id into v_message_id;
  if v_message_id is null then
    select id into v_message_id from public.social_messages where hub_id = p_hub_id and client_request_id = p_request_id;
    return v_message_id;
  end if;
  insert into public.social_delivery_jobs(hub_id, message_id) values (p_hub_id, v_message_id);
  update public.social_conversations set last_message_at = now(), updated_at = now() where id = p_conversation_id;
  insert into public.social_audit_log(hub_id, actor_user_id, action, target_type, target_id)
  values (p_hub_id, auth.uid(), 'message.queued', 'message', v_message_id::text);
  return v_message_id;
end;
$$;

create or replace function public.update_social_conversation(p_hub_id uuid, p_conversation_id uuid, p_status text, p_priority text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.social_hub_has_access(p_hub_id, 'editor') then raise exception 'Editor access required'; end if;
  if p_status not in ('open','pending','resolved','spam') or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid conversation update'; end if;
  update public.social_conversations set status = p_status, priority = p_priority, updated_at = now()
  where id = p_conversation_id and hub_id = p_hub_id;
  if not found then raise exception 'Conversation not found'; end if;
  insert into public.social_audit_log(hub_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_hub_id, auth.uid(), 'conversation.updated', 'conversation', p_conversation_id::text,
    jsonb_build_object('status', p_status, 'priority', p_priority));
end;
$$;

create or replace function public.create_social_ai_draft(p_hub_id uuid, p_conversation_id uuid, p_source_message_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_body text := btrim(coalesce(p_body,''));
begin
  if not public.social_hub_has_access(p_hub_id, 'editor') then raise exception 'Editor access required'; end if;
  if length(v_body) not between 1 and 4000 or not exists (select 1 from public.social_conversations where id = p_conversation_id and hub_id = p_hub_id) then raise exception 'Invalid AI draft'; end if;
  if p_source_message_id is not null and not exists (select 1 from public.social_messages where id = p_source_message_id and conversation_id = p_conversation_id) then raise exception 'Invalid draft source'; end if;
  update public.social_ai_drafts set state = 'expired', reviewed_at = now() where conversation_id = p_conversation_id and state = 'draft';
  insert into public.social_ai_drafts(hub_id, conversation_id, source_message_id, body, requested_by)
  values (p_hub_id, p_conversation_id, p_source_message_id, v_body, auth.uid()) returning id into v_id;
  insert into public.social_audit_log(hub_id, actor_user_id, action, target_type, target_id)
  values (p_hub_id, auth.uid(), 'ai_draft.created', 'ai_draft', v_id::text);
  return v_id;
end;
$$;

create or replace function public.review_social_ai_draft(p_hub_id uuid, p_draft_id uuid, p_approve boolean, p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_draft public.social_ai_drafts%rowtype; v_connection_id uuid; v_message_id uuid;
begin
  if not public.social_hub_has_access(p_hub_id, 'editor') then raise exception 'Editor access required'; end if;
  select * into v_draft from public.social_ai_drafts where id = p_draft_id and hub_id = p_hub_id and state = 'draft' for update;
  if v_draft.id is null then raise exception 'AI draft unavailable'; end if;
  if not p_approve then
    update public.social_ai_drafts set state = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() where id = p_draft_id;
    insert into public.social_audit_log(hub_id, actor_user_id, action, target_type, target_id) values (p_hub_id, auth.uid(), 'ai_draft.rejected', 'ai_draft', p_draft_id::text);
    return null;
  end if;
  if p_request_id is null then raise exception 'Request identity required'; end if;
  select id into v_message_id from public.social_messages where hub_id = p_hub_id and client_request_id = p_request_id;
  if v_message_id is not null then return v_message_id; end if;
  select connection_id into v_connection_id from public.social_conversations where id = v_draft.conversation_id and hub_id = p_hub_id and status <> 'spam';
  if v_connection_id is null then raise exception 'Conversation unavailable'; end if;
  insert into public.social_messages(hub_id, conversation_id, connection_id, direction, sender_kind, sender_user_id, body, client_request_id, delivery_status)
  values (p_hub_id, v_draft.conversation_id, v_connection_id, 'outbound', 'ai', auth.uid(), v_draft.body, p_request_id, 'queued') returning id into v_message_id;
  insert into public.social_delivery_jobs(hub_id, message_id) values (p_hub_id, v_message_id);
  update public.social_ai_drafts set state = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = p_draft_id;
  update public.social_conversations set last_message_at = now(), updated_at = now() where id = v_draft.conversation_id;
  insert into public.social_audit_log(hub_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_hub_id, auth.uid(), 'ai_draft.approved', 'ai_draft', p_draft_id::text, jsonb_build_object('messageId', v_message_id));
  return v_message_id;
end;
$$;

create or replace function public.list_social_automations(p_hub_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.social_hub_has_access(p_hub_id) then raise exception 'Social hub access required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'enabled', enabled, 'triggerType', trigger_type,
    'conditions', conditions, 'actionType', action_type, 'actionConfig', action_config, 'aiRequiresApproval', ai_requires_approval,
    'updatedAt', updated_at) order by created_at, id), '[]'::jsonb) into v_result from public.social_automation_rules where hub_id = p_hub_id;
  return v_result;
end;
$$;

create or replace function public.save_social_automation(
  p_hub_id uuid, p_id uuid, p_name text, p_enabled boolean, p_trigger_type text,
  p_conditions jsonb, p_action_type text, p_action_config jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if not public.social_hub_has_access(p_hub_id, 'admin') then raise exception 'Workspace manager access required'; end if;
  if length(btrim(coalesce(p_name,''))) not between 1 and 160
    or p_trigger_type not in ('message_received','conversation_opened','keyword','outside_hours')
    or p_action_type not in ('assign','tag','reply_template','ai_draft','ai_reply')
    or jsonb_typeof(p_conditions) <> 'object' or octet_length(p_conditions::text) > 8000
    or jsonb_typeof(p_action_config) <> 'object' or octet_length(p_action_config::text) > 16000 then raise exception 'Invalid automation'; end if;
  if p_trigger_type = 'keyword' and (length(btrim(coalesce(p_conditions->>'keyword',''))) not between 1 and 100) then raise exception 'Keyword required'; end if;
  if p_action_type = 'reply_template' and (length(btrim(coalesce(p_action_config->>'text',''))) not between 1 and 4000) then raise exception 'Reply template required'; end if;
  insert into public.social_automation_rules(id, hub_id, name, enabled, trigger_type, conditions, action_type, action_config, ai_requires_approval, created_by)
  values (v_id, p_hub_id, left(btrim(p_name),160), p_enabled, p_trigger_type, p_conditions, p_action_type, p_action_config, true, auth.uid())
  on conflict (id) do update set name = excluded.name, enabled = excluded.enabled, trigger_type = excluded.trigger_type,
    conditions = excluded.conditions, action_type = excluded.action_type, action_config = excluded.action_config,
    ai_requires_approval = true, updated_at = now()
  where public.social_automation_rules.hub_id = p_hub_id;
  if not found then raise exception 'Automation unavailable'; end if;
  insert into public.social_audit_log(hub_id, actor_user_id, action, target_type, target_id)
  values (p_hub_id, auth.uid(), 'automation.saved', 'automation', v_id::text);
  return v_id;
end;
$$;

revoke all on function public.ensure_social_hub(uuid), public.resolve_social_hub(uuid), public.social_hub_overview(uuid),
  public.list_social_conversations(uuid,text,text,integer,timestamptz,uuid), public.get_social_conversation(uuid,uuid,integer),
  public.queue_social_reply(uuid,uuid,text,uuid), public.update_social_conversation(uuid,uuid,text,text),
  public.create_social_ai_draft(uuid,uuid,uuid,text), public.review_social_ai_draft(uuid,uuid,boolean,uuid),
  public.list_social_automations(uuid), public.save_social_automation(uuid,uuid,text,boolean,text,jsonb,text,jsonb) from public, anon;
grant execute on function public.ensure_social_hub(uuid), public.resolve_social_hub(uuid), public.social_hub_overview(uuid),
  public.list_social_conversations(uuid,text,text,integer,timestamptz,uuid), public.get_social_conversation(uuid,uuid,integer),
  public.queue_social_reply(uuid,uuid,text,uuid), public.update_social_conversation(uuid,uuid,text,text),
  public.create_social_ai_draft(uuid,uuid,uuid,text), public.review_social_ai_draft(uuid,uuid,boolean,uuid),
  public.list_social_automations(uuid), public.save_social_automation(uuid,uuid,text,boolean,text,jsonb,text,jsonb) to authenticated;

create table private.social_channel_secrets (
  connection_id uuid primary key references public.social_channel_connections(id) on delete cascade,
  token_secret_id uuid not null,
  webhook_secret_id uuid not null,
  verify_token_secret_id uuid,
  updated_at timestamptz not null default now()
);
revoke all on table private.social_channel_secrets from public, anon, authenticated;

create or replace function public.social_connection_runtime(p_connection_id uuid)
returns table(provider text, provider_account_id text, token text, webhook_secret text, verify_token text)
language sql security definer set search_path = public, private, vault
as $$
  select c.provider, c.provider_account_id, token.decrypted_secret, webhook.decrypted_secret, verify.decrypted_secret
  from public.social_channel_connections c
  join private.social_channel_secrets s on s.connection_id = c.id
  join vault.decrypted_secrets token on token.id = s.token_secret_id
  join vault.decrypted_secrets webhook on webhook.id = s.webhook_secret_id
  left join vault.decrypted_secrets verify on verify.id = s.verify_token_secret_id
  where c.id = p_connection_id and c.status in ('connected','degraded')
$$;
revoke all on function public.social_connection_runtime(uuid) from public, anon, authenticated;
grant execute on function public.social_connection_runtime(uuid) to service_role;

create or replace function public.ingest_social_webhook(
  p_connection_id uuid, p_event_id text, p_event_type text, p_provider_user_id text,
  p_provider_thread_id text, p_provider_message_id text, p_display_name text,
  p_body text, p_content_type text, p_payload jsonb, p_profile jsonb default '{}'::jsonb
)
returns text language plpgsql security definer set search_path = public
as $$
declare v_hub_id uuid; v_contact_id uuid; v_conversation_id uuid; v_event uuid; v_inbound_id uuid; v_outbound_id uuid; v_rule record;
begin
  select hub_id into v_hub_id from public.social_channel_connections where id = p_connection_id and status in ('connected','degraded');
  if v_hub_id is null or length(p_event_id) not between 1 and 500 or length(p_event_type) not between 1 and 160
    or length(p_provider_user_id) not between 1 and 300 or length(p_provider_thread_id) not between 1 and 300
    or length(p_provider_message_id) not between 1 and 500 or length(p_body) not between 1 and 16000
    or p_content_type not in ('text','image','audio','video','file','location','template')
    or jsonb_typeof(p_payload) not in ('object','array') or octet_length(p_payload::text) > 262144
    or jsonb_typeof(p_profile) <> 'object' then raise exception 'Invalid social event'; end if;
  insert into public.social_webhook_events(hub_id, connection_id, provider_event_id, event_type, payload, signature_verified)
  values (v_hub_id, p_connection_id, p_event_id, p_event_type, p_payload, true)
  on conflict (connection_id, provider_event_id) do nothing returning id into v_event;
  if v_event is null then return 'duplicate'; end if;

  select i.contact_id into v_contact_id from public.social_contact_identities i
  where i.connection_id = p_connection_id and i.provider_user_id = p_provider_user_id;
  if v_contact_id is null then
    insert into public.social_contacts(hub_id, display_name) values (v_hub_id, left(coalesce(nullif(btrim(p_display_name),''), p_provider_user_id),160)) returning id into v_contact_id;
    insert into public.social_contact_identities(contact_id, connection_id, provider_user_id, profile)
    values (v_contact_id, p_connection_id, p_provider_user_id, p_profile);
  else
    update public.social_contacts set display_name = left(coalesce(nullif(btrim(p_display_name),''), display_name),160), updated_at = now() where id = v_contact_id;
    update public.social_contact_identities set profile = p_profile, updated_at = now()
    where connection_id = p_connection_id and provider_user_id = p_provider_user_id;
  end if;

  insert into public.social_conversations(hub_id, connection_id, contact_id, provider_thread_id)
  values (v_hub_id, p_connection_id, v_contact_id, p_provider_thread_id)
  on conflict (connection_id, provider_thread_id) do update set contact_id = excluded.contact_id, updated_at = now()
  returning id into v_conversation_id;
  insert into public.social_messages(hub_id, conversation_id, connection_id, direction, sender_kind, body, content_type, provider_message_id, delivery_status, sent_at)
  values (v_hub_id, v_conversation_id, p_connection_id, 'inbound', 'contact', p_body, p_content_type, p_provider_message_id, 'received', now())
  on conflict (connection_id, provider_message_id) where provider_message_id is not null do nothing returning id into v_inbound_id;
  if v_inbound_id is not null then
    update public.social_conversations set unread_count = least(unread_count + 1, 1000000), last_message_at = now(), status = case when status = 'resolved' then 'open' else status end, updated_at = now()
    where id = v_conversation_id;
    for v_rule in select r.* from public.social_automation_rules r
      where r.hub_id = v_hub_id and r.enabled and r.action_type = 'reply_template'
        and (r.trigger_type = 'message_received' or (r.trigger_type = 'keyword' and position(lower(r.conditions->>'keyword') in lower(p_body)) > 0))
      order by r.created_at, r.id limit 5
    loop
      insert into public.social_messages(hub_id, conversation_id, connection_id, direction, sender_kind, body, delivery_status)
      values (v_hub_id, v_conversation_id, p_connection_id, 'outbound', 'automation', left(v_rule.action_config->>'text',4000), 'queued') returning id into v_outbound_id;
      insert into public.social_delivery_jobs(hub_id, message_id) values (v_hub_id, v_outbound_id);
      insert into public.social_automation_runs(hub_id, rule_id, trigger_message_id, outbound_message_id, state)
      values (v_hub_id, v_rule.id, v_inbound_id, v_outbound_id, 'queued') on conflict (rule_id, trigger_message_id) do nothing;
    end loop;
  end if;
  update public.social_webhook_events set state = 'processed', processed_at = now(), attempt_count = 1 where id = v_event;
  return 'processed';
exception when others then
  if v_event is not null then update public.social_webhook_events set state = 'failed', attempt_count = attempt_count + 1, last_error_code = sqlstate where id = v_event; end if;
  raise;
end;
$$;

create or replace function public.claim_social_delivery_job(p_worker_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_job public.social_delivery_jobs%rowtype; v_result jsonb;
begin
  if length(p_worker_id) not between 1 and 120 then raise exception 'Invalid worker'; end if;
  select * into v_job from public.social_delivery_jobs
  where state in ('queued','retry') and next_attempt_at <= now()
  order by next_attempt_at, id for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  update public.social_delivery_jobs set state = 'processing', locked_at = now(), locked_by = p_worker_id,
    attempt_count = attempt_count + 1, updated_at = now() where id = v_job.id;
  update public.social_messages set delivery_status = 'sending' where id = v_job.message_id;
  select jsonb_build_object('jobId', j.id, 'messageId', m.id, 'connectionId', c.id, 'provider', c.provider,
    'providerAccountId', c.provider_account_id, 'recipientId', i.provider_user_id, 'body', m.body, 'attemptCount', j.attempt_count)
  into v_result from public.social_delivery_jobs j join public.social_messages m on m.id = j.message_id
  join public.social_conversations x on x.id = m.conversation_id
  join lateral (
    select identity.provider_user_id
    from public.social_contact_identities identity
    where identity.contact_id = x.contact_id and identity.connection_id = x.connection_id
    order by identity.created_at, identity.id
    limit 1
  ) i on true
  join public.social_channel_connections c on c.id = x.connection_id where j.id = v_job.id;
  if v_result is null then
    update public.social_delivery_jobs set state = 'dead', last_error_code = 'recipient_missing', updated_at = now() where id = v_job.id;
    update public.social_messages set delivery_status = 'failed', failure_code = 'recipient_missing' where id = v_job.message_id;
  end if;
  return v_result;
end;
$$;

create or replace function public.complete_social_delivery_job(p_job_id uuid, p_provider_message_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_message_id uuid;
begin
  if length(p_provider_message_id) not between 1 and 500 then raise exception 'Invalid provider message'; end if;
  update public.social_delivery_jobs set state = 'succeeded', locked_at = null, locked_by = null, updated_at = now()
  where id = p_job_id and state = 'processing' returning message_id into v_message_id;
  if v_message_id is null then raise exception 'Delivery job unavailable'; end if;
  update public.social_messages set delivery_status = 'sent', provider_message_id = p_provider_message_id, sent_at = now(), failure_code = null where id = v_message_id;
  update public.social_automation_runs set state = 'completed' where outbound_message_id = v_message_id;
end;
$$;

create or replace function public.fail_social_delivery_job(p_job_id uuid, p_error_code text, p_error_detail text, p_retryable boolean)
returns text language plpgsql security definer set search_path = public
as $$
declare v_job public.social_delivery_jobs%rowtype; v_state text;
begin
  if length(p_error_code) not between 1 and 120 then raise exception 'Invalid delivery failure'; end if;
  select * into v_job from public.social_delivery_jobs where id = p_job_id and state = 'processing' for update;
  if v_job.id is null then raise exception 'Delivery job unavailable'; end if;
  v_state := case when p_retryable and v_job.attempt_count < 8 then 'retry' else 'dead' end;
  update public.social_delivery_jobs set state = v_state, next_attempt_at = case when v_state = 'retry' then now() + make_interval(secs => least(3600, 15 * (2 ^ least(attempt_count,8))::integer)) else next_attempt_at end,
    locked_at = null, locked_by = null, last_error_code = left(p_error_code,120), last_error_detail = left(coalesce(p_error_detail,''),2000), updated_at = now() where id = p_job_id;
  update public.social_messages set delivery_status = case when v_state = 'retry' then 'queued' else 'failed' end, failure_code = left(p_error_code,120) where id = v_job.message_id;
  if v_state = 'dead' then update public.social_automation_runs set state = 'failed' where outbound_message_id = v_job.message_id; end if;
  return v_state;
end;
$$;

revoke all on function public.ingest_social_webhook(uuid,text,text,text,text,text,text,text,text,jsonb,jsonb),
  public.claim_social_delivery_job(text), public.complete_social_delivery_job(uuid,text),
  public.fail_social_delivery_job(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.ingest_social_webhook(uuid,text,text,text,text,text,text,text,text,jsonb,jsonb),
  public.claim_social_delivery_job(text), public.complete_social_delivery_job(uuid,text),
  public.fail_social_delivery_job(uuid,text,text,boolean) to service_role;
