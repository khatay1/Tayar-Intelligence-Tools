-- Publishing MAX scheduled executor.
-- The cron call is only installed when pg_cron + pg_net are available and
-- WEBSITE_PUBLISH_CRON_SECRET has been stored in Vault as website_publish_cron_secret.
-- This keeps local/dev migrations safe and avoids embedding secrets in source.

do $$
declare
  v_secret text;
  v_existing bigint;
begin
  if to_regnamespace('cron') is null or to_regnamespace('net') is null then
    raise notice 'Skipping website publish scheduler: pg_cron/pg_net not enabled.';
    return;
  end if;

  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'website_publish_cron_secret'
    order by created_at desc
    limit 1;
  exception when undefined_table or invalid_schema_name then
    raise notice 'Skipping website publish scheduler: Vault is unavailable.';
    return;
  end;

  if coalesce(v_secret, '') = '' then
    raise notice 'Skipping website publish scheduler: create Vault secret website_publish_cron_secret first.';
    return;
  end if;

  select jobid into v_existing from cron.job where jobname = 'website-publish-scheduler' limit 1;
  if v_existing is not null then
    perform cron.unschedule(v_existing);
  end if;

  perform cron.schedule(
    'website-publish-scheduler',
    '* * * * *',
    format($cron$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
    $cron$,
      current_setting('app.settings.supabase_url', true) || '/functions/v1/website-publish-scheduler',
      v_secret
    )
  );
end $$;
