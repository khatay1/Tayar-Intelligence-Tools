-- Phase-zero advisor review: preserve all existing RLS and execution grants.
-- These referencing columns lack a covering index in the platform catalog.
-- Tables were 16–64 kB when reviewed; bounded waits protect active traffic.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create index if not exists app_backends_active_version_fk_idx on private.website_application_backends(active_version_id);
create index if not exists byo_publish_preview_operation_fk_idx on private.website_byo_publish_operations(preview_operation_id);
create index if not exists byo_runtime_supabase_connection_fk_idx on private.website_byo_runtime_bindings(supabase_connection_id);
create index if not exists byo_runtime_vercel_connection_fk_idx on private.website_byo_runtime_bindings(vercel_connection_id);
create index if not exists connection_handoffs_project_fk_idx on private.website_connection_handoffs(project_id);
create index if not exists connection_oauth_states_project_fk_idx on private.website_connection_oauth_states(project_id);
create index if not exists github_export_cursors_project_fk_idx on private.website_github_export_cursors(project_id);
create index if not exists supabase_migration_attempts_project_fk_idx on private.website_supabase_migration_attempts(project_id);
create index if not exists supabase_oauth_custody_project_fk_idx on private.website_supabase_oauth_custody(project_id);
create index if not exists vercel_deployment_attempts_project_fk_idx on private.website_vercel_deployment_attempts(project_id);
create index if not exists vercel_integration_custody_project_fk_idx on private.website_vercel_integration_custody(project_id);
create index if not exists vercel_promotions_preview_connection_fk_idx on private.website_vercel_promotions(preview_connection_id);
create index if not exists vercel_promotions_project_fk_idx on private.website_vercel_promotions(project_id);
create index if not exists vercel_environment_supabase_connection_fk_idx on private.website_vercel_runtime_environment_receipts(supabase_connection_id);
create index if not exists vercel_environment_vercel_connection_fk_idx on private.website_vercel_runtime_environment_receipts(vercel_connection_id);
create index if not exists vercel_secret_handoffs_project_fk_idx on private.website_vercel_secret_handoffs(project_id);

-- Do not downgrade a future working scheduler. Only the reviewed constant
-- readiness function needs no elevated privileges; ALTER preserves its ACL.
do $$
begin
  if not exists (
    select 1 from pg_proc
    where oid = 'public.website_publish_scheduler_ready()'::regprocedure
      and regexp_replace(prosrc, '\s+', '', 'g') in ('selectfalse', 'selectfalse;')
  ) then
    raise exception 'Scheduler readiness source changed; review before altering privileges';
  end if;
end;
$$;
alter function public.website_publish_scheduler_ready() security invoker;
commit;
