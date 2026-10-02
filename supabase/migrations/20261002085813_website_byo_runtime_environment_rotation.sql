-- Preserve the prior verified destination IDs while a rotated binding is
-- written and verified. Cleanup records IDs only; runtime values stay absent.
alter table private.website_vercel_runtime_environment_receipts
 add column superseded_environment_ids jsonb,
 add column removed_environment_ids jsonb not null default '[]'::jsonb;

create or replace function public.website_begin_vercel_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_binding_version bigint,
 p_supabase_connection_id uuid,p_supabase_connection_version bigint,
 p_vercel_connection_id uuid,p_vercel_connection_version bigint,p_vercel_project_id text,
 p_git_branch text,p_value_digests jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.website_vercel_runtime_environment_receipts%rowtype;v_marker text;
begin
 if p_binding_version is null or p_binding_version<1 or p_supabase_connection_version<1
  or p_vercel_connection_version<1 or p_operation_id is null
  or p_vercel_project_id!~'^prj_[A-Za-z0-9]{8,128}$'
  or p_git_branch<>('tayar/'||p_project_id::text||'/preview')
  or p_value_digests is null or jsonb_typeof(p_value_digests)<>'object'
  or (select array_agg(k order by k)from jsonb_object_keys(p_value_digests)k)
    <>array['SUPABASE_ANON_KEY','SUPABASE_URL']
  or exists(select 1 from jsonb_each_text(p_value_digests)e where e.value!~'^[0-9a-f]{64}$')
  then raise exception 'Runtime environment unavailable';end if;
 perform 1 from private.website_byo_runtime_bindings b
 join public.projects p on p.id=b.project_id
 join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
 join private.website_vercel_integration_custody c on c.connection_id=v.id
 where b.project_id=p_project_id and b.owner_id=p_owner_id and b.environment='preview' and b.version=p_binding_version
  and b.supabase_connection_id=p_supabase_connection_id and b.supabase_connection_version=p_supabase_connection_version
  and b.vercel_connection_id=p_vercel_connection_id and b.vercel_connection_version=p_vercel_connection_version
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p.content->'application'=b.application_definition
  and s.project_id=b.project_id and s.owner_id=b.owner_id and s.provider='supabase' and s.environment='preview'
  and s.version=b.supabase_connection_version and s.status='ready' and s.verified_at is not null
  and p_value_digests->>'SUPABASE_URL'=encode(extensions.digest('https://'||s.target_id||'.supabase.co','sha256'),'hex')
  and p_value_digests->>'SUPABASE_ANON_KEY'=encode(extensions.digest(b.publishable_key,'sha256'),'hex')
  and v.project_id=b.project_id and v.owner_id=b.owner_id and v.provider='vercel' and v.environment='preview'
  and v.version=b.vercel_connection_version and v.target_id=p_vercel_project_id and v.verified_at is not null
  and v.status in('connected','setup-incomplete','deployment-failed','ready')
  and c.project_id=b.project_id and c.owner_id=b.owner_id and c.connection_version=v.version
  and c.vercel_project_id=p_vercel_project_id and c.custody_expires_at>clock_timestamp()
 for update of b,v;
 if not found then raise exception 'Runtime environment changed';end if;
 select * into r from private.website_vercel_runtime_environment_receipts
  where project_id=p_project_id and environment='preview' for update;
 if found and r.status='verified' and r.superseded_environment_ids is null and r.owner_id=p_owner_id
  and r.binding_version=p_binding_version and r.supabase_connection_id=p_supabase_connection_id
  and r.supabase_connection_version=p_supabase_connection_version and r.vercel_connection_id=p_vercel_connection_id
  and r.vercel_connection_version=p_vercel_connection_version and r.vercel_project_id=p_vercel_project_id
  and r.git_branch=p_git_branch and r.value_digests=p_value_digests then
  return jsonb_build_object('receiptVersion',r.version,'status','verified','newlyClaimed',false,
   'marker',r.marker,'environmentIds',r.vercel_environment_ids,'supersededEnvironmentIds',null);end if;
 if found and r.status='preparing' and r.operation_id=p_operation_id then
  if r.owner_id<>p_owner_id or r.binding_version<>p_binding_version or r.supabase_connection_id<>p_supabase_connection_id
   or r.supabase_connection_version<>p_supabase_connection_version or r.vercel_connection_id<>p_vercel_connection_id
   or r.vercel_connection_version<>p_vercel_connection_version or r.vercel_project_id<>p_vercel_project_id
   or r.git_branch<>p_git_branch or r.value_digests<>p_value_digests then raise exception 'Runtime environment changed';end if;
  return jsonb_build_object('receiptVersion',r.version,'status','preparing','newlyClaimed',false,
   'marker',r.marker,'supersededEnvironmentIds',r.superseded_environment_ids);end if;
 v_marker:='Tayar runtime '||p_operation_id::text;
 if not found then
  insert into private.website_vercel_runtime_environment_receipts(project_id,owner_id,environment,binding_version,
   supabase_connection_id,supabase_connection_version,vercel_connection_id,vercel_connection_version,
   vercel_project_id,git_branch,value_digests,marker,status,operation_id,version)
  values(p_project_id,p_owner_id,'preview',p_binding_version,p_supabase_connection_id,p_supabase_connection_version,
   p_vercel_connection_id,p_vercel_connection_version,p_vercel_project_id,p_git_branch,p_value_digests,
   v_marker,'preparing',p_operation_id,1) returning * into r;
 else
  update private.website_vercel_runtime_environment_receipts set owner_id=p_owner_id,binding_version=p_binding_version,
   supabase_connection_id=p_supabase_connection_id,supabase_connection_version=p_supabase_connection_version,
   vercel_connection_id=p_vercel_connection_id,vercel_connection_version=p_vercel_connection_version,
   vercel_project_id=p_vercel_project_id,git_branch=p_git_branch,value_digests=p_value_digests,
   superseded_environment_ids=case when status='verified' then vercel_environment_ids else superseded_environment_ids end,
   vercel_environment_ids=null,removed_environment_ids='[]'::jsonb,marker=v_marker,status='preparing',
   operation_id=p_operation_id,last_commit_id=null,version=version+1,verified_at=null,updated_at=clock_timestamp()
  where project_id=p_project_id and environment='preview' returning * into r;
 end if;
 return jsonb_build_object('receiptVersion',r.version,'status','preparing','newlyClaimed',true,
  'marker',r.marker,'supersededEnvironmentIds',r.superseded_environment_ids);
