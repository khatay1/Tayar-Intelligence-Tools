create schema if not exists private;

create or replace function private.tayar_domain_control_secret_valid(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    length(coalesce(p_secret, '')) between 32 and 512
    and encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
      = '606d0e7a3b4a67ad918e7450f80859dead9a5a0cef6f14aa968115a32db4c35b';
$$;

revoke all on function private.tayar_domain_control_secret_valid(text) from public, anon, authenticated;
grant execute on function private.tayar_domain_control_secret_valid(text) to service_role;

create or replace function public.website_custom_domain_server_save(
  p_project_id uuid,
  p_hostname text,
  p_status text,
  p_verification jsonb,
  p_expected_hostname text default null,
  p_expected_updated_at timestamptz default null,
  p_control_secret text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_hostname text := lower(rtrim(btrim(coalesce(p_hostname, '')), '.'));
  v_existing public.website_custom_domains%rowtype;
  v_saved public.website_custom_domains%rowtype;
begin
  if not private.tayar_domain_control_secret_valid(p_control_secret) then
    raise exception 'Domain control authentication failed';
  end if;
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_project_id is null or not exists (
    select 1 from public.projects
    where id = p_project_id
      and user_id = v_user_id
      and type = 'website-builder'
      and deleted_at is null
  ) then
    raise exception 'Project owner access required';
  end if;
  if length(v_hostname) < 4 or length(v_hostname) > 253
     or v_hostname !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
     or v_hostname = 'tayar.se'
     or v_hostname like '%.tayar.se'
     or v_hostname like '%.vercel.app' then
    raise exception 'Invalid custom hostname';
  end if;
  if p_status not in ('pending', 'verified', 'misconfigured') then
    raise exception 'Invalid custom domain status';
  end if;
  if p_verification is null or jsonb_typeof(p_verification) <> 'array'
     or octet_length(p_verification::text) > 16000 then
    raise exception 'Invalid domain verification payload';
  end if;

  select *
  into v_existing
  from public.website_custom_domains
  where project_id = p_project_id and user_id = v_user_id
  for update;

  if found then
    if p_expected_hostname is null or p_expected_updated_at is null
       or v_existing.hostname <> lower(rtrim(btrim(p_expected_hostname), '.'))
       or v_existing.updated_at <> p_expected_updated_at then
      raise exception 'Custom domain changed during this request';
    end if;

    update public.website_custom_domains
    set hostname = v_hostname,
        status = p_status,
        verification = p_verification,
        updated_at = now()
    where id = v_existing.id
    returning * into v_saved;
  else
    if p_expected_hostname is not null or p_expected_updated_at is not null then
      raise exception 'Custom domain changed during this request';
    end if;

    insert into public.website_custom_domains(project_id, user_id, hostname, status, verification)
    values (p_project_id, v_user_id, v_hostname, p_status, p_verification)
    returning * into v_saved;
  end if;

  return to_jsonb(v_saved);
end;
$$;

revoke all on function public.website_custom_domain_server_save(uuid,text,text,jsonb,text,timestamptz,text)
from public, anon, authenticated;
grant execute on function public.website_custom_domain_server_save(uuid,text,text,jsonb,text,timestamptz,text)
to authenticated, service_role;

create or replace function public.website_custom_domain_server_delete(
  p_project_id uuid,
  p_expected_hostname text,
  p_expected_updated_at timestamptz,
  p_control_secret text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.website_custom_domains%rowtype;
begin
  if not private.tayar_domain_control_secret_valid(p_control_secret) then
    raise exception 'Domain control authentication failed';
  end if;
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_project_id is null or not exists (
    select 1 from public.projects
    where id = p_project_id
      and user_id = v_user_id
      and type = 'website-builder'
      and deleted_at is null
  ) then
    raise exception 'Project owner access required';
  end if;

  select *
  into v_existing
  from public.website_custom_domains
  where project_id = p_project_id and user_id = v_user_id
  for update;

  if not found then return false; end if;
  if p_expected_hostname is null or p_expected_updated_at is null
     or v_existing.hostname <> lower(rtrim(btrim(p_expected_hostname), '.'))
     or v_existing.updated_at <> p_expected_updated_at then
    raise exception 'Custom domain changed during this request';
  end if;

  delete from public.website_custom_domains where id = v_existing.id;
  return true;
end;
$$;

revoke all on function public.website_custom_domain_server_delete(uuid,text,timestamptz,text)
from public, anon, authenticated;
grant execute on function public.website_custom_domain_server_delete(uuid,text,timestamptz,text)
to authenticated, service_role;

create or replace function public.website_resolve_verified_custom_domain(p_hostname text)
returns table(project_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select d.project_id, d.user_id
  from public.website_custom_domains d
  join public.projects p
    on p.id = d.project_id
   and p.user_id = d.user_id
  where d.hostname = lower(rtrim(btrim(coalesce(p_hostname, '')), '.'))
    and d.status = 'verified'
    and p.type = 'website-builder'
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.website_resolve_verified_custom_domain(text) from public;
grant execute on function public.website_resolve_verified_custom_domain(text)
to anon, authenticated, service_role;
