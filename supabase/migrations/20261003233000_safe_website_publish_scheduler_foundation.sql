-- Snapshot-bound scheduled publishing foundation.
-- This deliberately does NOT re-enable scheduling. The existing safety guard
-- and website_publish_scheduler_ready()=false remain authoritative until the
-- rollback-safe worker and cron secret are activated in a separate step.

alter table public.website_publish_schedules
  add column if not exists release_storage_prefix text,
  add column if not exists release_manifest jsonb not null default '[]'::jsonb,
  add column if not exists editor_fingerprint text,
  add column if not exists expected_project_updated_at timestamptz,
  add column if not exists published_url text,
  add column if not exists form_definitions jsonb not null default '[]'::jsonb,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

alter table public.website_publish_schedules
  drop constraint if exists website_publish_schedules_release_prefix_length,
  drop constraint if exists website_publish_schedules_release_manifest_array,
  drop constraint if exists website_publish_schedules_editor_fingerprint_length,
  drop constraint if exists website_publish_schedules_published_url_length,
  drop constraint if exists website_publish_schedules_form_definitions_array,
  drop constraint if exists website_publish_schedules_attempt_count;

alter table public.website_publish_schedules
  add constraint website_publish_schedules_release_prefix_length
    check (release_storage_prefix is null or char_length(release_storage_prefix) between 1 and 700),
  add constraint website_publish_schedules_release_manifest_array
    check (jsonb_typeof(release_manifest)='array' and jsonb_array_length(release_manifest)<=250),
  add constraint website_publish_schedules_editor_fingerprint_length
    check (editor_fingerprint is null or char_length(editor_fingerprint) between 1 and 2000000),
  add constraint website_publish_schedules_published_url_length
    check (published_url is null or char_length(published_url) between 8 and 2048),
  add constraint website_publish_schedules_form_definitions_array
    check (
      jsonb_typeof(form_definitions)='array'
      and jsonb_array_length(form_definitions)<=100
      and octet_length(form_definitions::text)<=1048576
    ),
  add constraint website_publish_schedules_attempt_count
    check (attempt_count between 0 and 10);

create or replace function public.validate_snapshot_bound_website_publish_schedule()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status in ('scheduled','processing','published') then
    if new.environment<>'production' or new.mode<>'full'
      or new.release_storage_prefix is null
      or new.release_storage_prefix <> (
        new.user_id::text || '/' || new.project_id::text || '/versions/' || new.id::text
      )
      or jsonb_typeof(new.release_manifest)<>'array'
      or jsonb_array_length(new.release_manifest)<1
      or jsonb_array_length(new.release_manifest)>250
      or not exists (
        select 1
        from jsonb_array_elements(new.release_manifest) item
        where item->>'name'='index.html'
          and jsonb_typeof(item->'contentType')='string'
      )
      or new.editor_fingerprint is null
      or new.expected_project_updated_at is null
      or new.published_url is null
      or new.published_url !~ '^https://'
      or position(chr(10) in new.published_url)>0
      or position(chr(13) in new.published_url)>0
      or jsonb_typeof(new.form_definitions)<>'array'
      or jsonb_array_length(new.form_definitions)>100 then
      raise exception 'Scheduled release is not bound to a valid immutable snapshot';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_snapshot_bound_website_publish_schedule() from public,anon,authenticated;

drop trigger if exists website_publish_schedule_snapshot_guard on public.website_publish_schedules;
create trigger website_publish_schedule_snapshot_guard
before insert or update on public.website_publish_schedules
for each row execute function public.validate_snapshot_bound_website_publish_schedule();

