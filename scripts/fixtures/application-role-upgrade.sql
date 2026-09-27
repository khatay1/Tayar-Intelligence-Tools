-- Run after upgrading the isolated booking fixture with the Staff role.
-- Role assignment and data writes are rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}', true);
do $test$ declare affected integer; begin
  update public.app_vehicles set color = 'blue' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User without Staff role wrote inventory'; end if;
  begin
    perform 1 from private.app_user_roles;
    raise exception 'Client can read private role assignments';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
insert into private.app_user_roles (user_id, role_id)
values ('33333333-3333-4333-8333-333333333333', 'staff');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}', true);
do $test$ declare affected integer; begin
  if not private.app_has_role('staff') or private.app_has_role('manager') then
    raise exception 'Staff role identity incorrect';
  end if;
  update public.app_vehicles set color = 'blue' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Staff cannot update permitted inventory'; end if;
  begin
    update public.app_vehicles set owner_id = '33333333-3333-4333-8333-333333333333'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'Staff changed record ownership';
  exception when raise_exception then
    if sqlerrm <> 'Immutable application record identity' then raise; end if;
  end;
end $test$;
rollback;
