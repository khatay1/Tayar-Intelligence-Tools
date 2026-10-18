-- Disabled by default. No production credentials, provider calls or new identity system.
create schema if not exists private;
create table private.social_hub_scopes (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('customer','official')),
 owner_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.team_workspaces(id) on delete cascade,
 project_id uuid references public.projects(id) on delete cascade,
 enabled boolean not null default false, automation_enabled boolean not null default false,
 created_at timestamptz not null default now(),
 check(kind <> 'official' or (workspace_id is null and project_id is null))
);
create index social_hub_scopes_owner on private.social_hub_scopes(owner_id);
create index social_hub_scopes_workspace on private.social_hub_scopes(workspace_id);
create index social_hub_scopes_project on private.social_hub_scopes(project_id);
create table private.social_hub_connections (
 id uuid primary key default gen_random_uuid(), scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 channel text not null check(channel in ('whatsapp','telegram','facebook','instagram')),
 external_account_id text not null check(length(external_account_id) between 1 and 200),
 status text not null default 'disconnected' check(status in ('pending','connected','disconnected','expired')),
 owner_user_id uuid not null references auth.users(id),secret_ref text, scopes text[] not null default '{}', permissions_verified boolean not null default false,
 webhook_verified boolean not null default false, expires_at timestamptz, version integer not null default 1,
 created_at timestamptz not null default now(), unique(id,scope_id),
 check(secret_ref is null or secret_ref ~ '^[0-9a-f-]{36}$')
);
create unique index social_hub_account_exclusive on private.social_hub_connections(channel,external_account_id) where status in ('pending','connected');
create table private.social_hub_conversations (
 id uuid primary key default gen_random_uuid(),scope_id uuid not null,connection_id uuid not null,
 external_id text not null,customer_name text not null default '',status text not null default 'open' check(status in ('open','pending','resolved','archived','human_required')),
 assigned_to uuid references auth.users(id) on delete set null, crm_reference jsonb,
 last_message_at timestamptz not null default now(), created_at timestamptz not null default now(),
 foreign key(connection_id,scope_id) references private.social_hub_connections(id,scope_id) on delete cascade,
 unique(connection_id,external_id),unique(id,scope_id,connection_id),unique(id,scope_id)
);
create index social_hub_conversations_inbox on private.social_hub_conversations(scope_id,last_message_at desc);
create index social_hub_connection_owner on private.social_hub_connections(owner_user_id);
create index social_hub_conversations_assigned on private.social_hub_conversations(assigned_to);
create table private.social_hub_messages (
 id uuid primary key default gen_random_uuid(),scope_id uuid not null,conversation_id uuid not null,connection_id uuid not null,
 external_id text not null,direction text not null check(direction in ('inbound','outbound')),text text not null check(length(text)<=16000),
 attachment_refs jsonb not null default '[]' check(jsonb_typeof(attachment_refs)='array'),occurred_at timestamptz not null,created_at timestamptz not null default now(),
 foreign key(conversation_id,scope_id,connection_id) references private.social_hub_conversations(id,scope_id,connection_id) on delete cascade,
 unique(connection_id,external_id)
);
create index social_hub_messages_conversation on private.social_hub_messages(conversation_id,occurred_at);
create table private.social_hub_notes (
 id uuid primary key default gen_random_uuid(),scope_id uuid not null,conversation_id uuid not null,
 author_id uuid not null references auth.users(id),text text not null check(length(btrim(text)) between 1 and 8000),created_at timestamptz not null default now(),
 foreign key(conversation_id,scope_id) references private.social_hub_conversations(id,scope_id) on delete cascade
);
create index social_hub_notes_conversation on private.social_hub_notes(conversation_id);
create index social_hub_notes_author on private.social_hub_notes(author_id);
create table private.social_hub_webhook_events (
 connection_id uuid not null,scope_id uuid not null,event_id text not null,received_at timestamptz not null default now(),
 primary key(connection_id,event_id), foreign key(connection_id,scope_id) references private.social_hub_connections(id,scope_id) on delete cascade
);
create table private.social_hub_outbox (
 id uuid primary key default gen_random_uuid(),scope_id uuid not null,conversation_id uuid not null,connection_id uuid not null,
 requested_by uuid not null references auth.users(id),text text not null check(length(btrim(text)) between 1 and 4000),idempotency_key text not null check(length(idempotency_key) between 8 and 200),
 status text not null default 'queued' check(status in ('queued','sending','accepted','rejected','review','cancelled')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 5),available_at timestamptz not null default now(),
 lease_until timestamptz,claim_token uuid,provider_message_id text,last_error_code text,created_at timestamptz not null default now(),
 foreign key(conversation_id,scope_id,connection_id) references private.social_hub_conversations(id,scope_id,connection_id) on delete cascade,
 unique(scope_id,idempotency_key)
);
create index social_hub_outbox_due on private.social_hub_outbox(status,available_at);
create index social_hub_outbox_conversation on private.social_hub_outbox(conversation_id);
create index social_hub_outbox_requester on private.social_hub_outbox(requested_by);
create table private.social_hub_oauth_states (
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,channel text not null check(channel in ('whatsapp','facebook','instagram')),
 expires_at timestamptz not null,consumed_at timestamptz,metadata jsonb not null default '{}'
);
create index social_hub_oauth_scope on private.social_hub_oauth_states(scope_id);
create index social_hub_oauth_user on private.social_hub_oauth_states(user_id);

