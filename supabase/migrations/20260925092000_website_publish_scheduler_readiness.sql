-- An authenticated, read-only readiness check for scheduled releases.
-- Keep scheduling disabled until the cron job and secret actually exist.
create or replace function public.website_publish_scheduler_ready()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active boolean := false;
begin
  if to_regclass('cron.job') is null then return false; end if;
  if to_regclass('net.http_request_queue') is null then return false; end if;

  execute 'select exists(select 1 from cron.job where jobname = $1 and active)'
    into v_active using 'website-publish-scheduler';
  if not v_active then return false; end if;

  return exists (
    select 1 from vault.decrypted_secrets
    where name = 'website_publish_cron_secret'
      and nullif(btrim(decrypted_secret), '') is not null
  );
exception when undefined_table or invalid_schema_name or insufficient_privilege then
  return false;
end;
$$;

revoke all on function public.website_publish_scheduler_ready() from public, anon;
grant execute on function public.website_publish_scheduler_ready() to authenticated, service_role;
