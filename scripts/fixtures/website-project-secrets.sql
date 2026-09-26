-- Run inside an isolated transaction after creating a minimal public.projects fixture
-- and applying 20260926233000_website_project_secrets.sql. The caller rolls back.
do $test$ begin
  if has_function_privilege('authenticated', 'public.website_project_secret_value(uuid,text,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.website_project_secret_value(uuid,text,text,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.website_project_secret_value(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'Plaintext RPC privileges are unsafe';
  end if;
  if (select count(*) from pg_proc where oid in (
    'public.website_set_project_secret(uuid,text,text,text,text)'::regprocedure,
    'public.website_project_secret_refs(uuid)'::regprocedure,
    'public.website_delete_project_secret(uuid,text,text,text)'::regprocedure
  ) and prosecdef) <> 0 then raise exception 'Authenticated public RPC is security definer'; end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ declare secret_ref text; begin
  secret_ref := public.website_set_project_secret('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'stripe', 'secretKey', 'preview', 'fake_secret_one');
  if secret_ref <> 'secret://website/dddddddd-dddd-4ddd-8ddd-dddddddddddd/stripe/secretKey/preview' then
    raise exception 'Secret reference identity incorrect';
  end if;
  perform public.website_set_project_secret('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'stripe', 'secretKey', 'preview', 'fake_secret_two');
  perform public.website_set_project_secret('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'stripe', 'secretKey', 'production', 'fake_production_key');
  if (select count(*) from public.website_project_secret_refs('dddddddd-dddd-4ddd-8ddd-dddddddddddd')) <> 2 then
    raise exception 'Configured environments not listed';
  end if;
  begin
    perform public.website_project_secret_value('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'stripe', 'secretKey', 'preview');
    raise exception 'Owner read plaintext';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.website_set_project_secret('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'stripe', 'secretKey', 'preview', 'cross_project');
    raise exception 'Owner wrote another project';
  exception when raise_exception then
    if sqlerrm <> 'Project access denied' then raise; end if;
  end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}', true);
do $test$ begin
  begin
    perform public.website_project_secret_refs('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    raise exception 'Anonymous sign-in listed project secrets';
  exception when raise_exception then
    if sqlerrm <> 'Project access denied' then raise; end if;
  end;
end $test$;
reset role;

set local role service_role;
do $test$ begin
  if public.website_project_secret_value('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'stripe', 'secretKey', 'preview') <> 'fake_secret_two' then
    raise exception 'Server could not read rotated value';
  end if;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
do $test$ begin
  if not public.website_delete_project_secret('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'stripe', 'secretKey', 'production') then
    raise exception 'Owner could not delete production secret';
  end if;
  if (select count(*) from public.website_project_secret_refs('dddddddd-dddd-4ddd-8ddd-dddddddddddd')) <> 1 then
    raise exception 'Deleted secret still listed';
  end if;
end $test$;
reset role;
do $test$ begin
  if (select count(*) from vault.decrypted_secrets where name like 'website_project_dddddddd-dddd-4ddd-8ddd-dddddddddddd_%') <> 1 then
    raise exception 'Vault deletion did not remove secret';
  end if;
end $test$;
delete from public.projects where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $test$ begin
  if (select count(*) from vault.decrypted_secrets where name like 'website_project_dddddddd-dddd-4ddd-8ddd-dddddddddddd_%') <> 0 then
    raise exception 'Project deletion left a credential in Vault';
  end if;
end $test$;
