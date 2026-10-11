-- Service-only, retry-safe staging for credentials created during final
-- activation. Values live in Vault only until the generic Vercel handoff
-- commits; this table stores identity and version metadata only.
create table private.website_runtime_secret_stages(
 id uuid primary key,
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null,
 source_connection_id text not null,
 source_field text not null,
 environment text not null check(environment in('preview','production')),
 environment_key text not null,
 operation_id uuid not null unique,
 source_updated_at timestamptz not null,
 version bigint not null check(version>0),
 updated_at timestamptz not null default clock_timestamp(),
 unique(project_id,source_connection_id,source_field,environment)
);
alter table private.website_runtime_secret_stages enable row level security;
revoke all on private.website_runtime_secret_stages from public,anon,authenticated;

-- The editor may manage customer-entered integration secrets, but these two
-- internal identities belong exclusively to the final activation worker.
create function private.website_protect_owned_runtime_secret() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_connection_id text:=case when tg_op='DELETE' then old.connection_id else new.connection_id end;
 v_project_id uuid:=case when tg_op='DELETE' then old.project_id else new.project_id end;
begin
 if v_connection_id in('runtime-supabase','runtime-cron') and (select auth.role())<>'service_role'
  and(tg_op<>'DELETE' or exists(select 1 from public.projects p where p.id=v_project_id))
  then raise exception 'Runtime secret is service managed';end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
revoke all on function private.website_protect_owned_runtime_secret() from public,anon,authenticated;
create trigger website_protect_owned_runtime_secret before insert or update or delete
 on private.website_project_secrets for each row execute function private.website_protect_owned_runtime_secret();