create or replace function public.website_claim_due_publish_schedule()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_schedule public.website_publish_schedules%rowtype;
begin
  -- Due releases become permanently failed if the editable project moved after
  -- the immutable snapshot was bound. Never publish stale content over newer edits.
  update public.website_publish_schedules s
  set status='failed',
      last_error='Scheduled release is stale because the project changed after scheduling.',
      updated_at=clock_timestamp()
  where s.status='scheduled'
    and s.scheduled_at<=clock_timestamp()
    and exists (
      select 1 from public.projects p
      where p.id=s.project_id
        and (
          p.user_id is distinct from s.user_id
          or p.type<>'website-builder'
          or p.deleted_at is not null
          or p.updated_at is distinct from s.expected_project_updated_at
        )
    );

  select s.id into v_id
  from public.website_publish_schedules s
  join public.projects p on p.id=s.project_id
  where s.status='scheduled'
    and s.scheduled_at<=clock_timestamp()
    and s.environment='production'
    and s.mode='full'
    and p.user_id=s.user_id
    and p.type='website-builder'
    and p.deleted_at is null
    and p.updated_at is not distinct from s.expected_project_updated_at
  order by s.scheduled_at,s.created_at,s.id
  for update of s skip locked
  limit 1;

  if v_id is null then return null; end if;

  update public.website_publish_schedules
  set status='processing',
      claimed_at=clock_timestamp(),
      attempt_count=attempt_count+1,
      last_error=null,
      updated_at=clock_timestamp()
  where id=v_id and status='scheduled'
  returning * into v_schedule;

  if v_schedule.id is null then return null; end if;
  return to_jsonb(v_schedule);
end;
$$;

revoke all on function public.website_claim_due_publish_schedule() from public,anon,authenticated;
grant execute on function public.website_claim_due_publish_schedule() to service_role;

create or replace function public.website_complete_publish_schedule(
  p_schedule_id uuid,
  p_published_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_schedule public.website_publish_schedules%rowtype;
  v_content jsonb;
  v_revision timestamptz;
  v_timestamp text;
begin
  if p_schedule_id is null or p_published_at is null then
    raise exception 'Scheduled release completion is invalid';
  end if;

  select * into v_schedule
  from public.website_publish_schedules
  where id=p_schedule_id and status='processing'
  for update;

  if v_schedule.id is null then return false; end if;

  select p.content,p.updated_at
    into v_content,v_revision
  from public.projects p
  where p.id=v_schedule.project_id
    and p.user_id=v_schedule.user_id
    and p.type='website-builder'
    and p.deleted_at is null
  for update;

  if v_content is null or v_revision is distinct from v_schedule.expected_project_updated_at then
    raise exception 'Scheduled release project revision changed';
  end if;

  v_timestamp:=to_char(p_published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_content:=jsonb_set(v_content,'{publishedUrl}',to_jsonb(v_schedule.published_url),true);
  v_content:=jsonb_set(v_content,'{publishedAt}',to_jsonb(v_timestamp),true);
  v_content:=jsonb_set(v_content,'{lastPublishedVersionId}',to_jsonb(v_schedule.id::text),true);
  v_content:=jsonb_set(v_content,'{lastPublishedFingerprint}',to_jsonb(v_schedule.editor_fingerprint),true);
  v_content:=jsonb_set(v_content,'{updatedAt}',to_jsonb(v_timestamp),true);

  update public.projects
  set content=v_content,status='completed',updated_at=p_published_at
  where id=v_schedule.project_id
    and user_id=v_schedule.user_id
    and type='website-builder'
    and deleted_at is null
    and updated_at is not distinct from v_schedule.expected_project_updated_at;

  if not found then raise exception 'Scheduled release project commit lost its revision'; end if;

  insert into public.website_publish_versions(
    id,project_id,user_id,release_note,published_url,storage_prefix,
    editor_fingerprint,snapshot,file_manifest,created_at
  ) values (
    v_schedule.id,v_schedule.project_id,v_schedule.user_id,v_schedule.release_note,
    v_schedule.published_url,v_schedule.release_storage_prefix,
    v_schedule.editor_fingerprint,v_content,v_schedule.release_manifest,p_published_at
  );

  update public.website_publish_schedules
  set status='published',completed_at=p_published_at,last_error=null,updated_at=p_published_at
  where id=v_schedule.id and status='processing';

  return found;
end;
$$;

revoke all on function public.website_complete_publish_schedule(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.website_complete_publish_schedule(uuid,timestamptz) to service_role;

create or replace function public.website_fail_publish_schedule(
  p_schedule_id uuid,
  p_error text
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_updated integer;
begin
  update public.website_publish_schedules
  set status='failed',
      last_error=left(coalesce(nullif(btrim(p_error),''),'Scheduled publish failed.'),1000),
      updated_at=clock_timestamp()
  where id=p_schedule_id and status='processing';
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

revoke all on function public.website_fail_publish_schedule(uuid,text) from public,anon,authenticated;
grant execute on function public.website_fail_publish_schedule(uuid,text) to service_role;