end $$;

drop function public.website_commit_vercel_runtime_environment(uuid,uuid,bigint,uuid,jsonb,uuid);
create function public.website_commit_vercel_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_expected_receipt_version bigint,p_operation_id uuid,
 p_vercel_environment_ids jsonb,p_removed_environment_ids jsonb,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path='' as $$
declare r private.website_vercel_runtime_environment_receipts%rowtype;v_next bigint;v_expected jsonb;
begin
 if p_expected_receipt_version<1 or p_operation_id is null or p_commit_id is null
  or p_vercel_environment_ids is null or jsonb_typeof(p_vercel_environment_ids)<>'object'
  or (select array_agg(k order by k)from jsonb_object_keys(p_vercel_environment_ids)k)
    <>array['SUPABASE_ANON_KEY','SUPABASE_URL']
  or exists(select 1 from jsonb_each_text(p_vercel_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or p_removed_environment_ids is null or jsonb_typeof(p_removed_environment_ids)<>'array'
  or exists(select 1 from jsonb_array_elements_text(p_removed_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or jsonb_array_length(p_removed_environment_ids)<>(select count(distinct e.value)from jsonb_array_elements_text(p_removed_environment_ids)e)
  then raise exception 'Runtime environment commit unavailable';end if;
 select e.* into r from private.website_vercel_runtime_environment_receipts e
 join public.projects p on p.id=e.project_id
 join private.website_infrastructure_connections v on v.id=e.vercel_connection_id
 join private.website_vercel_integration_custody c on c.connection_id=v.id
 where e.project_id=p_project_id and e.owner_id=p_owner_id and e.environment='preview'
  and e.version=p_expected_receipt_version and e.operation_id=p_operation_id and e.status='preparing'
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and v.project_id=e.project_id and v.owner_id=e.owner_id and v.version=e.vercel_connection_version
  and v.target_id=e.vercel_project_id and c.connection_version=v.version and c.custody_expires_at>clock_timestamp()
 for update of e;
 if not found then raise exception 'Runtime environment changed';end if;
 select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb)into v_expected
 from jsonb_each_text(coalesce(r.superseded_environment_ids,'{}'::jsonb))x
 where not exists(select 1 from jsonb_each_text(p_vercel_environment_ids)n where n.value=x.value);
 if p_removed_environment_ids<>v_expected then raise exception 'Runtime environment cleanup changed';end if;
 v_next:=r.version+1;
 update private.website_vercel_runtime_environment_receipts set status='verified',
  vercel_environment_ids=p_vercel_environment_ids,superseded_environment_ids=null,
  removed_environment_ids=p_removed_environment_ids,last_commit_id=p_commit_id,version=v_next,
  verified_at=clock_timestamp(),updated_at=clock_timestamp()
 where project_id=p_project_id and environment='preview';return v_next;
end $$;
revoke all on function public.website_commit_vercel_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_commit_vercel_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) to service_role;

drop function public.website_reconcile_vercel_runtime_environment(uuid,uuid,bigint,uuid,jsonb,uuid);
create function public.website_reconcile_vercel_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_expected_receipt_version bigint,p_operation_id uuid,
 p_vercel_environment_ids jsonb,p_removed_environment_ids jsonb,p_commit_id uuid
) returns bigint language sql stable security definer set search_path='' as $$
 select e.version from private.website_vercel_runtime_environment_receipts e join public.projects p on p.id=e.project_id
 where e.project_id=p_project_id and e.owner_id=p_owner_id and e.environment='preview'
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and e.version=p_expected_receipt_version+1 and e.operation_id=p_operation_id and e.status='verified'
  and e.vercel_environment_ids=p_vercel_environment_ids and e.superseded_environment_ids is null
  and e.removed_environment_ids=p_removed_environment_ids and e.last_commit_id=p_commit_id
$$;
revoke all on function public.website_reconcile_vercel_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_reconcile_vercel_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) to service_role;

