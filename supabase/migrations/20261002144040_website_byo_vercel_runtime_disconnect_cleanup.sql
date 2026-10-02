-- Disconnect must not erase Vercel custody until every unchanged runtime
-- variable owned by the verified receipt is absent. The receipt contains only
-- IDs/digests/metadata; runtime values never enter this workflow.
alter table private.website_vercel_runtime_environment_receipts
 drop constraint website_vercel_runtime_environment_receipts_status_check,
 add constraint website_vercel_runtime_environment_receipts_status_check
  check(status in('preparing','verified','removing','removed'));

-- A reconnect may advance the connection while provider cleanup is in flight,
-- but it may not overwrite the claimed receipt until cleanup commits removed.
create function private.website_vercel_runtime_removal_transition_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.status='removing' and(new.status<>'removed' or new.operation_id<>old.operation_id
  or new.owner_id<>old.owner_id or new.vercel_connection_id<>old.vercel_connection_id
  or new.vercel_connection_version<>old.vercel_connection_version
  or new.vercel_project_id<>old.vercel_project_id or new.git_branch is distinct from old.git_branch
  or new.marker<>old.marker or new.vercel_environment_ids<>old.vercel_environment_ids)
 then raise exception 'Runtime environment removal is in progress';end if;
 return new;
end $$;
revoke all on function private.website_vercel_runtime_removal_transition_guard() from public,anon,authenticated;
create trigger website_vercel_runtime_removal_transition_guard
before update on private.website_vercel_runtime_environment_receipts for each row
execute function private.website_vercel_runtime_removal_transition_guard();

-- Remove the former direct disconnect boundary so service code cannot bypass
-- receipt-owned provider cleanup.
drop function public.website_disconnect_vercel_connection(uuid,uuid,uuid,bigint,uuid);
drop function public.website_reconcile_vercel_disconnect(uuid,uuid,uuid,bigint,uuid);

