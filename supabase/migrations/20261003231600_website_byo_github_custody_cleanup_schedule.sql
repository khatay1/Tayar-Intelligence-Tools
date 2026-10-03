-- Extend the existing platform-custody cleanup job after GitHub OAuth
-- custody exists. Read paths still enforce expiry when pg_cron is unavailable.
do $$
declare v_jobid bigint;
begin
  if to_regnamespace('cron') is null
    or to_regprocedure('public.website_cleanup_expired_connection_handoffs()') is null
    or to_regprocedure('public.website_cleanup_expired_supabase_oauth_custody()') is null
    or to_regprocedure('public.website_cleanup_expired_github_oauth_custody()') is null then
    raise notice 'Skipping GitHub custody cleanup schedule: prerequisites unavailable.';
    return;
  end if;
  select jobid into v_jobid from cron.job where jobname='website-byo-custody-cleanup' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'website-byo-custody-cleanup',
    '*/15 * * * *',
    'select public.website_cleanup_expired_connection_handoffs(), public.website_cleanup_expired_supabase_oauth_custody(), public.website_cleanup_expired_github_oauth_custody()'
  );
end $$;