-- Authorization is calculated from existing authoritative memberships, never user JWT metadata.
create function private.social_hub_access(p_scope_id uuid,p_write boolean default false,p_manage boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.social_hub_scopes s where s.id=p_scope_id and
 case when s.kind='official' then public.is_admin()
 when s.workspace_id is null then s.owner_id=auth.uid()
 else exists(select 1 from public.team_workspace_members m where m.workspace_id=s.workspace_id and m.user_id=auth.uid()
 and (not p_write or m.role in ('owner','admin','editor')) and (not p_manage or m.role in ('owner','admin'))) end)
$$;
revoke all on function private.social_hub_access(uuid,boolean,boolean) from public,anon;
grant execute on function private.social_hub_access(uuid,boolean,boolean) to authenticated;

-- All persistence is private, RLS enabled as defense in depth. Client mutations only through checked RPCs.
do $$ declare t text; begin
 foreach t in array array['scopes','connections','conversations','messages','notes','webhook_events','outbox','oauth_states'] loop
 execute format('alter table private.social_hub_%I enable row level security',t);
 execute format('revoke all on private.social_hub_%I from public,anon,authenticated',t);
 execute format('grant all on private.social_hub_%I to service_role',t);
 end loop;
end $$;
create policy social_hub_scope_read on private.social_hub_scopes for select to authenticated using(private.social_hub_access(id));

create function private.list_social_hub_scopes() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(s)) from private.social_hub_scopes s where private.social_hub_access(s.id)),'[]');
end $$;
create function private.create_social_hub_scope(p_kind text,p_workspace_id uuid default null,p_project_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 if auth.uid() is null or p_kind is null or p_kind not in ('customer','official') then raise exception 'Invalid scope' using errcode='42501'; end if;
 if p_kind='official' and (not public.is_admin() or p_workspace_id is not null or p_project_id is not null) then raise exception 'Official scope requires administrator' using errcode='42501';end if;
 if p_workspace_id is not null and not exists(select 1 from public.team_workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Workspace manager required' using errcode='42501';end if;
 if p_project_id is not null and not exists(select 1 from public.projects p where p.id=p_project_id and p.deleted_at is null and ((p_workspace_id is null and p.user_id=auth.uid()) or (p_workspace_id is not null and p.workspace_id=p_workspace_id))) then raise exception 'Project access required' using errcode='42501';end if;
 insert into private.social_hub_scopes(kind,owner_id,workspace_id,project_id) values(p_kind,auth.uid(),p_workspace_id,p_project_id) returning id into v_id;return v_id;
end $$;
create function private.get_social_hub_inbox(p_scope_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.social_hub_access(p_scope_id) then raise exception 'Scope access required' using errcode='42501';end if;
 return jsonb_build_object('scope',(select to_jsonb(s) from private.social_hub_scopes s where id=p_scope_id),
 'connections',coalesce((select jsonb_agg(to_jsonb(c)-'secret_ref') from private.social_hub_connections c where scope_id=p_scope_id),'[]'),
 'conversations',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from private.social_hub_conversations where scope_id=p_scope_id order by last_message_at desc limit 100)c),'[]'),
 'messages',coalesce((select jsonb_agg(to_jsonb(m)) from (select * from private.social_hub_messages where scope_id=p_scope_id order by occurred_at desc limit 500)m),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)) from (select * from private.social_hub_notes where scope_id=p_scope_id order by created_at desc limit 200)n),'[]'),
 'outbox',coalesce((select jsonb_agg(to_jsonb(o)-'claim_token') from (select * from private.social_hub_outbox where scope_id=p_scope_id order by created_at desc limit 100)o),'[]'));
