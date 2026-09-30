-- Promotion is a distinct, durable effect. Once claimed, retries reconcile
-- Vercel state and must not issue POST /promote a second time.
create table private.website_vercel_promotions (
  production_connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  preview_connection_id uuid not null references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  preview_connection_version bigint not null check (preview_connection_version>0),
  production_connection_version bigint not null check (production_connection_version>0),
  preview_attempt_version bigint not null check (preview_attempt_version>0),
  vercel_project_id text not null,
  deployment_id text not null,
  source_commit_sha text not null check (source_commit_sha ~ '^[0-9a-f]{40}$'),
  expected_aliases text[] not null,
  observed_aliases text[] not null default '{}'::text[],
  live_url text,
  status text not null check (status in ('prepared','claimed','ready')),
  operation_id uuid not null unique,
  last_commit_id uuid,
  version bigint not null check (version>0),
  claimed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table private.website_vercel_promotions enable row level security;
revoke all on private.website_vercel_promotions from public, anon, authenticated;

create function public.website_begin_vercel_promotion(
  p_preview_connection_id uuid,p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,
  p_preview_connection_version bigint,p_production_connection_version bigint,p_preview_attempt_version bigint,
  p_expected_promotion_version bigint,p_vercel_project_id text,p_deployment_id text,p_source_commit_sha text,
  p_expected_aliases text[],p_operation_id uuid
) returns bigint language plpgsql security definer set search_path='' as $$
declare v_row private.website_vercel_promotions%rowtype; v_alias text; v_next bigint;
begin
  if p_preview_connection_id=p_production_connection_id or p_operation_id is null
    or p_preview_connection_version<1 or p_production_connection_version<1 or p_preview_attempt_version<1
    or p_expected_promotion_version<0 or p_vercel_project_id !~ '^prj_[a-zA-Z0-9]{8,128}$'
    or p_deployment_id !~ '^dpl_[a-zA-Z0-9]{8,128}$' or p_source_commit_sha !~ '^[0-9a-f]{40}$'
    or p_expected_aliases is null or cardinality(p_expected_aliases)<1 or cardinality(p_expected_aliases)>100
    then raise exception 'Invalid Vercel promotion'; end if;
  foreach v_alias in array p_expected_aliases loop
    if length(v_alias)>253 or v_alias !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z]{2,63}$'
      then raise exception 'Invalid production alias'; end if;
  end loop;
  if (select count(distinct item) from unnest(p_expected_aliases) item)<>cardinality(p_expected_aliases)
    or p_expected_aliases<>(select array_agg(item order by item) from unnest(p_expected_aliases) item)
    then raise exception 'Invalid production aliases'; end if;

  perform 1 from private.website_vercel_deployment_attempts a
    join private.website_infrastructure_connections pc on pc.id=a.connection_id
    join private.website_vercel_integration_custody pvc on pvc.connection_id=pc.id
    join private.website_infrastructure_connections rc on rc.id=p_production_connection_id
    join private.website_vercel_integration_custody rvc on rvc.connection_id=rc.id
    join public.projects p on p.id=a.project_id
  where a.connection_id=p_preview_connection_id and a.project_id=p_project_id and a.owner_id=p_owner_id
    and a.version=p_preview_attempt_version and a.connection_version=p_preview_connection_version
    and a.vercel_project_id=p_vercel_project_id and a.deployment_id=p_deployment_id
    and a.source_commit_sha=p_source_commit_sha and a.target='preview' and a.status='ready'
    and pc.project_id=p_project_id and pc.owner_id=p_owner_id and pc.provider='vercel'
    and pc.environment='preview' and pc.version=p_preview_connection_version and pc.status='ready'
    and pvc.connection_version=pc.version and pvc.custody_expires_at>clock_timestamp()
    and rc.project_id=p_project_id and rc.owner_id=p_owner_id and rc.provider='vercel'
    and rc.environment='production' and rc.version=p_production_connection_version
    and rc.status in ('connected','setup-incomplete','deployment-failed','ready')
    and rvc.connection_version=rc.version and rvc.custody_expires_at>clock_timestamp()
    and pvc.account_id=rvc.account_id and pvc.vercel_project_id=rvc.vercel_project_id
    and pvc.repository_id=rvc.repository_id and pvc.repository_owner=rvc.repository_owner
    and pvc.repository_name=rvc.repository_name and pvc.production_branch=rvc.production_branch
    and rvc.vercel_project_id=p_vercel_project_id and p.user_id=p_owner_id
    and p.type='website-builder' and p.deleted_at is null for update of rc;
  if not found then raise exception 'Vercel promotion scope changed'; end if;

  select * into v_row from private.website_vercel_promotions
    where production_connection_id=p_production_connection_id for update;
  if found and v_row.operation_id=p_operation_id then
    if v_row.preview_connection_id<>p_preview_connection_id or v_row.project_id<>p_project_id
      or v_row.owner_id<>p_owner_id or v_row.preview_connection_version<>p_preview_connection_version
      or v_row.production_connection_version<>p_production_connection_version
      or v_row.preview_attempt_version<>p_preview_attempt_version or v_row.vercel_project_id<>p_vercel_project_id
      or v_row.deployment_id<>p_deployment_id or v_row.source_commit_sha<>p_source_commit_sha
      or v_row.expected_aliases<>p_expected_aliases then raise exception 'Vercel promotion changed'; end if;
    return v_row.version;
  end if;
  if p_expected_promotion_version=0 then
    if found then raise exception 'Vercel promotion changed'; end if;
    insert into private.website_vercel_promotions(production_connection_id,preview_connection_id,project_id,owner_id,
      preview_connection_version,production_connection_version,preview_attempt_version,vercel_project_id,deployment_id,
      source_commit_sha,expected_aliases,status,operation_id,version)
    values(p_production_connection_id,p_preview_connection_id,p_project_id,p_owner_id,p_preview_connection_version,
      p_production_connection_version,p_preview_attempt_version,p_vercel_project_id,p_deployment_id,p_source_commit_sha,
      p_expected_aliases,'prepared',p_operation_id,1); return 1;
  end if;
  if not found or v_row.version<>p_expected_promotion_version or v_row.status<>'ready'
    then raise exception 'Vercel promotion changed'; end if;
  v_next:=v_row.version+1;
  update private.website_vercel_promotions set preview_connection_id=p_preview_connection_id,
    preview_connection_version=p_preview_connection_version,production_connection_version=p_production_connection_version,
    preview_attempt_version=p_preview_attempt_version,vercel_project_id=p_vercel_project_id,deployment_id=p_deployment_id,
    source_commit_sha=p_source_commit_sha,expected_aliases=p_expected_aliases,observed_aliases='{}'::text[],live_url=null,
    status='prepared',operation_id=p_operation_id,last_commit_id=null,version=v_next,claimed_at=null,verified_at=null,
    created_at=clock_timestamp(),updated_at=clock_timestamp() where production_connection_id=p_production_connection_id;
  return v_next;