create or replace function public.website_verify_vercel_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_binding_version bigint,p_supabase_connection_id uuid,
 p_supabase_connection_version bigint,p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_vercel_project_id text,p_git_branch text,p_required_environment text[]
) returns boolean language sql stable security definer set search_path='' as $$
 select p_required_environment=array['SUPABASE_ANON_KEY','SUPABASE_URL'] and exists(
  select 1 from private.website_vercel_runtime_environment_receipts e
  join private.website_byo_runtime_bindings b on b.project_id=e.project_id and b.environment=e.environment
  join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
  join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
  join public.projects p on p.id=e.project_id
  where e.project_id=p_project_id and e.owner_id=p_owner_id and e.environment='preview' and e.status='verified'
   and e.superseded_environment_ids is null and e.binding_version=p_binding_version and b.version=e.binding_version
   and e.supabase_connection_id=p_supabase_connection_id and e.supabase_connection_version=p_supabase_connection_version
   and b.supabase_connection_id=e.supabase_connection_id and b.supabase_connection_version=e.supabase_connection_version
   and e.vercel_connection_id=p_vercel_connection_id and e.vercel_connection_version=p_vercel_connection_version
   and b.vercel_connection_id=e.vercel_connection_id and b.vercel_connection_version=e.vercel_connection_version
   and e.vercel_project_id=p_vercel_project_id and v.target_id=e.vercel_project_id
   and e.git_branch=p_git_branch and e.git_branch='tayar/'||p_project_id::text||'/preview'
   and e.value_digests=jsonb_build_object('SUPABASE_URL',encode(extensions.digest('https://'||s.target_id||'.supabase.co','sha256'),'hex'),
    'SUPABASE_ANON_KEY',encode(extensions.digest(b.publishable_key,'sha256'),'hex'))
   and (select count(*) from jsonb_object_keys(e.vercel_environment_ids))=2 and p.user_id=p_owner_id
   and p.type='website-builder' and p.deleted_at is null and s.version=b.supabase_connection_version
   and v.version=b.vercel_connection_version and s.status='ready'
   and v.status in('connected','setup-incomplete','deployment-failed','ready'))
$$;