end $$;
create function private.mutate_social_hub_conversation(p_conversation_id uuid,p_status text default null,p_assigned_to uuid default null,p_note text default null,p_set_assignment boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare c private.social_hub_conversations;s private.social_hub_scopes;begin
 select * into c from private.social_hub_conversations where id=p_conversation_id for update;
 if not private.social_hub_access(c.scope_id,true) then raise exception 'Editor access required' using errcode='42501';end if;
 select * into s from private.social_hub_scopes where id=c.scope_id;
 if p_set_assignment and p_assigned_to is not null and not (
 (s.kind='official' and exists(select 1 from public.profiles where id=p_assigned_to and role='admin' and not coalesce(suspended,false))) or
 (s.kind='customer' and ((s.workspace_id is null and p_assigned_to=s.owner_id) or exists(select 1 from public.team_workspace_members where workspace_id=s.workspace_id and user_id=p_assigned_to and role in ('owner','admin','editor'))))) then raise exception 'Assignee outside scope' using errcode='42501';end if;
 update private.social_hub_conversations set status=coalesce(p_status,status),assigned_to=case when p_set_assignment then p_assigned_to else assigned_to end where id=p_conversation_id;
 if p_note is not null then insert into private.social_hub_notes(scope_id,conversation_id,author_id,text)values(c.scope_id,c.id,auth.uid(),p_note);end if;
end $$;
create function private.enqueue_social_hub_message(p_conversation_id uuid,p_text text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c private.social_hub_conversations;v_id uuid;v_old private.social_hub_outbox;begin
 select * into c from private.social_hub_conversations where id=p_conversation_id;
 if not private.social_hub_access(c.scope_id,true) then raise exception 'Editor access required' using errcode='42501';end if;
 if not exists(select 1 from private.social_hub_scopes where id=c.scope_id and enabled) then raise exception 'Social Hub disabled';end if;
 if not exists(select 1 from private.social_hub_connections where id=c.connection_id and status='connected' and permissions_verified and webhook_verified and (expires_at is null or expires_at>now())) then raise exception 'Channel not verified';end if;
 insert into private.social_hub_outbox(scope_id,conversation_id,connection_id,requested_by,text,idempotency_key)values(c.scope_id,c.id,c.connection_id,auth.uid(),p_text,p_idempotency_key)on conflict(scope_id,idempotency_key)do nothing returning id into v_id;
 if v_id is null then select * into v_old from private.social_hub_outbox where scope_id=c.scope_id and idempotency_key=p_idempotency_key;
 if v_old.conversation_id<>c.id or v_old.text<>p_text then raise exception 'Idempotency conflict';end if;v_id:=v_old.id;end if;return v_id;
end $$;
-- Service-only ingestion receives already signature-verified, account-bound normalized events.
create function private.ingest_social_hub_message(p_scope_id uuid,p_connection_id uuid,p_event_id text,p_external_conversation_id text,p_external_message_id text,p_sender_name text,p_text text,p_occurred_at timestamptz,p_attachment_refs jsonb default '[]')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_conversation uuid;v_message uuid;begin
 perform 1 from private.social_hub_scopes where id=p_scope_id and enabled;
 if not found then raise exception 'Social Hub disabled';end if;
 perform 1 from private.social_hub_connections where id=p_connection_id and scope_id=p_scope_id and status='connected' and permissions_verified and webhook_verified and (expires_at is null or expires_at>now());
 if not found then raise exception 'Channel not verified';end if;
 insert into private.social_hub_webhook_events(connection_id,scope_id,event_id)values(p_connection_id,p_scope_id,p_event_id)on conflict do nothing;
 if not found then return null;end if;
 insert into private.social_hub_conversations(scope_id,connection_id,external_id,customer_name,last_message_at)values(p_scope_id,p_connection_id,p_external_conversation_id,left(p_sender_name,200),p_occurred_at)
 on conflict(connection_id,external_id)do update set last_message_at=greatest(social_hub_conversations.last_message_at,excluded.last_message_at) returning id into v_conversation;
 insert into private.social_hub_messages(scope_id,conversation_id,connection_id,external_id,direction,text,attachment_refs,occurred_at)values(p_scope_id,v_conversation,p_connection_id,p_external_message_id,'inbound',p_text,p_attachment_refs,p_occurred_at)
 on conflict(connection_id,external_id)do nothing returning id into v_message;return v_message;
end $$;
create function private.claim_social_hub_outbox(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 -- An expired lease means the previous worker may have sent it: never blindly resend.
 update private.social_hub_outbox set status='review',last_error_code='lease_expired_ambiguous',claim_token=null where status='sending' and lease_until<now();
 with due as(select o.id from private.social_hub_outbox o join private.social_hub_scopes s on s.id=o.scope_id
 join private.social_hub_connections c on c.id=o.connection_id where o.status='queued' and o.available_at<=now() and o.attempt_count<5 and s.enabled and c.status='connected' and c.permissions_verified and c.webhook_verified and (c.expires_at is null or c.expires_at>now()) order by o.available_at for update of o skip locked limit greatest(1,least(p_limit,50))),
 claimed as(update private.social_hub_outbox o set status='sending',attempt_count=o.attempt_count+1,lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid() from due where o.id=due.id returning o.*)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;return result;
end $$;
create function private.settle_social_hub_outbox(p_id uuid,p_claim_token uuid,p_outcome text,p_provider_message_id text default null,p_error_code text default null,p_retry_after_seconds integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare v private.social_hub_outbox;begin
 select * into v from private.social_hub_outbox where id=p_id and claim_token=p_claim_token and status='sending' and lease_until>now() for update;
 if not found then raise exception 'Invalid or expired claim';end if;
 if p_outcome is null or p_outcome not in ('accepted','rejected','review') then raise exception 'Invalid outcome';end if;
 -- Only positively rejected rate-limit requests are eligible for a delayed retry.
 if p_retry_after_seconds is not null and (p_outcome<>'rejected' or p_error_code is distinct from 'rate_limited' or p_retry_after_seconds<1 or p_retry_after_seconds>86400 or v.attempt_count>=5) then raise exception 'Unsafe retry';end if;
 update private.social_hub_outbox set status=case when p_retry_after_seconds is not null then 'queued' else p_outcome end,
 provider_message_id=p_provider_message_id,last_error_code=left(p_error_code,100),lease_until=null,claim_token=null,
 available_at=case when p_retry_after_seconds is not null then now()+make_interval(secs=>p_retry_after_seconds) else available_at end where id=p_id;
end $$;
create function private.save_social_hub_oauth_state(p_state_hash text,p_scope_id uuid,p_user_id uuid,p_channel text,p_expires_at timestamptz,p_metadata jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.social_hub_scopes s where s.id=p_scope_id and ((s.kind='official' and exists(select 1 from public.profiles where id=p_user_id and role='admin' and not coalesce(suspended,false))) or (s.kind='customer' and ((s.workspace_id is null and s.owner_id=p_user_id) or exists(select 1 from public.team_workspace_members where workspace_id=s.workspace_id and user_id=p_user_id and role in ('owner','admin')))))) then raise exception 'Connection manager required';end if;
 if p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then raise exception 'Invalid OAuth expiry';end if;
 insert into private.social_hub_oauth_states(state_hash,scope_id,user_id,channel,expires_at,metadata)values(p_state_hash,p_scope_id,p_user_id,p_channel,p_expires_at,p_metadata);
end $$;
create function private.consume_social_hub_oauth_state(p_state_hash text,p_scope_id uuid,p_user_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 with consumed as(update private.social_hub_oauth_states set consumed_at=now() where state_hash=p_state_hash and scope_id=p_scope_id and user_id=p_user_id and consumed_at is null and expires_at>now() and exists(select 1 from private.social_hub_scopes s where s.id=p_scope_id and ((s.kind='official' and exists(select 1 from public.profiles where id=p_user_id and role='admin' and not coalesce(suspended,false))) or (s.kind='customer' and ((s.workspace_id is null and s.owner_id=p_user_id) or exists(select 1 from public.team_workspace_members where workspace_id=s.workspace_id and user_id=p_user_id and role in ('owner','admin')))))) returning *)select to_jsonb(consumed)from consumed
$$;
-- SECURITY INVOKER API wrappers delegate only to fixed, explicitly granted checked routines.

revoke all on function private.list_social_hub_scopes() from public,anon,authenticated;
grant execute on function private.list_social_hub_scopes() to authenticated;
create function public.list_social_hub_scopes() returns jsonb language sql security invoker set search_path='' as $$ select private.list_social_hub_scopes() $$;
revoke all on function public.list_social_hub_scopes() from public,anon,authenticated;
grant execute on function public.list_social_hub_scopes() to authenticated;

revoke all on function private.create_social_hub_scope(text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.create_social_hub_scope(text,uuid,uuid) to authenticated;
create function public.create_social_hub_scope(p_kind text,p_workspace_id uuid default null,p_project_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select private.create_social_hub_scope(p_kind,p_workspace_id,p_project_id) $$;
revoke all on function public.create_social_hub_scope(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_social_hub_scope(text,uuid,uuid) to authenticated;

revoke all on function private.get_social_hub_inbox(uuid) from public,anon,authenticated;
grant execute on function private.get_social_hub_inbox(uuid) to authenticated;
create function public.get_social_hub_inbox(p_scope_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_social_hub_inbox(p_scope_id) $$;
revoke all on function public.get_social_hub_inbox(uuid) from public,anon,authenticated;
grant execute on function public.get_social_hub_inbox(uuid) to authenticated;

revoke all on function private.mutate_social_hub_conversation(uuid,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function private.mutate_social_hub_conversation(uuid,text,uuid,text,boolean) to authenticated;
create function public.mutate_social_hub_conversation(p_conversation_id uuid,p_status text default null,p_assigned_to uuid default null,p_note text default null,p_set_assignment boolean default false) returns void language sql security invoker set search_path='' as $$ select private.mutate_social_hub_conversation(p_conversation_id,p_status,p_assigned_to,p_note,p_set_assignment) $$;
revoke all on function public.mutate_social_hub_conversation(uuid,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.mutate_social_hub_conversation(uuid,text,uuid,text,boolean) to authenticated;

revoke all on function private.enqueue_social_hub_message(uuid,text,text) from public,anon,authenticated;
grant execute on function private.enqueue_social_hub_message(uuid,text,text) to authenticated;
create function public.enqueue_social_hub_message(p_conversation_id uuid,p_text text,p_idempotency_key text) returns uuid language sql security invoker set search_path='' as $$ select private.enqueue_social_hub_message(p_conversation_id,p_text,p_idempotency_key) $$;
revoke all on function public.enqueue_social_hub_message(uuid,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_social_hub_message(uuid,text,text) to authenticated;

revoke all on function private.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb) to service_role;
create function public.ingest_social_hub_message(p_scope_id uuid,p_connection_id uuid,p_event_id text,p_external_conversation_id text,p_external_message_id text,p_sender_name text,p_text text,p_occurred_at timestamptz,p_attachment_refs jsonb default '[]') returns uuid language sql security invoker set search_path='' as $$ select private.ingest_social_hub_message(p_scope_id,p_connection_id,p_event_id,p_external_conversation_id,p_external_message_id,p_sender_name,p_text,p_occurred_at,p_attachment_refs) $$;
revoke all on function public.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb) to service_role;

revoke all on function private.claim_social_hub_outbox(integer) from public,anon,authenticated;
grant execute on function private.claim_social_hub_outbox(integer) to service_role;
create function public.claim_social_hub_outbox(p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_social_hub_outbox(p_limit) $$;
revoke all on function public.claim_social_hub_outbox(integer) from public,anon,authenticated;
grant execute on function public.claim_social_hub_outbox(integer) to service_role;

revoke all on function private.settle_social_hub_outbox(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function private.settle_social_hub_outbox(uuid,uuid,text,text,text,integer) to service_role;
create function public.settle_social_hub_outbox(p_id uuid,p_claim_token uuid,p_outcome text,p_provider_message_id text default null,p_error_code text default null,p_retry_after_seconds integer default null) returns void language sql security invoker set search_path='' as $$ select private.settle_social_hub_outbox(p_id,p_claim_token,p_outcome,p_provider_message_id,p_error_code,p_retry_after_seconds) $$;
revoke all on function public.settle_social_hub_outbox(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.settle_social_hub_outbox(uuid,uuid,text,text,text,integer) to service_role;

revoke all on function private.save_social_hub_oauth_state(text,uuid,uuid,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.save_social_hub_oauth_state(text,uuid,uuid,text,timestamptz,jsonb) to service_role;
create function public.save_social_hub_oauth_state(p_state_hash text,p_scope_id uuid,p_user_id uuid,p_channel text,p_expires_at timestamptz,p_metadata jsonb) returns void language sql security invoker set search_path='' as $$ select private.save_social_hub_oauth_state(p_state_hash,p_scope_id,p_user_id,p_channel,p_expires_at,p_metadata) $$;
revoke all on function public.save_social_hub_oauth_state(text,uuid,uuid,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.save_social_hub_oauth_state(text,uuid,uuid,text,timestamptz,jsonb) to service_role;

revoke all on function private.consume_social_hub_oauth_state(text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.consume_social_hub_oauth_state(text,uuid,uuid) to service_role;
create function public.consume_social_hub_oauth_state(p_state_hash text,p_scope_id uuid,p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.consume_social_hub_oauth_state(p_state_hash,p_scope_id,p_user_id) $$;
revoke all on function public.consume_social_hub_oauth_state(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_social_hub_oauth_state(text,uuid,uuid) to service_role;

grant usage on schema private to authenticated, service_role;
create function private.save_social_hub_connection(p_record jsonb,p_expected_version integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare s private.social_hub_scopes;v private.social_hub_connections;v_user uuid:=(p_record->>'ownerUserId')::uuid;v_id uuid:=(p_record->>'id')::uuid;v_scope uuid:=(p_record->>'tenantId')::uuid;begin
 select * into s from private.social_hub_scopes where id=v_scope;
 if s.id is null or s.kind is distinct from p_record->>'ownership' or not (
 (s.kind='official' and exists(select 1 from public.profiles where id=v_user and role='admin' and not coalesce(suspended,false))) or
 (s.kind='customer' and ((s.workspace_id is null and s.owner_id=v_user) or exists(select 1 from public.team_workspace_members where workspace_id=s.workspace_id and user_id=v_user and role in ('owner','admin'))))) then raise exception 'Connection manager required';end if;
 if p_record->>'status'='connected' and not exists(select 1 from private.social_hub_credentials where scope_id=v_scope and connection_id=v_id and secret_id::text=p_record->>'tokenRef') then raise exception 'Scoped credential required';end if;
 select * into v from private.social_hub_connections where id=v_id for update;
 if v.id is null then
 if p_expected_version is not null or (p_record->>'version')::int is distinct from 1 then raise exception 'Connection version conflict';end if;
 insert into private.social_hub_connections(id,scope_id,owner_user_id,channel,external_account_id,status,secret_ref,scopes,permissions_verified,webhook_verified,expires_at,version)
 values(v_id,v_scope,v_user,p_record->>'channel',p_record->>'accountId',p_record->>'status',p_record->>'tokenRef',array(select jsonb_array_elements_text(p_record->'scopes')),coalesce((p_record->>'permissionsVerified')::boolean,false),false,(p_record->>'expiresAt')::timestamptz,1);
 else
 if p_expected_version is null or v.version<>p_expected_version or (p_record->>'version')::int is distinct from v.version+1 or v.scope_id<>v_scope or v.channel<>p_record->>'channel' or v.external_account_id<>p_record->>'accountId' then raise exception 'Connection version conflict';end if;
 update private.social_hub_connections set owner_user_id=v_user,status=p_record->>'status',secret_ref=p_record->>'tokenRef',scopes=array(select jsonb_array_elements_text(p_record->'scopes')),permissions_verified=coalesce((p_record->>'permissionsVerified')::boolean,false),webhook_verified=false,expires_at=(p_record->>'expiresAt')::timestamptz,version=v.version+1 where id=v_id;
 if p_record->>'status'<>'connected' then update private.social_hub_outbox set status=case when status='sending' then 'review' else 'cancelled' end,last_error_code='connection_revoked' where connection_id=v_id and status in ('queued','sending');end if;
 end if;
end $$;
revoke all on function private.save_social_hub_connection(jsonb,integer) from public,anon,authenticated;
grant execute on function private.save_social_hub_connection(jsonb,integer) to service_role;
create function public.save_social_hub_connection(p_record jsonb,p_expected_version integer default null) returns void language sql security invoker set search_path='' as $$ select private.save_social_hub_connection(p_record,p_expected_version) $$;
revoke all on function public.save_social_hub_connection(jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_social_hub_connection(jsonb,integer) to service_role;
create function private.get_social_hub_connection(p_id uuid,p_scope_id uuid)returns jsonb language sql security definer set search_path='' as $$select to_jsonb(c)||jsonb_build_object('ownership',s.kind)from private.social_hub_connections c join private.social_hub_scopes s on s.id=c.scope_id where c.id=p_id and c.scope_id=p_scope_id$$;
revoke all on function private.get_social_hub_connection(uuid,uuid)from public,anon,authenticated;
grant execute on function private.get_social_hub_connection(uuid,uuid)to service_role;
create function public.get_social_hub_connection(p_id uuid,p_scope_id uuid)returns jsonb language sql security invoker set search_path='' as $$select private.get_social_hub_connection(p_id,p_scope_id)$$;
revoke all on function public.get_social_hub_connection(uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_social_hub_connection(uuid,uuid)to service_role;

-- Reuse Supabase Vault; staged credentials may precede the CAS connection write.
create table private.social_hub_credentials(
 secret_id uuid primary key,scope_id uuid not null references private.social_hub_scopes(id)on delete cascade,
 connection_id uuid not null,created_at timestamptz not null default now()
);
create index social_hub_credentials_scope on private.social_hub_credentials(scope_id);
create index social_hub_credentials_connection on private.social_hub_credentials(connection_id);
alter table private.social_hub_credentials enable row level security;
revoke all on private.social_hub_credentials from public,anon,authenticated;
grant all on private.social_hub_credentials to service_role;
create function private.social_hub_credential_cleanup()returns trigger language plpgsql security definer set search_path='' as $$
begin delete from vault.secrets where id=old.secret_id;return old;end $$;
revoke all on function private.social_hub_credential_cleanup()from public,anon,authenticated;
create trigger social_hub_credential_cleanup after delete on private.social_hub_credentials for each row execute function private.social_hub_credential_cleanup();
create function private.social_hub_store_credential(p_scope_id uuid,p_connection_id uuid,p_access_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 if not exists(select 1 from private.social_hub_scopes where id=p_scope_id) or exists(select 1 from private.social_hub_connections where id=p_connection_id and scope_id<>p_scope_id)then raise exception 'Invalid credential scope';end if;
 if p_access_token is null or length(p_access_token)<10 or length(p_access_token)>8192 or p_access_token~E'[\\r\\n]' then raise exception 'Invalid credential';end if;
 v_id:=vault.create_secret(p_access_token,'social-hub-'||gen_random_uuid()::text,'Social Hub scoped provider token',null);
 insert into private.social_hub_credentials(secret_id,scope_id,connection_id)values(v_id,p_scope_id,p_connection_id);return v_id;
end $$;
create function private.social_hub_revoke_credential(p_scope_id uuid,p_connection_id uuid,p_secret_ref uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.social_hub_credentials where secret_id=p_secret_ref and scope_id=p_scope_id and connection_id=p_connection_id;
 update private.social_hub_connections set secret_ref=null,status='disconnected',permissions_verified=false,webhook_verified=false,version=version+1 where id=p_connection_id and scope_id=p_scope_id and secret_ref=p_secret_ref::text;
 update private.social_hub_outbox set status=case when status='sending' then 'review' else 'cancelled' end,last_error_code='credential_revoked' where connection_id=p_connection_id and status in('queued','sending') and not exists(select 1 from private.social_hub_connections where id=p_connection_id and status='connected');
end $$;
create function private.read_social_hub_credential(p_scope_id uuid,p_connection_id uuid,p_secret_ref uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_secret text;begin
 select d.decrypted_secret into v_secret from private.social_hub_credentials v
 join vault.decrypted_secrets d on d.id=v.secret_id
 join private.social_hub_connections c on c.id=v.connection_id and c.scope_id=v.scope_id and c.secret_ref=v.secret_id::text
 join private.social_hub_scopes s on s.id=v.scope_id
 where v.scope_id=p_scope_id and v.connection_id=p_connection_id and v.secret_id=p_secret_ref
 and s.enabled and c.status='connected'and c.permissions_verified and c.webhook_verified and(c.expires_at is null or c.expires_at>now());
 return v_secret;
end $$;

revoke all on function private.social_hub_store_credential(uuid,uuid,text)from public,anon,authenticated;
grant execute on function private.social_hub_store_credential(uuid,uuid,text)to service_role;
create function public.social_hub_store_credential(p_scope_id uuid,p_connection_id uuid,p_access_token text)returns uuid language sql security invoker set search_path='' as $$select private.social_hub_store_credential(p_scope_id,p_connection_id,p_access_token)$$;
revoke all on function public.social_hub_store_credential(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.social_hub_store_credential(uuid,uuid,text)to service_role;

revoke all on function private.social_hub_revoke_credential(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function private.social_hub_revoke_credential(uuid,uuid,uuid)to service_role;
create function public.social_hub_revoke_credential(p_scope_id uuid,p_connection_id uuid,p_secret_ref uuid)returns void language sql security invoker set search_path='' as $$select private.social_hub_revoke_credential(p_scope_id,p_connection_id,p_secret_ref)$$;
revoke all on function public.social_hub_revoke_credential(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.social_hub_revoke_credential(uuid,uuid,uuid)to service_role;

revoke all on function private.read_social_hub_credential(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function private.read_social_hub_credential(uuid,uuid,uuid)to service_role;
create function public.read_social_hub_credential(p_scope_id uuid,p_connection_id uuid,p_secret_ref uuid)returns text language sql security invoker set search_path='' as $$select private.read_social_hub_credential(p_scope_id,p_connection_id,p_secret_ref)$$;
revoke all on function public.read_social_hub_credential(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.read_social_hub_credential(uuid,uuid,uuid)to service_role;
