-- Stage 1: create publication-only copies before closing legacy public URLs.
-- Original media stays in website-media under existing owner RLS.
create function public.can_read_website_media(p_path text)
returns boolean language sql stable security invoker set search_path=public
as $function$
  select case when (select auth.uid()) is null then false
    when split_part(p_path,'/',1)=(select auth.uid())::text then true
    else exists (
      select 1 from public.projects p where p.type='website-builder'
      and p.deleted_at is null and p.workspace_id is not null
      and p.user_id::text=split_part(p_path,'/',1)
      and public.website_project_team_role(p.id) in ('owner','admin','editor','viewer')
      and exists (
        select 1 from jsonb_path_query(p.content,'$.** ? (@.type() == "string")') s(value),
          lateral regexp_split_to_table(s.value #>> '{}','[[:space:]"''<>\\()]') t(token)
        where t.token='https://pnbllxdlskljcakyaylt.supabase.co/storage/v1/object/public/website-media/'||p_path
          or t.token='https://www.tayar.se/api/website-media?path='||replace(p_path,'/','%2F')
      )
    )
  end;
$function$;
revoke all on function public.can_read_website_media(text) from public,anon;
grant execute on function public.can_read_website_media(text) to authenticated,service_role;

create policy website_media_select_shared_project on storage.objects
for select to authenticated using
  (bucket_id='website-media' and public.can_read_website_media(name));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('website-published-media','website-published-media',true,5242880,
  array['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy website_published_media_select_own on storage.objects
for select to authenticated using
  (bucket_id='website-published-media' and split_part(name,'/',1)=(select auth.uid())::text);
create policy website_published_media_insert_own on storage.objects
for insert to authenticated with check
  (bucket_id='website-published-media' and split_part(name,'/',1)=(select auth.uid())::text);
create policy website_published_media_update_own on storage.objects
for update to authenticated using
  (bucket_id='website-published-media' and split_part(name,'/',1)=(select auth.uid())::text)
with check
  (bucket_id='website-published-media' and split_part(name,'/',1)=(select auth.uid())::text);
create policy website_published_media_delete_own on storage.objects
for delete to authenticated using
  (bucket_id='website-published-media' and split_part(name,'/',1)=(select auth.uid())::text);
