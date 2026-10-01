-- Select the only customer Supabase target a trusted migration worker may use.
-- The browser supplies no connection, account, project-ref or attempt version.
create function public.website_supabase_migration_target(
 p_project_id uuid,p_owner_id uuid,p_environment text,p_operation_id uuid
)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'connectionId',c.id,'connectionVersion',c.version,'custodyVersion',s.version,
  'projectRef',c.target_id,'accountId',c.account_id,'organizationId',s.organization_id,
  'organizationSlug',s.organization_slug,'definition',p.content->'application',
  'attempt',case when m.connection_id is null then null else jsonb_build_object(
   'version',m.version,'status',m.status,'operationId',m.operation_id,
   'connectionVersion',m.connection_version,'previousDefinition',m.previous_definition,
   'nextDefinition',m.next_definition,'previousDigest',m.previous_digest,
   'nextDigest',m.next_digest,'queryDigest',m.query_digest,'statementCount',m.statement_count)end)
 from public.projects p
 join private.website_infrastructure_connections c on c.project_id=p.id
 join private.website_supabase_oauth_custody s on s.connection_id=c.id
 left join private.website_supabase_migration_attempts m on m.connection_id=c.id
 where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder'and p.deleted_at is null
  and jsonb_typeof(p.content->'application')='object'and p_operation_id is not null
  and p_environment in('preview','production')and c.owner_id=p_owner_id
  and c.provider='supabase'and c.environment=p_environment
  and c.status in('connected','setup-incomplete','outdated-schema','ready')
  and c.target_id~'^[a-z]{20}$'and c.verified_at is not null
  and 'database:read'=any(c.permissions)and 'database:write'=any(c.permissions)
  and s.project_id=p.id and s.owner_id=p_owner_id and s.environment=p_environment
  and s.connection_version=c.version and s.account_id=c.account_id and s.project_ref=c.target_id
  and s.access_expires_at>clock_timestamp()and s.custody_expires_at>clock_timestamp()
  and (m.connection_id is null or m.status='ready'or m.operation_id=p_operation_id)
  and not exists(select 1 from private.website_supabase_migration_attempts x
   where x.operation_id=p_operation_id and x.connection_id<>c.id);
$$;
revoke all on function public.website_supabase_migration_target(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.website_supabase_migration_target(uuid,uuid,text,uuid) to service_role;
