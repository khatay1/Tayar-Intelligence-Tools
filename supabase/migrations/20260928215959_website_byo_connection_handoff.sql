-- Temporary encrypted custody between provider callback and owner repository
-- selection. This is not a permanent runtime secret store.
create table private.website_connection_handoffs (
  id uuid primary key,
  owner_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider in ('github','supabase','vercel','stripe')),
  environment text not null check (environment in ('preview','production')),
  secret_id uuid not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index website_connection_handoffs_expiry_idx on private.website_connection_handoffs(expires_at);
alter table private.website_connection_handoffs enable row level security;
revoke all on private.website_connection_handoffs from public, anon, authenticated;

create function private.website_connection_handoff_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id=old.secret_id;
  return old;
end $$;
revoke all on function private.website_connection_handoff_cleanup() from public, anon, authenticated;
create trigger website_connection_handoff_cleanup after delete on private.website_connection_handoffs
for each row execute function private.website_connection_handoff_cleanup();

create function public.website_store_connection_handoff(
  p_id uuid, p_owner_id uuid, p_project_id uuid, p_provider text,
  p_environment text, p_token text, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid;
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project access denied'; end if;
  if p_id is null or p_provider is null or p_provider not in ('github','supabase','vercel','stripe')
    or p_environment is null or p_environment not in ('preview','production')
    or p_token is null or length(p_token) < 20 or octet_length(p_token) > 4096
    or p_expires_at is null or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'Invalid connection handoff';
  end if;
  delete from private.website_connection_handoffs
    where project_id=p_project_id and expires_at <= clock_timestamp();
  if (select count(*) from private.website_connection_handoffs where project_id=p_project_id) >= 5 then
    raise exception 'Too many active connection handoffs';
  end if;
  v_secret_id:=vault.create_secret(p_token,'website_connection_handoff_' || p_id::text,
    'Temporary customer provider authorization',null);
  insert into private.website_connection_handoffs
    (id,owner_id,project_id,provider,environment,secret_id,expires_at)
  values (p_id,p_owner_id,p_project_id,p_provider,p_environment,v_secret_id,p_expires_at);
end $$;
revoke all on function public.website_store_connection_handoff(uuid,uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.website_store_connection_handoff(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

create function public.website_consume_connection_handoff(
  p_id uuid, p_owner_id uuid, p_project_id uuid, p_provider text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_handoff private.website_connection_handoffs%rowtype; v_token text;
begin
  select * into v_handoff from private.website_connection_handoffs
  where id=p_id and owner_id=p_owner_id and project_id=p_project_id and provider=p_provider
    and expires_at > clock_timestamp() for update;
  if not found then return null; end if;
  if not exists (select 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null) then return null; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where id=v_handoff.secret_id;
  if v_token is null then raise exception 'Connection handoff unavailable'; end if;
  delete from private.website_connection_handoffs where id=p_id;
  return jsonb_build_object('environment',v_handoff.environment,'userToken',v_token);
end $$;
revoke all on function public.website_consume_connection_handoff(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.website_consume_connection_handoff(uuid,uuid,uuid,text) to service_role;

create function public.website_revoke_connection_handoff(p_id uuid,p_owner_id uuid,p_project_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from private.website_connection_handoffs where id=p_id
    and owner_id=p_owner_id and project_id=p_project_id;
  return found;
end $$;
revoke all on function public.website_revoke_connection_handoff(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.website_revoke_connection_handoff(uuid,uuid,uuid) to service_role;

-- Call from the platform's trusted scheduled maintenance worker. Expiry is
-- enforced at read time even if maintenance is temporarily unavailable.
create function public.website_cleanup_expired_connection_handoffs()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from private.website_connection_handoffs where expires_at <= clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.website_cleanup_expired_connection_handoffs() from public, anon, authenticated;
grant execute on function public.website_cleanup_expired_connection_handoffs() to service_role;