create function public.website_begin_vercel_runtime_disconnect(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,
 p_expected_connection_version bigint,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.website_infrastructure_connections%rowtype;
 r private.website_vercel_runtime_environment_receipts%rowtype;
 v_user text;v_account text;v_project text;v_token text;v_next bigint;
begin
 if p_expected_connection_version is null or p_expected_connection_version<1 or p_operation_id is null
  then raise exception 'Vercel disconnect unavailable';end if;
 select x,v.user_id,v.account_id,v.vercel_project_id,d.decrypted_secret
 into c,v_user,v_account,v_project,v_token
 from private.website_infrastructure_connections x
 join public.projects p on p.id=x.project_id
 join private.website_vercel_integration_custody v on v.connection_id=x.id
 join vault.decrypted_secrets d on d.id=v.secret_id
 where x.id=p_connection_id and x.project_id=p_project_id and x.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and x.provider='vercel' and x.version=p_expected_connection_version
  and x.status in('connected','setup-incomplete','deployment-failed','ready')
  and x.target_id=v.vercel_project_id and x.account_id=v.account_id and x.environment=v.environment
  and v.project_id=x.project_id and v.owner_id=x.owner_id and v.connection_version=x.version
  and v.custody_expires_at>clock_timestamp()
 for update of x,v;
 if not found or v_token is null then raise exception 'Vercel disconnect changed';end if;
 select * into r from private.website_vercel_runtime_environment_receipts
 where project_id=p_project_id and environment=c.environment for update;
 if not found or r.status='removed' then
  return jsonb_build_object('cleanupRequired',false,'receiptVersion',null);
 end if;
 if r.owner_id<>p_owner_id or r.vercel_connection_id<>p_connection_id
  or r.vercel_connection_version<>p_expected_connection_version or r.vercel_project_id<>v_project
  or r.superseded_environment_ids is not null or r.vercel_environment_ids is null
  or jsonb_typeof(r.vercel_environment_ids)<>'object'
  or (select array_agg(k order by k)from jsonb_object_keys(r.vercel_environment_ids)k)
    <>array['SUPABASE_ANON_KEY','SUPABASE_URL']
  or exists(select 1 from jsonb_each_text(r.vercel_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or (select count(*)from jsonb_each_text(r.vercel_environment_ids))
    <>(select count(distinct e.value)from jsonb_each_text(r.vercel_environment_ids)e)
  or (c.environment='preview' and(r.git_branch is distinct from 'tayar/'||p_project_id::text||'/preview'
    or r.marker!~'^Tayar runtime [0-9a-f-]{36}$'))
  or (c.environment='production' and(r.git_branch is not null
    or r.marker!~'^Tayar production runtime [0-9a-f-]{36}$'))
  then raise exception 'Runtime environment cleanup changed';end if;
 if r.status='verified' then
  v_next:=r.version+1;
  update private.website_vercel_runtime_environment_receipts set status='removing',operation_id=p_operation_id,
   last_commit_id=null,version=v_next,updated_at=clock_timestamp()
  where project_id=p_project_id and environment=c.environment returning * into r;
 elsif r.status='removing' and r.operation_id=p_operation_id then
  v_next:=r.version;
 else raise exception 'Runtime environment cleanup changed';end if;
 return jsonb_build_object('cleanupRequired',true,'receiptVersion',v_next,'accessToken',v_token,
  'userId',v_user,'accountId',v_account,'vercelProjectId',v_project,'environment',c.environment,
  'gitBranch',r.git_branch,'marker',r.marker,'environmentIds',r.vercel_environment_ids);
end $$;
revoke all on function public.website_begin_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid)
 from public,anon,authenticated;
grant execute on function public.website_begin_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid)
 to service_role;

create function public.website_commit_vercel_runtime_disconnect(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
 p_operation_id uuid,p_commit_id uuid,p_expected_receipt_version bigint,
 p_removed_environment_ids jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.website_infrastructure_connections%rowtype;
 r private.website_vercel_runtime_environment_receipts%rowtype;
 v_connection bigint;v_receipt bigint;v_expected jsonb;
begin
 if p_expected_connection_version is null or p_expected_connection_version<1
  or p_operation_id is null or p_commit_id is null or p_removed_environment_ids is null
  or jsonb_typeof(p_removed_environment_ids)<>'array'
  or exists(select 1 from jsonb_array_elements_text(p_removed_environment_ids)e
    where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or jsonb_array_length(p_removed_environment_ids)<>
    (select count(distinct e.value)from jsonb_array_elements_text(p_removed_environment_ids)e)
  then raise exception 'Vercel disconnect commit unavailable';end if;
 select x.* into c from private.website_infrastructure_connections x
 join public.projects p on p.id=x.project_id
 join private.website_vercel_integration_custody v on v.connection_id=x.id
 where x.id=p_connection_id and x.project_id=p_project_id and x.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and x.provider='vercel' and x.version=p_expected_connection_version
  and x.status in('connected','setup-incomplete','deployment-failed','ready')
  and v.project_id=x.project_id and v.owner_id=x.owner_id and v.environment=x.environment
  and v.connection_version=x.version and v.vercel_project_id=x.target_id and v.account_id=x.account_id
  and v.custody_expires_at>clock_timestamp()
 for update of x,v;
 if not found then raise exception 'Vercel disconnect changed';end if;
 select * into r from private.website_vercel_runtime_environment_receipts
 where project_id=p_project_id and environment=c.environment for update;
 if p_expected_receipt_version is null then
  if p_removed_environment_ids<>'[]'::jsonb or (found and r.status<>'removed')
   then raise exception 'Runtime environment cleanup changed';end if;
  v_receipt:=null;
 else
  if not found or r.owner_id<>p_owner_id or r.vercel_connection_id<>p_connection_id
   or r.vercel_connection_version<>p_expected_connection_version or r.vercel_project_id<>c.target_id
   or r.version<>p_expected_receipt_version or r.operation_id<>p_operation_id or r.status<>'removing'
   then raise exception 'Runtime environment cleanup changed';end if;
  select coalesce(jsonb_agg(e.value order by e.value),'[]'::jsonb)into v_expected
   from jsonb_each_text(r.vercel_environment_ids)e;
  if p_removed_environment_ids<>v_expected then raise exception 'Runtime environment cleanup changed';end if;
  v_receipt:=r.version+1;
  update private.website_vercel_runtime_environment_receipts set status='removed',
   superseded_environment_ids=null,removed_environment_ids=p_removed_environment_ids,
   last_commit_id=p_commit_id,version=v_receipt,verified_at=null,updated_at=clock_timestamp()
  where project_id=p_project_id and environment=c.environment;
 end if;
 update private.website_infrastructure_connections set status='disconnected',target_id=null,
  permissions='{}'::text[],verified_at=null,operation_id=null,version=version+1,
  last_commit_id=p_commit_id,updated_at=clock_timestamp()
 where id=p_connection_id and version=p_expected_connection_version returning version into v_connection;
 if v_connection is null then raise exception 'Vercel disconnect changed';end if;
 delete from private.website_vercel_integration_custody
  where connection_id=p_connection_id and connection_version=p_expected_connection_version;
 if not found then raise exception 'Vercel custody changed';end if;
 return jsonb_build_object('connectionVersion',v_connection,'receiptVersion',v_receipt);
end $$;
revoke all on function public.website_commit_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid,uuid,bigint,jsonb)
 from public,anon,authenticated;
grant execute on function public.website_commit_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid,uuid,bigint,jsonb)
 to service_role;

create function public.website_reconcile_vercel_runtime_disconnect(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
 p_operation_id uuid,p_commit_id uuid,p_expected_receipt_version bigint,
 p_removed_environment_ids jsonb
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('connectionVersion',c.version,'receiptVersion',
  case when p_expected_receipt_version is null then null else p_expected_receipt_version+1 end)
 from private.website_infrastructure_connections c join public.projects p on p.id=c.project_id
 where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.provider='vercel' and c.status='disconnected' and c.target_id is null
  and cardinality(c.permissions)=0 and c.verified_at is null and c.operation_id is null
  and c.version=p_expected_connection_version+1 and c.last_commit_id=p_commit_id
  and not exists(select 1 from private.website_vercel_integration_custody v where v.connection_id=c.id)
  and ((p_expected_receipt_version is null and p_removed_environment_ids='[]'::jsonb
    and not exists(select 1 from private.website_vercel_runtime_environment_receipts a
      where a.project_id=c.project_id and a.environment=c.environment
       and a.status in('preparing','verified','removing')))
   or (p_expected_receipt_version is not null and exists(
    select 1 from private.website_vercel_runtime_environment_receipts e
    where e.project_id=c.project_id and e.owner_id=c.owner_id and e.environment=c.environment
     and e.vercel_connection_id=c.id and e.vercel_connection_version=p_expected_connection_version
     and e.version=p_expected_receipt_version+1 and e.operation_id=p_operation_id
     and e.status='removed' and e.removed_environment_ids=p_removed_environment_ids
     and e.last_commit_id=p_commit_id)))
$$;
revoke all on function public.website_reconcile_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid,uuid,bigint,jsonb)
 from public,anon,authenticated;
grant execute on function public.website_reconcile_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid,uuid,bigint,jsonb)
 to service_role;

