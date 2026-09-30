-- Durable boundary for one customer-owned Supabase schema mutation. Provider
-- credentials remain in the existing scoped Vault custody and are returned
-- only by the service-role claim RPC after the attempt is persisted.
create table private.website_supabase_migration_attempts(
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check(environment in('preview','production')),
  project_ref text not null check(project_ref~'^[a-z]{20}$'),
  connection_version bigint not null check(connection_version>0),
  previous_definition jsonb not null,
  next_definition jsonb not null,
  previous_digest text not null check(previous_digest~'^[0-9a-f]{64}$'),
  next_digest text not null check(next_digest~'^[0-9a-f]{64}$'),
  query_digest text not null check(query_digest~'^[0-9a-f]{64}$'),
  statement_count integer not null check(statement_count between 1 and 512),
  status text not null check(status in('prepared','claimed','ready')),
  operation_id uuid not null unique,
  last_commit_id uuid,
  version bigint not null check(version>0),
  claimed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(previous_definition<>next_definition),
  check(previous_digest<>next_digest)
);
alter table private.website_supabase_migration_attempts enable row level security;
revoke all on private.website_supabase_migration_attempts from public,anon,authenticated;

create function public.website_begin_supabase_migration(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text,
 p_connection_version bigint,p_expected_attempt_version bigint,p_project_ref text,
 p_previous_definition jsonb,p_next_definition jsonb,p_previous_digest text,
 p_next_digest text,p_query_digest text,p_statement_count integer,p_operation_id uuid
)returns bigint language plpgsql security definer set search_path='' as $$
declare v_row private.website_supabase_migration_attempts%rowtype;v_next bigint;
begin
 if p_connection_id is null or p_project_id is null or p_owner_id is null or p_operation_id is null
  or p_environment not in('preview','production')or p_connection_version<1
  or p_expected_attempt_version<0 or p_project_ref!~'^[a-z]{20}$'
  or p_previous_definition is null or p_next_definition is null or p_previous_definition=p_next_definition
  or p_previous_digest!~'^[0-9a-f]{64}$'or p_next_digest!~'^[0-9a-f]{64}$'
  or p_query_digest!~'^[0-9a-f]{64}$'or p_previous_digest=p_next_digest
  or p_statement_count not between 1 and 512 then raise exception 'Invalid Supabase migration attempt';end if;
 perform 1 from public.projects p
 join private.website_infrastructure_connections c on c.project_id=p.id
 join private.website_supabase_oauth_custody s on s.connection_id=c.id
 where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder'and p.deleted_at is null
  and p.content->'application'=p_next_definition and c.id=p_connection_id and c.owner_id=p_owner_id
  and c.provider='supabase'and c.environment=p_environment and c.version=p_connection_version
  and c.account_id=s.account_id and c.target_id=p_project_ref
  and c.status in('connected','setup-incomplete','outdated-schema','ready')
  and 'database:write'=any(c.permissions)and s.project_id=p.id and s.owner_id=p_owner_id
  and s.environment=p_environment and s.project_ref=p_project_ref and s.connection_version=c.version
  and s.access_expires_at>clock_timestamp()and s.custody_expires_at>clock_timestamp() for update of c;
 if not found then raise exception 'Supabase migration scope changed';end if;
 select * into v_row from private.website_supabase_migration_attempts where connection_id=p_connection_id for update;
 if found and v_row.operation_id=p_operation_id then
  if v_row.project_id<>p_project_id or v_row.owner_id<>p_owner_id or v_row.environment<>p_environment
   or v_row.project_ref<>p_project_ref or v_row.connection_version<>p_connection_version
   or v_row.previous_definition<>p_previous_definition or v_row.next_definition<>p_next_definition
   or v_row.previous_digest<>p_previous_digest or v_row.next_digest<>p_next_digest
   or v_row.query_digest<>p_query_digest or v_row.statement_count<>p_statement_count
   then raise exception 'Supabase migration attempt changed';end if;return v_row.version;
 end if;
 if p_expected_attempt_version=0 then
  if found then raise exception 'Supabase migration attempt changed';end if;
  insert into private.website_supabase_migration_attempts(connection_id,project_id,owner_id,environment,
   project_ref,connection_version,previous_definition,next_definition,previous_digest,next_digest,
   query_digest,statement_count,status,operation_id,version)
  values(p_connection_id,p_project_id,p_owner_id,p_environment,p_project_ref,p_connection_version,
   p_previous_definition,p_next_definition,p_previous_digest,p_next_digest,p_query_digest,
   p_statement_count,'prepared',p_operation_id,1);return 1;
 end if;
 if not found or v_row.version<>p_expected_attempt_version or v_row.status<>'ready'
  then raise exception 'Supabase migration attempt changed';end if;
 v_next:=v_row.version+1;
 update private.website_supabase_migration_attempts set project_id=p_project_id,owner_id=p_owner_id,
  environment=p_environment,project_ref=p_project_ref,connection_version=p_connection_version,
  previous_definition=p_previous_definition,next_definition=p_next_definition,
  previous_digest=p_previous_digest,next_digest=p_next_digest,query_digest=p_query_digest,
  statement_count=p_statement_count,status='prepared',operation_id=p_operation_id,last_commit_id=null,
  version=v_next,claimed_at=null,verified_at=null,created_at=clock_timestamp(),updated_at=clock_timestamp()
 where connection_id=p_connection_id;return v_next;