create function public.website_stage_owned_runtime_secret(
 p_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_stage_version bigint,
 p_source_connection_id text,p_source_field text,p_environment text,p_environment_key text,
 p_operation_id uuid,p_value text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_stage private.website_runtime_secret_stages%rowtype;v_secret_id uuid;
 v_updated_at timestamptz;v_version bigint;v_name text;
begin
 if p_id is null or p_project_id is null or p_owner_id is null or p_operation_id is null
  or p_expected_stage_version is null or p_expected_stage_version<0
  or p_environment not in('preview','production')
  or not((p_source_connection_id='runtime-supabase' and p_source_field='apiKey' and p_environment_key='SUPABASE_SECRET_KEY')
   or(p_source_connection_id='runtime-cron' and p_source_field='secret' and p_environment_key='CRON_SECRET'))
  or p_value is null or btrim(p_value)='' or octet_length(p_value)>16384
  then raise exception 'Runtime secret staging unavailable';end if;
 perform 1 from public.projects p where p.id=p_project_id and p.user_id=p_owner_id
  and p.type='website-builder' and p.deleted_at is null for update;
 if not found then raise exception 'Runtime secret staging unavailable';end if;
 select s.* into v_stage from private.website_runtime_secret_stages s
  where s.project_id=p_project_id and s.source_connection_id=p_source_connection_id
   and s.source_field=p_source_field and s.environment=p_environment for update;
 if found and v_stage.operation_id=p_operation_id then
  if v_stage.id<>p_id or v_stage.owner_id<>p_owner_id or v_stage.environment_key<>p_environment_key
   then raise exception 'Runtime secret staging changed';end if;
  return jsonb_build_object('stageVersion',v_stage.version,'sourceUpdatedAt',v_stage.source_updated_at);
 end if;
 select s.secret_id into v_secret_id from private.website_project_secrets s
  where s.project_id=p_project_id and s.connection_id=p_source_connection_id
   and s.field=p_source_field and s.environment=p_environment for update;
 if p_expected_stage_version=0 then
  if v_stage.id is not null or v_secret_id is not null then raise exception 'Runtime secret staging changed';end if;
  v_version:=1;
 else
  if v_stage.id is null or v_stage.id<>p_id or v_stage.owner_id<>p_owner_id
   or v_stage.environment_key<>p_environment_key or v_stage.version<>p_expected_stage_version
   or v_secret_id is not null
   or not exists(select 1 from private.website_vercel_secret_handoffs h
    where h.project_id=p_project_id and h.owner_id=p_owner_id
     and h.source_connection_id=p_source_connection_id and h.source_field=p_source_field
     and h.source_environment=p_environment and h.source_updated_at=v_stage.source_updated_at
     and h.environment_key=p_environment_key and h.target=p_environment and h.status='verified')
   then raise exception 'Runtime secret staging changed';end if;
  v_version:=v_stage.version+1;
 end if;
 v_updated_at:=clock_timestamp();
 v_name:='website_runtime_'||p_project_id::text||'_'||md5(p_source_connection_id||':'||p_source_field||':'||p_environment);
 v_secret_id:=vault.create_secret(p_value,v_name,'Temporary customer runtime secret',null);
 insert into private.website_project_secrets(project_id,connection_id,field,environment,secret_id,updated_at)
 values(p_project_id,p_source_connection_id,p_source_field,p_environment,v_secret_id,v_updated_at);
 if p_expected_stage_version=0 then
  insert into private.website_runtime_secret_stages(id,project_id,owner_id,source_connection_id,source_field,
   environment,environment_key,operation_id,source_updated_at,version)
  values(p_id,p_project_id,p_owner_id,p_source_connection_id,p_source_field,p_environment,p_environment_key,
   p_operation_id,v_updated_at,v_version);
 else
  update private.website_runtime_secret_stages set operation_id=p_operation_id,source_updated_at=v_updated_at,
   version=v_version,updated_at=clock_timestamp() where id=p_id;
 end if;
 return jsonb_build_object('stageVersion',v_version,'sourceUpdatedAt',v_updated_at);
end $$;
revoke all on function public.website_stage_owned_runtime_secret(uuid,uuid,uuid,bigint,text,text,text,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.website_stage_owned_runtime_secret(uuid,uuid,uuid,bigint,text,text,text,text,uuid,text)
 to service_role;

create function public.website_owned_runtime_secret_state_for_worker(
 p_project_id uuid,p_owner_id uuid,p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_source_connection_id text,p_source_field text,p_environment_key text,p_environment text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_vercel private.website_infrastructure_connections%rowtype;
 v_stage private.website_runtime_secret_stages%rowtype;v_handoff private.website_vercel_secret_handoffs%rowtype;
 v_source_available boolean:=false;v_ready boolean:=false;v_branch text;
begin
 if p_project_id is null or p_owner_id is null or p_vercel_connection_id is null
  or p_vercel_connection_version is null or p_vercel_connection_version<1
  or p_environment not in('preview','production')
  or not((p_source_connection_id='runtime-supabase' and p_source_field='apiKey' and p_environment_key='SUPABASE_SECRET_KEY')
   or(p_source_connection_id='runtime-cron' and p_source_field='secret' and p_environment_key='CRON_SECRET'))
  then raise exception 'Runtime secret state unavailable';end if;
 v_branch:=case when p_environment='preview' then 'tayar/'||p_project_id::text||'/preview' else '' end;
 select c.* into v_vercel from private.website_infrastructure_connections c
 join public.projects p on p.id=c.project_id
 where c.id=p_vercel_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.provider='vercel' and c.environment=p_environment and c.version=p_vercel_connection_version
  and c.status in('connected','setup-incomplete','deployment-failed','ready') and c.target_id is not null;
 if not found then raise exception 'Runtime secret state unavailable';end if;
 select s.* into v_stage from private.website_runtime_secret_stages s
  where s.project_id=p_project_id and s.owner_id=p_owner_id and s.source_connection_id=p_source_connection_id
   and s.source_field=p_source_field and s.environment=p_environment and s.environment_key=p_environment_key;
 if v_stage.id is not null then
  select h.* into v_handoff from private.website_vercel_secret_handoffs h
   where h.connection_id=p_vercel_connection_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and h.source_connection_id=p_source_connection_id and h.source_field=p_source_field
    and h.source_environment=p_environment and h.environment_key=p_environment_key
    and h.target=p_environment and h.git_branch=v_branch;
  select exists(select 1 from private.website_project_secrets p
   where p.project_id=p_project_id and p.connection_id=p_source_connection_id and p.field=p_source_field
    and p.environment=p_environment and p.updated_at=v_stage.source_updated_at) into v_source_available;
  v_ready:=v_handoff.id is not null and v_handoff.status='verified'
   and v_handoff.source_updated_at=v_stage.source_updated_at and v_handoff.vercel_project_id=v_vercel.target_id
   and v_handoff.vercel_environment_id is not null and not v_source_available;
 end if;
 return jsonb_build_object('stageId',v_stage.id,'stageVersion',coalesce(v_stage.version,0),
  'stageOperationId',v_stage.operation_id,'sourceUpdatedAt',v_stage.source_updated_at,
  'handoffId',v_handoff.id,'handoffVersion',coalesce(v_handoff.version,0),
  'handoffStatus',v_handoff.status,'handoffOperationId',v_handoff.operation_id,
  'environmentId',v_handoff.vercel_environment_id,'sourceAvailable',v_source_available,'ready',v_ready);
end $$;
revoke all on function public.website_owned_runtime_secret_state_for_worker(uuid,uuid,uuid,bigint,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.website_owned_runtime_secret_state_for_worker(uuid,uuid,uuid,bigint,text,text,text,text)
 to service_role;
