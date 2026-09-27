-- Minimal projects/publish-version fixture and unreleased binding migration must be loaded first.
-- Run in an isolated transaction and rollback everything.
update public.projects set content = '{"application":{"version":1}}',deleted_at=null where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
select public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','sgewokeojtzsqjaeluan','sb_publishable_fixture','{"version":1}','sb_secret_private_release_fixture');
reset role;
insert into public.website_publish_versions(id,project_id,user_id,storage_prefix,storage_bucket,snapshot,file_manifest) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/versions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','website-application-releases','{"application":{"version":1}}','[]'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd/versions/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','published-sites','{"application":{"version":1}}','[]');
update public.website_publish_versions set application_backend = '{"url":"https://sgewokeojtzsqjaeluan.supabase.co","projectRef":"sgewokeojtzsqjaeluan","publishableKey":"sb_publishable_fixture"}';
do $test$ begin
  if has_function_privilege('authenticated','public.website_activate_application_release(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.website_application_published_release(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.website_application_release_credential(uuid,uuid)','EXECUTE') then raise exception 'Private release RPC permissions unsafe'; end if;
  if (select public from storage.buckets where id='website-application-releases') then raise exception 'Private application bucket is public'; end if;
end $test$;
set local role service_role;
do $test$ begin
  begin
    perform public.website_activate_application_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Public bucket release activated';
  exception when raise_exception then
    if sqlerrm <> 'Application release does not match the verified backend' then raise; end if;
  end;
  perform public.website_activate_application_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
end $test$;
reset role;
-- Draft changes must not replace or invalidate the immutable live definition.
update public.projects set content='{"application":{"version":2}}' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
do $test$ declare r jsonb; begin
  r := public.website_application_published_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111');
  if r->'release'->'snapshot'->'application' is distinct from '{"version":1}'::jsonb then raise exception 'Draft edit changed live release'; end if;
  if public.website_application_release_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is distinct from 'sb_secret_private_release_fixture' then raise exception 'Draft edit invalidated live credentials'; end if;
  if public.website_application_release_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is not null then raise exception 'Inactive version obtained live credential'; end if;
  if public.website_application_published_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222')->'release' is distinct from 'null'::jsonb then raise exception 'Wrong owner exposed release'; end if;
  perform public.website_activate_application_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111',null);
  r := public.website_application_published_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111');
  if r->>'enabled' <> 'true' or r->'release' is distinct from 'null'::jsonb then raise exception 'Unpublish must retain private routing without a public fallback'; end if;
end $test$;
reset role;

-- Verify storage isolation remains intact even with an unrelated permissive policy.
insert into storage.objects(bucket_id,name) values ('website-application-releases','fixture-private-page.html');
create policy test_application_broad_read on storage.objects for select to authenticated using (true);
set local role authenticated;
do $test$ begin
  if exists(select 1 from storage.objects where bucket_id='website-application-releases') then raise exception 'Browser listed private release objects'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('website-application-releases','browser-page.html');
    raise exception 'Browser wrote private release content';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;

-- Rebinding even the same schema cannot silently retarget immutable HTML.
update public.projects set content='{"application":{"version":1}}' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role service_role;
select public.website_activate_application_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.website_link_application_backend('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','abcdefghijklmnopqrst','sb_publishable_new_fixture','{"version":1}','sb_secret_new_backend_fixture');
do $test$ begin
  if public.website_application_published_release('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111')->'release' is distinct from 'null'::jsonb then raise exception 'Rebinding silently retargeted old HTML'; end if;
  if public.website_application_release_credential('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null then raise exception 'Old release obtained a different backend credential'; end if;
end $test$;
reset role;

-- Even a broad archive policy cannot grant client-side private release writes.
create policy test_application_broad_archive on public.website_publish_versions for all to authenticated using (true) with check (true);
set local role authenticated;
do $test$ declare affected integer; begin
  update public.website_publish_versions set file_manifest='[{"name":"tampered.html"}]' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Browser mutated private release'; end if;
  delete from public.website_publish_versions where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Browser deleted private release'; end if;
  begin
    insert into public.website_publish_versions(id,storage_bucket) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','website-application-releases');
    raise exception 'Browser inserted private release';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
