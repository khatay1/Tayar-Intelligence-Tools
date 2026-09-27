-- Rollback-only fixture: atomic metadata+activation and optimistic whole-project guard.
update public.projects set content='{"application":{"version":1},"title":"saved"}',deleted_at=null where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
select public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}','sb_secret_private_commit_fixture');
reset role;
insert into storage.objects(bucket_id,name) values
('website-application-releases','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/versions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/index.html'),
('website-application-releases','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/versions/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/index.html');
insert into storage.objects(bucket_id,name) values ('website-application-releases','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/versions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/لوحة.html');
do $test$ begin
  if has_function_privilege('authenticated','public.website_commit_application_release(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,text)','EXECUTE') then raise exception 'Browser may commit private release'; end if;
end $test$;
set local role service_role;
do $test$ declare
  project uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  owner_id uuid := '11111111-1111-4111-8111-111111111111';
  version_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  snapshot jsonb := '{"application":{"version":1},"title":"saved"}';
  backend jsonb := '{"url":"https://sgewokeojtzsqjaeluan.supabase.co","projectRef":"sgewokeojtzsqjaeluan","publishableKey":"sb_publishable_fixture"}';
  manifest jsonb := '[{"name":"index.html","contentType":"text/html","pageId":"home"}]';
begin
  begin
    perform public.website_commit_application_release(project,owner_id,version_id,'{"application":{"version":1},"title":"old"}',backend,manifest,'https://tayar.se/site/test/','');
    raise exception 'Stale non-schema draft accepted';
  exception when raise_exception then if sqlerrm <> 'Saved project changed before release' then raise; end if; end;
  begin
    perform public.website_commit_application_release(project,'22222222-2222-4222-8222-222222222222',version_id,snapshot,backend,manifest,'https://tayar.se/site/test/','');
    raise exception 'Wrong owner committed';
  exception when raise_exception then if sqlerrm <> 'Saved project changed before release' then raise; end if; end;
  begin
    perform public.website_commit_application_release(project,owner_id,version_id,snapshot,backend,manifest || '[{"name":"missing.html","pageId":"home","contentType":"text/html"}]','https://tayar.se/site/test/','');
    raise exception 'Missing file accepted';
  exception when raise_exception then if sqlerrm <> 'Private application files are incomplete' then raise; end if; end;
  if public.website_commit_application_release(project,owner_id,version_id,snapshot,backend,manifest || '[{"name":"لوحة.html","contentType":"text/html","pageId":"home"}]','https://tayar.se/site/test/','') <> version_id then raise exception 'Commit returned wrong version'; end if;
  if public.website_application_published_release(project,owner_id)->'release'->>'id' <> version_id::text then raise exception 'Commit did not activate'; end if;
  begin
    perform public.website_commit_application_release(project,owner_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',snapshot,backend || '{"publishableKey":"wrong"}',manifest,'https://tayar.se/site/test/','');
    raise exception 'Wrong backend committed';
  exception when raise_exception then if sqlerrm <> 'Application release does not match the verified backend' then raise; end if; end;
  if public.website_application_published_release(project,owner_id)->'release'->>'id' <> version_id::text then raise exception 'Failed commit changed live version'; end if;
end $test$;
reset role;
do $test$ begin
  if exists(select 1 from public.website_publish_versions where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'Failed activation left a version row'; end if;
end $test$;
-- A legacy public copy blocks committing another private release.
insert into storage.objects(bucket_id,name) values ('published-sites','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/staging/index.html');
set local role service_role;
do $test$ begin
  begin
    perform public.website_commit_application_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '{"application":{"version":1},"title":"saved"}',
      '{"url":"https://sgewokeojtzsqjaeluan.supabase.co","projectRef":"sgewokeojtzsqjaeluan","publishableKey":"sb_publishable_fixture"}',
      '[{"name":"index.html","contentType":"text/html","pageId":"home"}]','https://tayar.se/site/test/','');
    raise exception 'Public copy transition allowed';
  exception when raise_exception then if sqlerrm <> 'Public application copies require migration' then raise; end if; end;
end $test$;
reset role;
-- Old browser publishing must not recreate a public copy after private activation.
create policy test_legacy_public_writes on storage.objects for all to authenticated using (true) with check (true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $test$ begin
  if private.website_public_release_write_allowed('11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/index.html') then raise exception 'Private application permits public writes'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('published-sites','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/index.html');
    raise exception 'Old publisher recreated public page';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $test$ begin
  if not private.website_public_release_write_allowed('22222222-2222-4222-8222-222222222222/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/index.html') then raise exception 'Ordinary static publisher denied'; end if;
  insert into storage.objects(bucket_id,name) values ('published-sites','22222222-2222-4222-8222-222222222222/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/index.html');
end $test$;
reset role;
set local role service_role;
do $test$ begin
  if public.website_application_release_outcome('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is distinct from 'selected' then raise exception 'Lost response cannot resolve selected release'; end if;
  if public.website_application_release_outcome('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is distinct from 'unresolved' then raise exception 'Failed commit reported as recorded'; end if;
  if public.website_application_release_outcome('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null then raise exception 'Foreign owner obtained release outcome'; end if;
  perform public.website_activate_application_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111',null);
  if public.website_application_release_outcome('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is distinct from 'recorded' then raise exception 'Unpublished release not retained'; end if;
end $test$;
reset role;
do $test$ begin
  if has_function_privilege('authenticated','public.website_application_release_outcome(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.website_application_release_outcome(uuid,uuid,uuid)','EXECUTE') then raise exception 'Browser may inspect private release outcome'; end if;
end $test$;
