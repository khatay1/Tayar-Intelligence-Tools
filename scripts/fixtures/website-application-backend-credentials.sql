-- Run after the binding migration and the two disposable projects; always rollback.
do $test$ begin
  if has_function_privilege('authenticated','public.website_link_application_backend(uuid,uuid,text,text,jsonb,text)','EXECUTE')
    or has_function_privilege('anon','public.website_application_backend_credential(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.website_application_backend_credential(uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.website_application_backend_credential(uuid,text)','EXECUTE') then
    raise exception 'Backend credential privileges are unsafe';
  end if;
end $test$;
update public.projects set content = '{"application":{"version":1}}' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
do $test$ begin
  begin
    perform public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}','sb_secret_fixture_first');
    raise exception 'Wrong owner linked a backend';
  exception when raise_exception then
    if sqlerrm <> 'Project access denied' then raise; end if;
  end;
  perform public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}','sb_secret_fixture_first');
  if public.website_application_backend_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sgewokeojtzsqjaeluan') is distinct from 'sb_secret_fixture_first' then raise exception 'Credential not stored'; end if;
  if public.website_application_backend_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','abcdefghijklmnopqrst') is not null then raise exception 'Foreign backend credential exposed'; end if;
  begin
    perform public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":2}','sb_secret_fixture_rotated');
    raise exception 'Stale schema rotated credential';
  exception when raise_exception then
    if sqlerrm <> 'Saved application definition does not match verified backend' then raise; end if;
  end;
  if public.website_application_backend_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sgewokeojtzsqjaeluan') is distinct from 'sb_secret_fixture_first' then raise exception 'Failed transaction lost old credential'; end if;
  perform public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}','sb_secret_fixture_rotated');
  if public.website_application_backend_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sgewokeojtzsqjaeluan') is distinct from 'sb_secret_fixture_rotated' then raise exception 'Credential rotation failed'; end if;
end $test$;
reset role;
do $test$ begin
  if (select count(*) from vault.secrets where name = 'website_backend_dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 1 then raise exception 'Orphaned Vault credential after rotation'; end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
do $test$ declare b jsonb; begin
  b := public.website_application_backend_public('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  if b::text like '%sb_secret%' or b ? 'service_secret_id' then raise exception 'Credential exposed in owner metadata'; end if;
  begin
    perform public.website_application_backend_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sgewokeojtzsqjaeluan');
    raise exception 'Browser read backend secret';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
update public.projects set deleted_at = now() where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
do $test$ begin
  if public.website_application_backend_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sgewokeojtzsqjaeluan') is not null then raise exception 'Deleted project credential is available'; end if;
end $test$;
reset role;
update public.projects set deleted_at = null where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
select public.website_record_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}');
reset role;
do $test$ begin
  if exists(select 1 from vault.secrets where name = 'website_backend_dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Rebinding retained unverified old credentials'; end if;
end $test$;
set local role service_role;
select public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}','sb_secret_fixture_last');
reset role;
delete from public.projects where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $test$ begin
  if exists(select 1 from vault.secrets where name = 'website_backend_dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Project deletion orphaned backend credential'; end if;
end $test$;
