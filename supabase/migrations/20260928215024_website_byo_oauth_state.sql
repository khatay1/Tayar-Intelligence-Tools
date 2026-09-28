-- Short-lived, one-use OAuth state. Store only a SHA-256 hash, never the raw
-- state, authorization code, user token or installation token.
create table private.website_connection_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider in ('github','supabase','vercel','stripe')),
  environment text not null check (environment in ('preview','production')),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index website_connection_oauth_states_expires_idx
  on private.website_connection_oauth_states(expires_at);
alter table private.website_connection_oauth_states enable row level security;
revoke all on private.website_connection_oauth_states from public, anon, authenticated;

create function public.website_create_connection_oauth_state(
  p_state_hash text, p_owner_id uuid, p_project_id uuid, p_provider text,
  p_environment text, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project access denied'; end if;
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_provider is null or p_provider not in ('github','supabase','vercel','stripe')
    or p_environment is null or p_environment not in ('preview','production')
    or p_expires_at is null or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '10 minutes' then
    raise exception 'Invalid connection state';
  end if;
  delete from private.website_connection_oauth_states
    where project_id=p_project_id and expires_at <= clock_timestamp();
  if (select count(*) from private.website_connection_oauth_states where project_id=p_project_id) >= 5 then
    raise exception 'Too many active connection attempts';
  end if;
  insert into private.website_connection_oauth_states
    (state_hash,owner_id,project_id,provider,environment,expires_at)
  values (p_state_hash,p_owner_id,p_project_id,p_provider,p_environment,p_expires_at);
end $$;
revoke all on function public.website_create_connection_oauth_state(text,uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.website_create_connection_oauth_state(text,uuid,uuid,text,text,timestamptz) to service_role;

-- DELETE ... RETURNING is atomic: concurrent callbacks cannot consume twice.
create function public.website_consume_connection_oauth_state(p_state_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_state private.website_connection_oauth_states%rowtype;
begin
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  delete from private.website_connection_oauth_states where state_hash=p_state_hash
    and expires_at > clock_timestamp() returning * into v_state;
  if not found then return null; end if;
  if not exists (select 1 from public.projects where id=v_state.project_id
    and user_id=v_state.owner_id and type='website-builder' and deleted_at is null) then return null; end if;
  return jsonb_build_object('ownerId',v_state.owner_id,'projectId',v_state.project_id,
    'provider',v_state.provider,'environment',v_state.environment);
end $$;
revoke all on function public.website_consume_connection_oauth_state(text) from public, anon, authenticated;
grant execute on function public.website_consume_connection_oauth_state(text) to service_role;
