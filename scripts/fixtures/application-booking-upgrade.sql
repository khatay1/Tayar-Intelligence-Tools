-- Run only after the additive booking validation migration in an isolated app database.
-- Mutating role checks are rolled back; existing records must retain their values.
begin;
do $test$ begin
  if (select count(*) from public.app_bookings where status = 'pending') <> 2 then
    raise exception 'Existing bookings or backfill missing';
  end if;
  if (select count(*) from public.app_vehicles) <> 1 then
    raise exception 'Existing inventory missing';
  end if;
  if to_regclass('public.app_locations') is null then
    raise exception 'New relation missing';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'app_bookings' and cmd = 'DELETE') <> 0 then
    raise exception 'Revoked delete policy still active';
  end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}', true);
do $test$ begin
  if (select count(*) from public.app_bookings) <> 2 then
    raise exception 'Manager lost permitted read access';
  end if;
  begin
    delete from public.app_bookings where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'Manager retained removed delete permission';
  exception when insufficient_privilege then null;
  end;
end $test$;
rollback;
