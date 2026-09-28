-- Run after compileApplicationFormRequestUpgrade(deployedDefinition) inside a
-- transaction on the isolated validation backend, then ROLLBACK. This fixture
-- inserts only temporary rows and requires two permanent test Auth users.
do $request_test$
declare
  owner_user uuid;
  other_user uuid;
  vehicle uuid;
  v_request_id uuid := gen_random_uuid();
  inserted_id uuid;
begin
  if public.app_form_request_revision() <> 2 then raise exception 'Missing durable request capability'; end if;
  if (select prosecdef from pg_proc where oid = 'public.app_form_request_revision()'::regprocedure)
    or not (select prosecdef from pg_proc where oid = 'private.app_form_request_revision()'::regprocedure)
    or has_function_privilege('anon', 'public.app_form_request_revision()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.app_form_request_revision()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.app_form_request_revision()', 'EXECUTE')
  then raise exception 'Unsafe request capability privilege'; end if;
  if (select count(*) from pg_attribute where attrelid in (
      'public.app_vehicles'::regclass, 'public.app_bookings'::regclass, 'public.app_locations'::regclass)
      and attname = '_tayar_request_id' and atttypid = 'uuid'::regtype and not attisdropped) <> 3
  then raise exception 'Request columns are missing'; end if;
  if (select count(*) from pg_trigger where tgrelid in (
      'public.app_vehicles'::regclass, 'public.app_bookings'::regclass, 'public.app_locations'::regclass)
      and tgname = 'app_guard_form_request' and not tgisinternal) <> 3
  then raise exception 'Request triggers are missing'; end if;
  if (select count(*) from pg_trigger where tgrelid in (
      'public.app_vehicles'::regclass, 'public.app_bookings'::regclass, 'public.app_locations'::regclass)
      and tgname = 'app_record_form_request' and not tgisinternal) <> 3
    or not (select prosecdef from pg_proc where oid = 'private.app_record_form_request()'::regprocedure)
    or has_table_privilege('authenticated', 'private.app_form_request_ledger', 'SELECT')
    or has_table_privilege('authenticated', 'private.app_form_request_ledger', 'INSERT')
  then raise exception 'Unsafe or missing private request ledger'; end if;

  select id into owner_user from auth.users where is_anonymous is not true order by id limit 1;
  select id into other_user from auth.users u where u.is_anonymous is not true and u.id <> owner_user
    and not exists (select 1 from private.app_user_roles r where r.user_id = u.id and r.role_id = 'manager') limit 1;
  select id into vehicle from public.app_vehicles limit 1;
  if owner_user is null or other_user is null or vehicle is null then raise exception 'Validation fixture unavailable'; end if;

  execute 'set local role anon';
  begin
    insert into public.app_bookings (vehicle_id, note, _tayar_request_id)
      values (vehicle, 'anonymous test', v_request_id);
    raise exception 'Anonymous insert succeeded';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', owner_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user, 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  insert into public.app_bookings (vehicle_id, note, _tayar_request_id)
    values (vehicle, 'rollback request test', v_request_id) returning id into inserted_id;
  begin
    insert into public.app_bookings (vehicle_id, note, _tayar_request_id)
      values (vehicle, 'duplicate request', v_request_id);
    raise exception 'Duplicate request inserted';
  exception when unique_violation then null; end;
  begin
    update public.app_bookings set _tayar_request_id = gen_random_uuid() where id = inserted_id;
    raise exception 'Request identity changed';
  exception when raise_exception then
    if sqlerrm <> 'Immutable application request identity' then raise; end if;
  end;
  if (select id from public.app_bookings where owner_id = owner_user and _tayar_request_id = v_request_id)
    is distinct from inserted_id then raise exception 'Owner reconciliation failed'; end if;

  perform set_config('request.jwt.claim.sub', other_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other_user, 'is_anonymous', false)::text, true);
  if exists (select 1 from public.app_bookings where id = inserted_id)
  then raise exception 'Another user read the owner row'; end if;
  execute 'reset role';
  if not exists (select 1 from private.app_form_request_ledger
      where owner_id = owner_user and table_name = 'app_bookings'
        and request_id = v_request_id and record_id = inserted_id)
  then raise exception 'Durable request identity missing'; end if;
  delete from public.app_bookings where id = inserted_id;
  perform set_config('request.jwt.claim.sub', owner_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_user, 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.app_bookings (vehicle_id, note, _tayar_request_id)
      values (vehicle, 'deleted request replay', v_request_id);
    raise exception 'Deleted request replay inserted';
  exception when unique_violation then null; end;
  execute 'reset role';
end $request_test$;