-- Whole-request retries can prove the final state before asking for custody or
-- touching Vercel again. An active receipt makes a no-cleanup proof impossible.
create function public.website_reconcile_completed_vercel_runtime_disconnect(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
 p_operation_id uuid,p_commit_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('connectionVersion',c.version,'receiptVersion',(
  select e.version from private.website_vercel_runtime_environment_receipts e
  where e.project_id=c.project_id and e.owner_id=c.owner_id and e.environment=c.environment
   and e.vercel_connection_id=c.id and e.vercel_connection_version=p_expected_connection_version
   and e.operation_id=p_operation_id and e.status='removed' and e.last_commit_id=p_commit_id))
 from private.website_infrastructure_connections c join public.projects p on p.id=c.project_id
 where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.provider='vercel' and c.status='disconnected' and c.target_id is null
  and cardinality(c.permissions)=0 and c.verified_at is null and c.operation_id is null
  and c.version=p_expected_connection_version+1 and c.last_commit_id=p_commit_id
  and not exists(select 1 from private.website_vercel_integration_custody v where v.connection_id=c.id)
  and not exists(select 1 from private.website_vercel_runtime_environment_receipts a
   where a.project_id=c.project_id and a.environment=c.environment
    and a.status in('preparing','verified','removing'))
$$;
revoke all on function public.website_reconcile_completed_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.website_reconcile_completed_vercel_runtime_disconnect(uuid,uuid,uuid,bigint,uuid,uuid)
 to service_role;
