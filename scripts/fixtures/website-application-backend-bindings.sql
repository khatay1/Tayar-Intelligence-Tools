-- Apply the binding migration after two disposable website projects in a transaction; roll back all changes.
do $test$ begin
  if has_function_privilege('authenticated', 'public.website_record_application_backend(uuid,text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.website_record_application_backend(uuid,text,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.website_record_application_backend(uuid,text,text,jsonb)', 'EXECUTE') then
    raise exception 'Backend registration RPC privileges are unsafe';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.website_application_backend_public(uuid)'::regprocedure) then
    raise exception 'Owner-facing backend RPC must be invoker';
  end if;
  if has_function_privilege('authenticated', 'public.website_application_backend_record(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.website_application_backend_record(uuid)', 'EXECUTE') then
    raise exception 'Server backend record RPC privileges are unsafe';
  end if;
end $test$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ begin
  begin
    perform public.website_record_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sgewokeojtzsqjaeluan', 'sb_publishable_fixture', '{"version":1}'::jsonb);
    raise exception 'Browser registered a backend';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;

set local role service_role;
do $test$ begin
  begin
    perform public.website_record_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sgewokeojtzsqjaeluan', 'sb_publishable_fixture', '{"version":2}'::jsonb);
    raise exception 'Stale application definition registered';
  exception when raise_exception then
    if sqlerrm <> 'Saved application definition does not match verified backend' then raise; end if;
  end;
  perform public.website_record_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sgewokeojtzsqjaeluan', 'sb_publishable_fixture', '{"version":1}'::jsonb);
  if public.website_application_backend_record('dddddddd-dddd-4ddd-8ddd-dddddddddddd')->>'projectRef' <> 'sgewokeojtzsqjaeluan' then
    raise exception 'Server could not inspect the project backend binding';
  end if;
  begin
    perform public.website_record_application_backend('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'sgewokeojtzsqjaeluan', 'sb_publishable_fixture', '{"version":1}'::jsonb);
    raise exception 'Two Tayar projects reused one dedicated backend';
  exception when unique_violation then null;
  end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ declare b jsonb; begin
  b := public.website_application_backend_public('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  if b->>'projectRef' <> 'sgewokeojtzsqjaeluan' or b->>'publishableKey' <> 'sb_publishable_fixture'
    or b ? 'serviceRoleKey' then raise exception 'Owner backend config is incorrect or private'; end if;
  begin
    perform public.website_application_backend_public('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    raise exception 'Cross-project backend configuration exposed';
  exception when raise_exception then
    if sqlerrm <> 'Project access denied' then raise; end if;
  end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}', true);
do $test$ begin
  begin
    perform public.website_application_backend_public('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    raise exception 'Anonymous application backend read';
  exception when raise_exception then
    if sqlerrm <> 'Project access denied' then raise; end if;
  end;
end $test$;
reset role;

update public.projects set content = '{"application":{"version":2}}'::jsonb where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ begin
  if public.website_application_backend_public('dddddddd-dddd-4ddd-8ddd-dddddddddddd') is not null then
    raise exception 'Stale backend remained available after an application edit';
  end if;
end $test$;
reset role;
