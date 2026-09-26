-- Run only in an isolated generated-app database after applying the booking fixture schema.
-- Every mutation, including test auth.users rows, is rolled back.
begin;
insert into auth.users (id,email) values
  ('11111111-1111-4111-8111-111111111111','owner@tayar-test.invalid'),
  ('22222222-2222-4222-8222-222222222222','manager@tayar-test.invalid'),
  ('33333333-3333-4333-8333-333333333333','stranger@tayar-test.invalid')
on conflict (id) do nothing;
insert into public.app_vehicles (id,owner_id,plate) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','ABC123')
on conflict (id) do nothing;
insert into public.app_bookings (id,owner_id,vehicle_id,note) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner booking'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','manager booking')
on conflict (id) do nothing;
insert into private.app_user_roles (user_id,role_id) values
  ('22222222-2222-4222-8222-222222222222','manager') on conflict do nothing;

do $test$ begin
 if to_regclass('public.projects') is not null then raise exception 'Platform tables leaked into generated app'; end if;
end $test$;
set local role anon;
do $test$ begin
 if (select count(*) from public.app_vehicles) <> 1 then raise exception 'Public inventory unavailable'; end if;
 begin perform 1 from public.app_bookings; raise exception 'Anonymous booking read allowed';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
do $test$ declare affected integer; begin
 if (select count(*) from public.app_bookings) <> 1 then raise exception 'Owner read incorrect'; end if;
 insert into public.app_bookings (vehicle_id,note) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner created');
 begin
  insert into public.app_bookings (owner_id,vehicle_id) values ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Owner spoof accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.app_bookings set owner_id='22222222-2222-4222-8222-222222222222' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  raise exception 'Owner reassignment accepted';
 exception when raise_exception then
  if sqlerrm <> 'Immutable application record identity' then raise; end if;
 end;
 update public.app_bookings set note='hacked' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 get diagnostics affected=row_count;
 if affected <> 0 then raise exception 'Owner changed another booking'; end if;
 delete from public.app_bookings where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 get diagnostics affected=row_count;
 if affected <> 0 then raise exception 'Owner bypassed role-only delete'; end if;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
do $test$ declare affected integer; begin
 if (select count(*) from public.app_bookings) <> 3 or not private.app_has_role('manager') then raise exception 'Manager read or role failed'; end if;
 insert into public.app_vehicles (plate) values ('XYZ999');
 delete from public.app_bookings where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 get diagnostics affected=row_count;
 if affected <> 1 then raise exception 'Manager delete failed'; end if;
 begin
  insert into public.app_vehicles (owner_id,plate) values ('11111111-1111-4111-8111-111111111111','SPOOF1');
  raise exception 'Manager owner spoof accepted';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
do $test$ declare affected integer; begin
 if (select count(*) from public.app_bookings) <> 0 or private.app_has_role('manager') then raise exception 'Stranger read or role bypass'; end if;
 update public.app_vehicles set plate='HACKED' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 get diagnostics affected=row_count;
 if affected <> 0 then raise exception 'Stranger wrote inventory'; end if;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}',true);
do $test$ begin
 if (select count(*) from public.app_bookings) <> 0 then raise exception 'Anonymous session read private rows'; end if;
 begin
  insert into public.app_bookings (vehicle_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Anonymous session wrote private rows';
 exception when insufficient_privilege then null; end;
end $test$;
rollback;
