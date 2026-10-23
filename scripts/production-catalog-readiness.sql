-- Read-only inventory. This is NOT a release gate and writes no schema/data.
with checks as (
  select 'production_scheduler_is_disabled'::text as check_id,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='website_publish_scheduler_ready'
        and pg_get_function_identity_arguments(p.oid)=''
        and p.prosecdef=false and p.prolang=(select oid from pg_language where lanname='sql')
        and pg_get_functiondef(p.oid) ilike '%select false%'
    ) as observed,
    'Keep false; old SQL would replace this disabled scheduler with cron/Vault logic.'::text as meaning
  union all
  select 'website_publish_redirects_table_exists',
    to_regclass('public.website_publish_redirects') is not null,
    'Missing feature if false; never blindly replay the redirect cleanup migration.'
  union all
  select 'owned_runtime_secret_stages_table_exists',
    to_regclass('private.website_runtime_secret_stages') is not null,
    'Service-only secret staging feature; not a baseline admin-sign-in requirement.'
  union all
  select 'website_custom_execution_quota_rule_present',
    exists(select 1 from public.tool_access_rules where tool_id='website-custom-execution'),
    'If false, quota/access rule is absent; do not activate this capability.'
  union all
  select 'website_custom_execution_plan_limit_present',
    exists(select 1 from public.tool_plan_limits where tool_id='website-custom-execution'),
    'If false, limits are absent; do not activate custom operations.'
  union all
  select 'website_publish_scheduler_function_exists',
    to_regprocedure('public.website_publish_scheduler_ready()') is not null,
    'Existence does not prove disabled behavior; inspect the first check too.'
  union all
  select 'website_builder_projects_exist',
    exists(select 1 from public.projects where deleted_at is null and type='website-builder'),
    'Presence of saved projects; content, owners, emails and secrets are never selected.'
)
select check_id, observed, meaning from checks order by check_id;
