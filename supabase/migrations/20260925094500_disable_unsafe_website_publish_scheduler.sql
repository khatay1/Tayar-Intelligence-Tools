-- The existing executor selects the latest preview rather than the release
-- chosen when scheduled, and removes live files before replacement succeeds.
-- Keep all clients from queuing an unfulfillable scheduled publish until a
-- snapshot-bound executor and its operational cron configuration are deployed.
create or replace function public.website_publish_scheduler_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select false $$;

revoke all on function public.website_publish_scheduler_ready() from public, anon;
grant execute on function public.website_publish_scheduler_ready() to authenticated, service_role;

create or replace function public.reject_unsafe_website_publish_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'scheduled' then
    raise exception 'Scheduled publishing is unavailable until the release executor is safe';
  end if;
  return new;
end;
$$;

drop trigger if exists website_publish_scheduler_safety_guard on public.website_publish_schedules;
create trigger website_publish_scheduler_safety_guard
before insert or update on public.website_publish_schedules
for each row execute function public.reject_unsafe_website_publish_schedule();
