-- Platform-owned setup grants only; customer runtime secrets are never here.
-- Read paths enforce expiry even if pg_cron is not enabled. Do not install
-- this source migration on production without the owner's release approval.
do $$
begin
  if to_regnamespace('cron') is null
    or to_regprocedure('public.website_cleanup_expired_connection_handoffs()') is null
    or to_regprocedure('public.website_cleanup_expired_supabase_oauth_custody()') is null then
    raise notice 'Skipping BYO custody cleanup schedule: prerequisites unavailable.';
    return;
  end if;
  if exists (select 1 from cron.job where jobname='website-byo-custody-cleanup') then
    return;
  end if;
  perform cron.schedule(
    'website-byo-custody-cleanup',
    '*/15 * * * *',
    'select public.website_cleanup_expired_connection_handoffs(), public.website_cleanup_expired_supabase_oauth_custody()'
  );
end $$;