end $$;
revoke all on function public.website_begin_supabase_migration(uuid,uuid,uuid,text,bigint,bigint,text,jsonb,jsonb,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.website_begin_supabase_migration(uuid,uuid,uuid,text,bigint,bigint,text,jsonb,jsonb,text,text,text,integer,uuid) to service_role;

create function public.website_claim_supabase_migration(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,p_operation_id uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.website_supabase_migration_attempts%rowtype;v_issue boolean:=false;v_token text;
begin
 select * into v_row from private.website_supabase_migration_attempts where connection_id=p_connection_id
  and project_id=p_project_id and owner_id=p_owner_id and operation_id=p_operation_id for update;
 if not found or v_row.version<>p_expected_attempt_version or v_row.status not in('prepared','claimed')
  then raise exception 'Supabase migration attempt changed';end if;
 if v_row.status='prepared'then
  update private.website_supabase_migration_attempts set status='claimed',version=version+1,
   claimed_at=clock_timestamp(),updated_at=clock_timestamp()where connection_id=p_connection_id
   returning * into v_row;v_issue:=true;
 end if;
 select d.decrypted_secret::jsonb->>'accessToken'into v_token
 from private.website_supabase_oauth_custody s
 join private.website_infrastructure_connections c on c.id=s.connection_id
 join vault.decrypted_secrets d on d.id=s.secret_id
 where s.connection_id=p_connection_id and s.project_id=p_project_id and s.owner_id=p_owner_id
  and s.environment=v_row.environment and s.project_ref=v_row.project_ref
  and s.connection_version=v_row.connection_version and s.access_expires_at>clock_timestamp()
  and s.custody_expires_at>clock_timestamp()and c.version=s.connection_version
  and c.provider='supabase'and c.target_id=s.project_ref and 'database:write'=any(c.permissions);
 if v_token is null or length(v_token)<20 or octet_length(v_token)>4096 then raise exception 'Supabase custody changed';end if;
 return jsonb_build_object('attemptVersion',v_row.version,'issueMutation',v_issue,'accessToken',v_token);
end $$;
revoke all on function public.website_claim_supabase_migration(uuid,uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.website_claim_supabase_migration(uuid,uuid,uuid,bigint,uuid) to service_role;

create function public.website_commit_supabase_migration(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,
 p_operation_id uuid,p_previous_digest text,p_next_digest text,p_query_digest text,p_commit_id uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.website_supabase_migration_attempts%rowtype;v_attempt bigint;v_connection bigint;
begin
 if p_commit_id is null then raise exception 'Invalid Supabase migration proof';end if;
 select * into v_row from private.website_supabase_migration_attempts where connection_id=p_connection_id
  and project_id=p_project_id and owner_id=p_owner_id and operation_id=p_operation_id for update;
 if not found or v_row.version<>p_expected_attempt_version or v_row.status<>'claimed'
  or v_row.previous_digest<>p_previous_digest or v_row.next_digest<>p_next_digest
  or v_row.query_digest<>p_query_digest then raise exception 'Supabase migration attempt changed';end if;
 update private.website_infrastructure_connections set status='ready',
  permissions=array['database:read','database:write','organizations:read','projects:read','secrets:read'],
  verified_at=clock_timestamp(),operation_id=null,version=version+1,last_commit_id=p_commit_id,
  updated_at=clock_timestamp()where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
  and provider='supabase'and environment=v_row.environment and version=v_row.connection_version
  and target_id=v_row.project_ref returning version into v_connection;
 if v_connection is null then raise exception 'Supabase connection changed';end if;
 update private.website_supabase_oauth_custody set connection_version=v_connection,updated_at=clock_timestamp()
  where connection_id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
   and connection_version=v_row.connection_version and project_ref=v_row.project_ref
   and custody_expires_at>clock_timestamp();
 if not found then raise exception 'Supabase custody changed';end if;
 v_attempt:=v_row.version+1;
 update private.website_supabase_migration_attempts set status='ready',connection_version=v_connection,
  last_commit_id=p_commit_id,version=v_attempt,verified_at=clock_timestamp(),updated_at=clock_timestamp()
  where connection_id=p_connection_id;
 return jsonb_build_object('attemptVersion',v_attempt,'connectionVersion',v_connection);
end $$;
revoke all on function public.website_commit_supabase_migration(uuid,uuid,uuid,bigint,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.website_commit_supabase_migration(uuid,uuid,uuid,bigint,uuid,text,text,text,uuid) to service_role;

create function public.website_reconcile_supabase_migration(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,
 p_operation_id uuid,p_previous_digest text,p_next_digest text,p_query_digest text,p_commit_id uuid
)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('attemptVersion',m.version,'connectionVersion',m.connection_version)
 from private.website_supabase_migration_attempts m join public.projects p on p.id=m.project_id
 join private.website_infrastructure_connections c on c.id=m.connection_id
 where m.connection_id=p_connection_id and m.project_id=p_project_id and m.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder'and p.deleted_at is null
  and m.version=p_expected_attempt_version+1 and m.operation_id=p_operation_id and m.status='ready'
  and m.previous_digest=p_previous_digest and m.next_digest=p_next_digest and m.query_digest=p_query_digest
  and m.last_commit_id=p_commit_id and c.version=m.connection_version and c.status='ready';
$$;
revoke all on function public.website_reconcile_supabase_migration(uuid,uuid,uuid,bigint,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.website_reconcile_supabase_migration(uuid,uuid,uuid,bigint,uuid,text,text,text,uuid) to service_role;

create function public.website_supabase_migration_for_worker(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid
)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',m.version,'status',m.status,'operationId',m.operation_id,
  'connectionVersion',m.connection_version,'projectRef',m.project_ref,
  'previousDigest',m.previous_digest,'nextDigest',m.next_digest,'queryDigest',m.query_digest)
 from private.website_supabase_migration_attempts m join public.projects p on p.id=m.project_id
 where m.connection_id=p_connection_id and m.project_id=p_project_id and m.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder'and p.deleted_at is null;
$$;
revoke all on function public.website_supabase_migration_for_worker(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_supabase_migration_for_worker(uuid,uuid,uuid) to service_role;
