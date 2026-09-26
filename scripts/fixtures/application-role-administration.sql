-- Run only in an isolated generated-app database with the booking fixture and compiled role RPCs.
-- Privileged bootstrap, role assignments and record writes are rolled back.
begin;
set local role anon;
do $test$ begin
  begin
    perform public.app_bootstrap_role_admin('11111111-1111-4111-8111-111111111111');
    raise exception 'Anonymous caller bootstrapped an administrator';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ begin
  if public.app_is_role_admin() then raise exception 'Administrator exists before server bootstrap'; end if;
  begin
    perform public.app_set_user_role('33333333-3333-4333-8333-333333333333', 'staff', true);
    raise exception 'Ordinary user assigned a role';
  exception when raise_exception then
    if sqlerrm <> 'Application role administration denied' then raise; end if;
  end;
end $test$;
reset role;

set local role service_role;
select public.app_bootstrap_role_admin('11111111-1111-4111-8111-111111111111');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ begin
  if not public.app_is_role_admin() then raise exception 'Server bootstrap failed'; end if;
  perform public.app_set_user_role('33333333-3333-4333-8333-333333333333', 'staff', true);
  if (select count(*) from public.app_my_roles()) <> 0 then raise exception 'Other user role leaked'; end if;
  begin
    perform public.app_set_user_role('33333333-3333-4333-8333-333333333333', 'invented', true);
    raise exception 'Unknown role assigned';
  exception when raise_exception then
    if sqlerrm <> 'Unknown application role' then raise; end if;
  end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}', true);
do $test$ declare affected integer; begin
  if public.app_is_role_admin() or (select count(*) from public.app_my_roles()) <> 1 then
    raise exception 'Staff privilege or role visibility incorrect';
  end if;
  begin
    perform public.app_set_user_role('33333333-3333-4333-8333-333333333333', 'manager', true);
    raise exception 'Staff escalated own role';
  exception when raise_exception then
    if sqlerrm <> 'Application role administration denied' then raise; end if;
  end;
  update public.app_vehicles set color = 'blue' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Staff update did not use role policy'; end if;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}', true);
do $test$ begin
  if public.app_is_role_admin() or (select count(*) from public.app_my_roles()) <> 0 then
    raise exception 'Anonymous sign-in inherited administrator privileges';
  end if;
end $test$;
rollback;
