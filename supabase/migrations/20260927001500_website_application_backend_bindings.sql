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
  service_secret_id uuid,
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
    service_secret_id = null,
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

-- This migration is unreleased. Custody is attached to the binding and never
-- included in either public metadata RPC. Rebinding invalidates old credentials.
create function private.website_application_backend_secret_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.service_secret_id is not null and
    (tg_op = 'DELETE' or old.service_secret_id is distinct from new.service_secret_id) then
    delete from vault.secrets where id = old.service_secret_id;
  end if;
  return old;
end $$;
revoke all on function private.website_application_backend_secret_cleanup() from public, anon, authenticated;
create trigger website_application_backend_secret_cleanup
  after delete or update of service_secret_id on private.website_application_backends
  for each row execute function private.website_application_backend_secret_cleanup();

-- Owner identity is verified by the authenticated server endpoint, then checked
-- again under the same project row lock used to register the schema revision.
create function public.website_link_application_backend(
  p_project_id uuid, p_owner_id uuid, p_backend_ref text, p_publishable_key text,
  p_deployed_definition jsonb, p_service_key text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid;
begin
  perform 1 from public.projects where id = p_project_id and user_id = p_owner_id
    and type = 'website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project access denied'; end if;
  if p_service_key is null or octet_length(p_service_key) not between 20 and 16384
    or p_service_key ~ '[[:space:]]' then raise exception 'Invalid application service credential'; end if;
  perform public.website_record_application_backend(p_project_id,p_backend_ref,p_publishable_key,p_deployed_definition);
  v_secret_id := vault.create_secret(p_service_key, 'website_backend_' || p_project_id::text, 'Dedicated application backend credential', null);
  update private.website_application_backends set service_secret_id = v_secret_id where project_id = p_project_id;
end $$;
revoke all on function public.website_link_application_backend(uuid,uuid,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.website_link_application_backend(uuid,uuid,text,text,jsonb,text) to service_role;

create function public.website_application_backend_credential(p_project_id uuid, p_backend_ref text)
returns text language sql stable security definer set search_path = '' as $$
  select d.decrypted_secret from private.website_application_backends b
  join public.projects p on p.id = b.project_id
  join vault.decrypted_secrets d on d.id = b.service_secret_id
  where b.project_id = p_project_id and b.backend_ref = p_backend_ref
    and p.type = 'website-builder' and p.deleted_at is null
    and p.content->'application' = b.deployed_definition
$$;
revoke all on function public.website_application_backend_credential(uuid,text) from public, anon, authenticated;
grant execute on function public.website_application_backend_credential(uuid,text) to service_role;

-- Reuse immutable publish versions. Private applications never use the public
-- published-sites bucket; ordinary authenticated clients have no bucket policy.
alter table public.website_publish_versions add column storage_bucket text not null default 'published-sites'
  check (storage_bucket in ('published-sites','website-application-releases'));
alter table public.website_publish_versions add column application_backend jsonb;
-- Existing owner archive policies apply only to ordinary static releases.
-- Private release writes/deletion must go through the trusted server lifecycle.
create policy website_application_release_insert_server_only on public.website_publish_versions as restrictive
  for insert to anon, authenticated
  with check (storage_bucket = 'published-sites' and application_backend is null);
create policy website_application_release_update_server_only on public.website_publish_versions as restrictive
  for update to anon, authenticated
  using (storage_bucket = 'published-sites' and application_backend is null)
  with check (storage_bucket = 'published-sites' and application_backend is null);
create policy website_application_release_delete_server_only on public.website_publish_versions as restrictive
  for delete to anon, authenticated
  using (storage_bucket = 'published-sites' and application_backend is null);
alter table private.website_application_backends
  add column private_runtime_enabled boolean not null default false,
  add column active_version_id uuid references public.website_publish_versions(id) on delete set null;
insert into storage.buckets(id,name,public) values ('website-application-releases','website-application-releases',false)
  on conflict (id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id = 'website-application-releases' and public) then
    raise exception 'Application release storage must be private';
  end if;
end $$;

-- Restrictive policy prevents even an unrelated broad Storage policy from
-- granting browser access to application HTML. Service role bypasses RLS.
create policy website_application_private_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'website-application-releases')
  with check (bucket_id <> 'website-application-releases');

-- Called only by the trusted release executor after private upload + live checks.
-- NULL unpublishes but retains the private-runtime marker: no public fallback.
create function public.website_activate_application_release(p_project_id uuid,p_owner_id uuid,p_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b private.website_application_backends%rowtype; v public.website_publish_versions%rowtype; c jsonb;
begin
  select content into c from public.projects where id = p_project_id and user_id = p_owner_id
    and type = 'website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project access denied'; end if;
  select * into b from private.website_application_backends where project_id = p_project_id for update;
  if not found then raise exception 'Application backend unavailable'; end if;
  if p_version_id is not null then
    select * into v from public.website_publish_versions where id = p_version_id and project_id = p_project_id and user_id = p_owner_id;
    if not found or v.storage_bucket <> 'website-application-releases'
      or v.storage_prefix <> p_owner_id::text || '/' || p_project_id::text || '/versions/' || p_version_id::text
      or v.application_backend is distinct from jsonb_build_object('url','https://' || b.backend_ref || '.supabase.co','projectRef',b.backend_ref,'publishableKey',b.publishable_key)
      or v.snapshot->'application' is distinct from b.deployed_definition
      or c->'application' is distinct from b.deployed_definition or b.service_secret_id is null then
      raise exception 'Application release does not match the verified backend';
    end if;
  end if;
  update private.website_application_backends set private_runtime_enabled = true, active_version_id = p_version_id where project_id = p_project_id;
end $$;
revoke all on function public.website_activate_application_release(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_activate_application_release(uuid,uuid,uuid) to service_role;

create function public.website_application_published_release(p_project_id uuid,p_owner_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('enabled',true,'release',case when p.deleted_at is null and p.user_id = p_owner_id
      and v.user_id = p_owner_id and v.project_id = p_project_id
      and v.storage_bucket = 'website-application-releases'
      and v.application_backend = jsonb_build_object('url','https://' || b.backend_ref || '.supabase.co','projectRef',b.backend_ref,'publishableKey',b.publishable_key)
      and v.snapshot->'application' = b.deployed_definition
      and b.service_secret_id is not null then
    jsonb_build_object('id',v.id,'project_id',v.project_id,'user_id',v.user_id,
      'snapshot',jsonb_build_object('application',v.snapshot->'application','homePageId',v.snapshot->'homePageId',
        'localization',v.snapshot->'localization','pages',case when jsonb_typeof(v.snapshot->'pages') = 'array' then
          (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',page->'id','slug',page->'slug',
            'language',page->'language','translationKey',page->'translationKey')))
           from jsonb_array_elements(v.snapshot->'pages') page) else null end),
      'storage_prefix',v.storage_prefix,'storage_bucket',v.storage_bucket,'file_manifest',v.file_manifest,
      'backend',jsonb_build_object('url','https://' || b.backend_ref || '.supabase.co',
        'projectRef',b.backend_ref,'publishableKey',b.publishable_key)) else null end)
  from private.website_application_backends b join public.projects p on p.id = b.project_id
  left join public.website_publish_versions v on v.id = b.active_version_id
  where b.project_id = p_project_id and b.private_runtime_enabled
$$;
revoke all on function public.website_application_published_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_application_published_release(uuid,uuid) to service_role;

create function public.website_application_release_credential(p_project_id uuid,p_version_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select d.decrypted_secret from private.website_application_backends b
  join public.projects p on p.id = b.project_id
  join public.website_publish_versions v on v.id = b.active_version_id
  join vault.decrypted_secrets d on d.id = b.service_secret_id
  where b.project_id = p_project_id and b.active_version_id = p_version_id and b.private_runtime_enabled
    and p.deleted_at is null and p.type = 'website-builder' and v.user_id = p.user_id
    and v.project_id = p.id and v.storage_bucket = 'website-application-releases'
    and v.application_backend = jsonb_build_object('url','https://' || b.backend_ref || '.supabase.co','projectRef',b.backend_ref,'publishableKey',b.publishable_key)
    and v.snapshot->'application' = b.deployed_definition
$$;
revoke all on function public.website_application_release_credential(uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_application_release_credential(uuid,uuid) to service_role;

-- Commit metadata and activation atomically after uploading a fresh private UUID.
-- Compare the WHOLE saved project, not just its schema, under the owner row lock.
create function public.website_commit_application_release(
  p_project_id uuid,p_owner_id uuid,p_version_id uuid,p_snapshot jsonb,p_backend jsonb,
  p_file_manifest jsonb,p_published_url text,p_release_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare c jsonb; prefix text; item jsonb;
begin
  select content into c from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found or c is distinct from p_snapshot then raise exception 'Saved project changed before release'; end if;
  prefix := p_owner_id::text || '/' || p_project_id::text || '/versions/' || p_version_id::text;
  if p_version_id is null or jsonb_typeof(p_file_manifest) is distinct from 'array'
    or jsonb_array_length(p_file_manifest) not between 1 and 250
    or p_published_url is null or p_published_url not like 'https://%'
    or char_length(p_published_url)>2000 or p_release_note is null or char_length(p_release_note)>500 then
    raise exception 'Invalid application release';
  end if;
  if exists(select 1 from storage.objects where bucket_id='published-sites'
    and name like p_owner_id::text || '/' || p_project_id::text || '/%') then
    raise exception 'Public application copies require migration';
  end if;
  if not exists(select 1 from jsonb_array_elements(p_file_manifest) f where f->>'name'='index.html')
    or (select count(distinct f->>'name') from jsonb_array_elements(p_file_manifest) f) <> jsonb_array_length(p_file_manifest) then
    raise exception 'Invalid application release manifest';
  end if;
  for item in select * from jsonb_array_elements(p_file_manifest) loop
    if item->>'name' is null or char_length(item->>'name')>501 or item->>'name' !~ '^[[:alnum:]][[:alnum:]._/-]*$'
      or item->>'name' ~ '(^|/)(\.|\.\.)(/|$)' or item->>'name' like '%//%'
      or item->>'name' ~ '/$' or item->>'pageId' is null or item->>'contentType' is null
      or not exists(select 1 from storage.objects where bucket_id='website-application-releases' and name=prefix || '/' || (item->>'name')) then
      raise exception 'Private application files are incomplete';
    end if;
  end loop;
  insert into public.website_publish_versions(id,project_id,user_id,release_note,published_url,storage_prefix,
    editor_fingerprint,snapshot,file_manifest,storage_bucket,application_backend)
    values(p_version_id,p_project_id,p_owner_id,p_release_note,p_published_url,prefix,
      p_snapshot::text,p_snapshot,p_file_manifest,'website-application-releases',p_backend);
  perform public.website_activate_application_release(p_project_id,p_owner_id,p_version_id);
  return p_version_id;
end $$;
revoke all on function public.website_commit_application_release(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.website_commit_application_release(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,text) to service_role;

-- Serialize authenticated legacy public writes with activation's project lock.
-- A write which wins the lock is visible to commit's public-copy check; a write
-- after activation sees private mode and is rejected. Service writers must use
-- the private release executor (service_role bypasses RLS).
create function private.website_public_release_write_allowed(p_name text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare project uuid; owner_id uuid;
begin
  owner_id := auth.uid();
  if owner_id is null or split_part(p_name,'/',1) <> owner_id::text
    or split_part(p_name,'/',2) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  project := split_part(p_name,'/',2)::uuid;
  perform 1 from public.projects where id=project and user_id=owner_id
    and type='website-builder' and deleted_at is null for share;
  if not found then return false; end if;
  return not exists(select 1 from private.website_application_backends where project_id=project and private_runtime_enabled);
end $$;
revoke all on function private.website_public_release_write_allowed(text) from public,anon,authenticated;
grant execute on function private.website_public_release_write_allowed(text) to authenticated;
create policy website_application_public_insert_guard on storage.objects as restrictive
  for insert to authenticated
  with check (bucket_id <> 'published-sites' or private.website_public_release_write_allowed(name));
create policy website_application_public_update_guard on storage.objects as restrictive
  for update to authenticated
  using (bucket_id <> 'published-sites' or private.website_public_release_write_allowed(name))
  with check (bucket_id <> 'published-sites' or private.website_public_release_write_allowed(name));
create policy website_application_public_anon_insert_guard on storage.objects as restrictive
  for insert to anon with check (bucket_id <> 'published-sites');
create policy website_application_public_anon_update_guard on storage.objects as restrictive
  for update to anon using (bucket_id <> 'published-sites') with check (bucket_id <> 'published-sites');

-- Read-only reconciliation of an ambiguous commit. An unresolved UUID is NOT
-- permission to remove artifacts: an earlier transaction can still be in flight.
create function public.website_application_release_outcome(p_project_id uuid,p_owner_id uuid,p_version_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when not exists(select 1 from public.website_publish_versions v
      where v.id=p_version_id and v.project_id=p_project_id and v.user_id=p_owner_id
        and v.storage_bucket='website-application-releases') then 'unresolved'
    when exists(select 1 from private.website_application_backends b where b.project_id=p_project_id
      and b.private_runtime_enabled and b.active_version_id=p_version_id) then 'selected'
    else 'recorded' end
  from public.projects p where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
$$;
revoke all on function public.website_application_release_outcome(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_application_release_outcome(uuid,uuid,uuid) to service_role;
