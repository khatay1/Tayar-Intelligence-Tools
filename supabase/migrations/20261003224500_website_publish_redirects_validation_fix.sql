-- Repair redirect validation for already-migrated environments without regex escaping ambiguity.
-- Invalid legacy rows are removed before the corrected constraints are installed.
delete from public.website_publish_redirects
where position(chr(10) in source_path)>0
   or position(chr(13) in source_path)>0
   or position(chr(10) in target)>0
   or position(chr(13) in target)>0
   or lower(ltrim(target)) like 'javascript:%';

alter table public.website_publish_redirects
  drop constraint if exists website_publish_redirects_source_path_check,
  drop constraint if exists website_publish_redirects_target_check;

alter table public.website_publish_redirects
  add constraint website_publish_redirects_source_path_check check (
    char_length(source_path) between 1 and 2048
    and left(source_path,1)='/'
    and position(chr(10) in source_path)=0
    and position(chr(13) in source_path)=0
  ),
  add constraint website_publish_redirects_target_check check (
    char_length(target) between 1 and 4096
    and position(chr(10) in target)=0
    and position(chr(13) in target)=0
    and lower(ltrim(target)) not like 'javascript:%'
  );

create or replace function public.website_replace_publish_redirects(
  p_project_id uuid,
  p_redirects jsonb
) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer;
begin
  if v_owner is null or p_project_id is null
    or p_redirects is null or jsonb_typeof(p_redirects)<>'array'
    or jsonb_array_length(p_redirects)>100 then
    raise exception 'Invalid redirect replacement';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id=p_project_id and p.user_id=v_owner
      and p.type='website-builder' and p.deleted_at is null
  ) then
    raise exception 'Project access denied';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_redirects) e(value)
    where jsonb_typeof(e.value)<>'object'
      or jsonb_typeof(e.value->'id')<>'string'
      or char_length(e.value->>'id') not between 1 and 128
      or jsonb_typeof(e.value->'from')<>'string'
      or char_length(e.value->>'from') not between 1 and 2048
      or left(e.value->>'from',1)<>'/'
      or position(chr(10) in (e.value->>'from'))>0
      or position(chr(13) in (e.value->>'from'))>0
      or jsonb_typeof(e.value->'to')<>'string'
      or char_length(e.value->>'to') not between 1 and 4096
      or position(chr(10) in (e.value->>'to'))>0
      or position(chr(13) in (e.value->>'to'))>0
      or lower(ltrim(e.value->>'to')) like 'javascript:%'
      or jsonb_typeof(e.value->'status')<>'number'
      or (e.value->>'status')::integer not in (301,302,307,308)
      or jsonb_typeof(e.value->'enabled')<>'boolean'
  ) then
    raise exception 'Invalid redirect entry';
  end if;

  delete from public.website_publish_redirects
  where project_id=p_project_id and user_id=v_owner;

  insert into public.website_publish_redirects(
    id,project_id,user_id,source_path,target,status_code,enabled
  )
  select
    e.value->>'id',
    p_project_id,
    v_owner,
    e.value->>'from',
    e.value->>'to',
    (e.value->>'status')::integer,
    (e.value->>'enabled')::boolean
  from jsonb_array_elements(p_redirects) e(value);

  get diagnostics v_count=row_count;
  return v_count;
end $$;

revoke all on function public.website_replace_publish_redirects(uuid,jsonb) from public,anon;
grant execute on function public.website_replace_publish_redirects(uuid,jsonb) to authenticated;
