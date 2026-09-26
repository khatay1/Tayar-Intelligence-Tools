-- Credentials for user-built projects are independent of Tayar's own provider keys.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.website_project_secrets (
  project_id uuid not null references public.projects(id) on delete cascade,
  connection_id text not null,
  field text not null,
  environment text not null check (environment in ('preview', 'staging', 'production')),
  secret_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, connection_id, field, environment)
);
alter table private.website_project_secrets enable row level security;
revoke all on private.website_project_secrets from public, anon, authenticated;

create function private.website_project_secret_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end $$;
revoke all on function private.website_project_secret_cleanup() from public, anon, authenticated;
create trigger website_project_secret_cleanup after delete on private.website_project_secrets
for each row execute function private.website_project_secret_cleanup();

create function private.website_set_project_secret_impl(
  p_project_id uuid, p_connection_id text, p_field text, p_environment text, p_value text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_secret_id uuid;
  v_name text;
begin
  -- Lock the owning project to serialize the secret count and project deletion.
  perform 1 from public.projects
  where id = p_project_id and user_id = (select auth.uid())
    and type = 'website-builder' and deleted_at is null
    and (((select auth.jwt())->>'is_anonymous')::boolean) is not true for update;
  if not found then raise exception 'Project access denied'; end if;
  if p_connection_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'
    or p_field !~ '^[a-zA-Z][a-zA-Z0-9_-]{0,63}$'
    or p_environment not in ('preview','staging','production') then
    raise exception 'Invalid secret identifier';
  end if;
  if p_value is null or btrim(p_value) = '' or octet_length(p_value) > 16384 then
    raise exception 'Invalid secret value';
  end if;
  select secret_id into v_secret_id from private.website_project_secrets
  where project_id = p_project_id and connection_id = p_connection_id
    and field = p_field and environment = p_environment for update;
  v_name := 'website_project_' || p_project_id::text || '_' || md5(p_connection_id || ':' || p_field || ':' || p_environment);
  if v_secret_id is null then
    if (select count(*) from private.website_project_secrets where project_id = p_project_id) >= 100 then
      raise exception 'Project secret limit reached';
    end if;
    v_secret_id := vault.create_secret(p_value, v_name, 'User-built website project secret', null);
    insert into private.website_project_secrets(project_id,connection_id,field,environment,secret_id)
    values (p_project_id,p_connection_id,p_field,p_environment,v_secret_id);
  else
    perform vault.update_secret(v_secret_id, p_value, v_name, 'User-built website project secret', null);
    update private.website_project_secrets set updated_at = now()
    where project_id = p_project_id and connection_id = p_connection_id
      and field = p_field and environment = p_environment;
  end if;
  return 'secret://website/' || p_project_id::text || '/' || p_connection_id || '/' || p_field || '/' || p_environment;
end $$;
revoke all on function private.website_set_project_secret_impl(uuid,text,text,text,text) from public;
grant execute on function private.website_set_project_secret_impl(uuid,text,text,text,text) to authenticated;

create function public.website_set_project_secret(
  p_project_id uuid, p_connection_id text, p_field text, p_environment text, p_value text
) returns text language sql security invoker set search_path = '' as $$
  select private.website_set_project_secret_impl(p_project_id,p_connection_id,p_field,p_environment,p_value)
$$;
revoke all on function public.website_set_project_secret(uuid,text,text,text,text) from public, anon;
grant execute on function public.website_set_project_secret(uuid,text,text,text,text) to authenticated;

create function private.website_project_secret_refs_impl(p_project_id uuid)
returns table(connection_id text, field text, environment text, ref text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.projects where id = p_project_id
    and user_id = (select auth.uid()) and type = 'website-builder' and deleted_at is null
    and (((select auth.jwt())->>'is_anonymous')::boolean) is not true) then
    raise exception 'Project access denied';
  end if;
  return query select s.connection_id, s.field, s.environment,
    'secret://website/' || s.project_id::text || '/' || s.connection_id || '/' || s.field || '/' || s.environment,
    s.updated_at from private.website_project_secrets s where s.project_id = p_project_id;
end $$;
revoke all on function private.website_project_secret_refs_impl(uuid) from public;
grant execute on function private.website_project_secret_refs_impl(uuid) to authenticated;

create function public.website_project_secret_refs(p_project_id uuid)
returns table(connection_id text, field text, environment text, ref text, updated_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.website_project_secret_refs_impl(p_project_id)
$$;
revoke all on function public.website_project_secret_refs(uuid) from public, anon;
grant execute on function public.website_project_secret_refs(uuid) to authenticated;

create function private.website_delete_project_secret_impl(
  p_project_id uuid, p_connection_id text, p_field text, p_environment text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.projects where id = p_project_id
    and user_id = (select auth.uid()) and type = 'website-builder' and deleted_at is null
    and (((select auth.jwt())->>'is_anonymous')::boolean) is not true) then
    raise exception 'Project access denied';
  end if;
  delete from private.website_project_secrets where project_id = p_project_id
    and connection_id = p_connection_id and field = p_field and environment = p_environment;
  return found;
end $$;
revoke all on function private.website_delete_project_secret_impl(uuid,text,text,text) from public;
grant execute on function private.website_delete_project_secret_impl(uuid,text,text,text) to authenticated;

create function public.website_delete_project_secret(
  p_project_id uuid, p_connection_id text, p_field text, p_environment text
) returns boolean language sql security invoker set search_path = '' as $$
  select private.website_delete_project_secret_impl(p_project_id,p_connection_id,p_field,p_environment)
$$;
revoke all on function public.website_delete_project_secret(uuid,text,text,text) from public, anon;
grant execute on function public.website_delete_project_secret(uuid,text,text,text) to authenticated;

-- Only trusted server code with the Tayar service key can obtain plaintext.
create function public.website_project_secret_value(
  p_project_id uuid, p_connection_id text, p_field text, p_environment text
) returns text language sql stable security definer set search_path = '' as $$
  select d.decrypted_secret from private.website_project_secrets s
  join vault.decrypted_secrets d on d.id = s.secret_id
  where s.project_id = p_project_id and s.connection_id = p_connection_id
    and s.field = p_field and s.environment = p_environment
$$;
revoke all on function public.website_project_secret_value(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.website_project_secret_value(uuid,text,text,text) to service_role;
