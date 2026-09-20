-- Review comments, live presence and secure collaboration for shared websites.

create table if not exists public.website_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  anchor jsonb not null default '{}'::jsonb check (jsonb_typeof(anchor) = 'object'),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_website_project_comments_project_created
  on public.website_project_comments(project_id, created_at desc);

alter table public.website_project_comments enable row level security;
revoke all on public.website_project_comments from public, anon, authenticated;
grant select on public.website_project_comments to authenticated;

drop policy if exists "website_project_comments_member_select" on public.website_project_comments;
create policy "website_project_comments_member_select"
  on public.website_project_comments for select to authenticated
  using (public.website_project_team_role(project_id) in ('owner', 'admin', 'editor', 'viewer'));

create or replace function public.list_website_project_comments(
  p_project_id uuid,
  p_include_resolved boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_role text; v_result jsonb;
begin
  v_role := public.website_project_team_role(p_project_id);
  if v_role is null then raise exception 'Project access denied'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'projectId', c.project_id,
    'userId', c.user_id,
    'authorName', coalesce(nullif(p.full_name, ''), 'Teammate'),
    'body', c.body,
    'anchor', c.anchor,
    'resolvedAt', c.resolved_at,
    'resolvedBy', c.resolved_by,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at
  ) order by c.created_at desc), '[]'::jsonb)
  into v_result
  from public.website_project_comments c
  left join public.profiles p on p.id = c.user_id
  where c.project_id = p_project_id
    and (p_include_resolved or c.resolved_at is null);
  return v_result;
end;
$$;

create or replace function public.create_website_project_comment(
  p_project_id uuid,
  p_body text,
  p_anchor jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.website_project_team_role(p_project_id) is null then raise exception 'Project access denied'; end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'Comment must contain 1 to 2000 characters'; end if;
  if jsonb_typeof(coalesce(p_anchor, '{}'::jsonb)) <> 'object' then raise exception 'Invalid comment anchor'; end if;

  insert into public.website_project_comments(project_id, user_id, body, anchor)
  values (p_project_id, auth.uid(), v_body, coalesce(p_anchor, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolve_website_project_comment(p_comment_id uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_project_id uuid; v_role text;
begin
  select project_id into v_project_id from public.website_project_comments where id = p_comment_id;
  if v_project_id is null then return; end if;
  v_role := public.website_project_team_role(v_project_id);
  if v_role is null or v_role not in ('owner', 'admin', 'editor') then raise exception 'Editor access required'; end if;
  update public.website_project_comments
  set resolved_at = case when p_resolved then now() else null end,
      resolved_by = case when p_resolved then auth.uid() else null end,
      updated_at = now()
  where id = p_comment_id;
end;
$$;

create or replace function public.delete_website_project_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_comment public.website_project_comments%rowtype; v_role text;
begin
  select * into v_comment from public.website_project_comments where id = p_comment_id;
  if v_comment.id is null then return; end if;
  v_role := public.website_project_team_role(v_comment.project_id);
  if auth.uid() is null or (v_comment.user_id <> auth.uid() and (v_role is null or v_role not in ('owner', 'admin'))) then
    raise exception 'Comment author or manager access required';
  end if;
  delete from public.website_project_comments where id = p_comment_id;
end;
$$;

revoke all on function public.list_website_project_comments(uuid, boolean) from public, anon;
revoke all on function public.create_website_project_comment(uuid, text, jsonb) from public, anon;
revoke all on function public.resolve_website_project_comment(uuid, boolean) from public, anon;
revoke all on function public.delete_website_project_comment(uuid) from public, anon;
grant execute on function public.list_website_project_comments(uuid, boolean) to authenticated;
grant execute on function public.create_website_project_comment(uuid, text, jsonb) to authenticated;
grant execute on function public.resolve_website_project_comment(uuid, boolean) to authenticated;
grant execute on function public.delete_website_project_comment(uuid) to authenticated;

create table if not exists public.website_project_presence (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Teammate' check (char_length(display_name) between 1 and 100),
  page_id text check (page_id is null or char_length(page_id) <= 160),
  selection jsonb not null default '{}'::jsonb check (jsonb_typeof(selection) = 'object'),
  last_seen_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_website_project_presence_recent
  on public.website_project_presence(project_id, last_seen_at desc);

alter table public.website_project_presence enable row level security;
revoke all on public.website_project_presence from public, anon, authenticated;
grant select, insert, update, delete on public.website_project_presence to authenticated;

drop policy if exists "website_project_presence_member_select" on public.website_project_presence;
create policy "website_project_presence_member_select"
  on public.website_project_presence for select to authenticated
  using (public.website_project_team_role(project_id) in ('owner', 'admin', 'editor', 'viewer'));
drop policy if exists "website_project_presence_self_insert" on public.website_project_presence;
create policy "website_project_presence_self_insert"
  on public.website_project_presence for insert to authenticated
  with check (user_id = auth.uid() and public.website_project_team_role(project_id) is not null);
drop policy if exists "website_project_presence_self_update" on public.website_project_presence;
create policy "website_project_presence_self_update"
  on public.website_project_presence for update to authenticated
  using (user_id = auth.uid() and public.website_project_team_role(project_id) is not null)
  with check (user_id = auth.uid() and public.website_project_team_role(project_id) is not null);
drop policy if exists "website_project_presence_self_delete" on public.website_project_presence;
create policy "website_project_presence_self_delete"
  on public.website_project_presence for delete to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'website_project_comments'
  ) then
    alter publication supabase_realtime add table public.website_project_comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'website_project_presence'
  ) then
    alter publication supabase_realtime add table public.website_project_presence;
  end if;
end $$;
