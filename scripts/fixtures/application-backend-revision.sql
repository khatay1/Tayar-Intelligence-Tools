-- Run after installing revisionReadInfrastructure() statements inside a transaction on an isolated generated app; roll back afterward.
do $test$ begin
  if has_function_privilege('authenticated', 'public.app_deployed_definition()', 'EXECUTE')
    or has_function_privilege('anon', 'public.app_deployed_definition()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.app_deployed_definition()', 'EXECUTE') then
    raise exception 'Application revision RPC privileges are unsafe';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.app_deployed_definition()'::regprocedure) then
    raise exception 'Exposed application revision RPC must be invoker';
  end if;
end $test$;
set local role authenticated;
do $test$ begin
  begin
    perform public.app_deployed_definition();
    raise exception 'Authenticated browser read deployment revision';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
set local role service_role;
do $test$ begin
  if jsonb_array_length(public.app_deployed_definition()->'tables') < 1 then
    raise exception 'Trusted server cannot read the deployed app definition';
  end if;
end $test$;
reset role;
