-- Platform metadata for a separately provisioned generated-app backend.
-- The app's service credentials and database rows never live in projects.content.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.website_application_backends (
  project_id uuid primary key references public.projects(id) on delete cascade,
  backend_ref text not null unique check (backend_ref ~ '^[a-z0-9]{20}$'),
  publishable_key text not null check (length(publishable_key) between 20 and 4096),
  deployed_definition jsonb not null,
  verified_at timestamptz not null default now()
);
alter table private.website_application_backends enable row level security;
revoke all on private.website_application_backends from public, anon, authenticated;

-- Trusted provisioning calls this only after querying the dedicated backend's
-- service-only revision RPC. The project row lock serializes concurrent saves.
create function public.website_record_application_backend(
  p_project_id uuid, p_backend_ref text, p_publishable_key text, p_deployed_definition jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_content jsonb;
begin
  select content into v_content from public.projects
  where id = p_project_id and type = 'website-builder' and deleted_at is null for update;
  if not found or v_content->'application' is null
    or v_content->'application' is distinct from p_deployed_definition then
    raise exception 'Saved application definition does not match verified backend';
  end if;
  if p_backend_ref is null or p_backend_ref !~ '^[a-z0-9]{20}$'
    or p_publishable_key is null or length(p_publishable_key) not between 20 and 4096 then
    raise exception 'Invalid dedicated backend public configuration';
  end if;
  insert into private.website_application_backends(project_id,backend_ref,publishable_key,deployed_definition,verified_at)
  values (p_project_id,p_backend_ref,p_publishable_key,p_deployed_definition,now())
  on conflict (project_id) do update set backend_ref = excluded.backend_ref,
    publishable_key = excluded.publishable_key, deployed_definition = excluded.deployed_definition,
    verified_at = excluded.verified_at;
end $$;
revoke all on function public.website_record_application_backend(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.website_record_application_backend(uuid,text,text,jsonb) to service_role;

create function private.website_application_backend_public_impl(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.projects where id = p_project_id
    and user_id = (select auth.uid()) and type = 'website-builder' and deleted_at is null
    and (((select auth.jwt())->>'is_anonymous')::boolean) is not true) then
    raise exception 'Project access denied';
  end if;
  select jsonb_build_object(
    'url', 'https://' || backend_ref || '.supabase.co',
    'projectRef', backend_ref,
    'publishableKey', publishable_key,
    'verifiedAt', verified_at,
    'deployedDefinition', deployed_definition
  ) into v_result from private.website_application_backends b
  join public.projects p on p.id = b.project_id
  where b.project_id = p_project_id and p.content->'application' = b.deployed_definition;
  return v_result;
end $$;
revoke all on function private.website_application_backend_public_impl(uuid) from public;
grant execute on function private.website_application_backend_public_impl(uuid) to authenticated;

create function public.website_application_backend_public(p_project_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.website_application_backend_public_impl(p_project_id)
$$;
revoke all on function public.website_application_backend_public(uuid) from public, anon;
grant execute on function public.website_application_backend_public(uuid) to authenticated;

-- Provisioning and publishing services can inspect the same current binding
-- without impersonating the owner. No service key is returned or stored here.
create function public.website_application_backend_record(p_project_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'url', 'https://' || b.backend_ref || '.supabase.co',
    'projectRef', b.backend_ref,
    'publishableKey', b.publishable_key,
    'verifiedAt', b.verified_at,
    'deployedDefinition', b.deployed_definition
  ) from private.website_application_backends b
  join public.projects p on p.id = b.project_id
  where b.project_id = p_project_id and p.type = 'website-builder'
    and p.deleted_at is null and p.content->'application' = b.deployed_definition
$$;
revoke all on function public.website_application_backend_record(uuid) from public, anon, authenticated;
grant execute on function public.website_application_backend_record(uuid) to service_role;