end $$;
revoke all on function public.website_begin_vercel_promotion(uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,text,text,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.website_begin_vercel_promotion(uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,text,text,text,text[],uuid) to service_role;

create function public.website_claim_vercel_promotion(
  p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_promotion_version bigint,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.website_vercel_promotions%rowtype; v_issue boolean:=false; v_token text; v_account text; v_branch text;
begin
  select * into v_row from private.website_vercel_promotions where production_connection_id=p_production_connection_id
    and project_id=p_project_id and owner_id=p_owner_id and operation_id=p_operation_id for update;
  if not found or v_row.version<>p_expected_promotion_version or v_row.status not in ('prepared','claimed')
    then raise exception 'Vercel promotion changed'; end if;
  if v_row.status='prepared' then
    update private.website_vercel_promotions set status='claimed',version=version+1,claimed_at=clock_timestamp(),updated_at=clock_timestamp()
      where production_connection_id=p_production_connection_id returning * into v_row; v_issue:=true;
  end if;
  select d.decrypted_secret,v.account_id,v.production_branch into v_token,v_account,v_branch
  from private.website_vercel_integration_custody v join private.website_infrastructure_connections c on c.id=v.connection_id
    join vault.decrypted_secrets d on d.id=v.secret_id
  where v.connection_id=p_production_connection_id and v.project_id=p_project_id and v.owner_id=p_owner_id
    and v.connection_version=v_row.production_connection_version and v.vercel_project_id=v_row.vercel_project_id
    and v.custody_expires_at>clock_timestamp() and c.version=v.connection_version and c.provider='vercel'
    and c.environment='production' and c.account_id=v.account_id and c.target_id=v.vercel_project_id;
  if v_token is null then raise exception 'Vercel custody changed'; end if;
  return jsonb_build_object('promotionVersion',v_row.version,'issuePromotion',v_issue,'accessToken',v_token,
    'accountId',v_account,'productionBranch',v_branch);
end $$;
revoke all on function public.website_claim_vercel_promotion(uuid,uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.website_claim_vercel_promotion(uuid,uuid,uuid,bigint,uuid) to service_role;

create function public.website_commit_vercel_promotion(
  p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_promotion_version bigint,
  p_operation_id uuid,p_deployment_id text,p_source_commit_sha text,p_observed_aliases text[],p_live_url text,p_commit_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.website_vercel_promotions%rowtype; v_version bigint; v_connection bigint;
begin
  if p_commit_id is null or p_observed_aliases is null or p_live_url is null then raise exception 'Invalid promotion proof'; end if;
  select * into v_row from private.website_vercel_promotions where production_connection_id=p_production_connection_id
    and project_id=p_project_id and owner_id=p_owner_id and operation_id=p_operation_id for update;
  if not found or v_row.version<>p_expected_promotion_version or v_row.status<>'claimed'
    or v_row.deployment_id<>p_deployment_id or v_row.source_commit_sha<>p_source_commit_sha
    or v_row.expected_aliases<>p_observed_aliases or p_live_url<>('https://' || p_observed_aliases[1])
    then raise exception 'Vercel promotion changed'; end if;
  update private.website_infrastructure_connections set status='ready',
    permissions=array['deployment:promote','deployment:read','domain:read','project:read','team:read','user:read'],
    verified_at=clock_timestamp(),operation_id=null,version=version+1,last_commit_id=p_commit_id,updated_at=clock_timestamp()
  where id=p_production_connection_id and project_id=p_project_id and owner_id=p_owner_id and provider='vercel'
    and environment='production' and version=v_row.production_connection_version and target_id=v_row.vercel_project_id
    returning version into v_connection;
  if v_connection is null then raise exception 'Vercel connection changed'; end if;
  update private.website_vercel_integration_custody set connection_version=v_connection,updated_at=clock_timestamp()
    where connection_id=p_production_connection_id and connection_version=v_row.production_connection_version;
  if not found then raise exception 'Vercel custody changed'; end if;
  v_version:=v_row.version+1;
  update private.website_vercel_promotions set status='ready',observed_aliases=p_observed_aliases,live_url=p_live_url,
    production_connection_version=v_connection,last_commit_id=p_commit_id,version=v_version,verified_at=clock_timestamp(),updated_at=clock_timestamp()
    where production_connection_id=p_production_connection_id;
  return jsonb_build_object('promotionVersion',v_version,'connectionVersion',v_connection);
end $$;
revoke all on function public.website_commit_vercel_promotion(uuid,uuid,uuid,bigint,uuid,text,text,text[],text,uuid) from public,anon,authenticated;
grant execute on function public.website_commit_vercel_promotion(uuid,uuid,uuid,bigint,uuid,text,text,text[],text,uuid) to service_role;

create function public.website_reconcile_vercel_promotion(
  p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_promotion_version bigint,
  p_operation_id uuid,p_deployment_id text,p_source_commit_sha text,p_observed_aliases text[],p_live_url text,p_commit_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('promotionVersion',v.version,'connectionVersion',v.production_connection_version)
  from private.website_vercel_promotions v join public.projects p on p.id=v.project_id
  where v.production_connection_id=p_production_connection_id and v.project_id=p_project_id and v.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and v.version=p_expected_promotion_version+1 and v.operation_id=p_operation_id and v.status='ready'
    and v.deployment_id=p_deployment_id and v.source_commit_sha=p_source_commit_sha
    and v.observed_aliases=p_observed_aliases and v.live_url=p_live_url and v.last_commit_id=p_commit_id;
$$;
revoke all on function public.website_reconcile_vercel_promotion(uuid,uuid,uuid,bigint,uuid,text,text,text[],text,uuid) from public,anon,authenticated;
grant execute on function public.website_reconcile_vercel_promotion(uuid,uuid,uuid,bigint,uuid,text,text,text[],text,uuid) to service_role;

create function public.website_vercel_promotion_for_worker(
  p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version',v.version,'operationId',v.operation_id,'status',v.status,
    'deploymentId',v.deployment_id,'sourceCommitSha',v.source_commit_sha,'expectedAliases',v.expected_aliases)
  from private.website_vercel_promotions v join public.projects p on p.id=v.project_id
  where v.production_connection_id=p_production_connection_id and v.project_id=p_project_id
    and v.owner_id=p_owner_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null;
$$;
revoke all on function public.website_vercel_promotion_for_worker(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_vercel_promotion_for_worker(uuid,uuid,uuid) to service_role;
