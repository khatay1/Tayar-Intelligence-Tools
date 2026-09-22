-- Website Builder Publishing + Domains + Staging MAX
create table if not exists public.website_publish_schedules (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null check (environment in ('staging','production')),
  mode text not null check (mode in ('full','selective')),
  page_ids jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  release_note text not null default '' check (char_length(release_note) <= 500),
  status text not null default 'scheduled' check (status in ('scheduled','processing','published','failed','cancelled')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_publish_schedules_future_page_ids check (jsonb_typeof(page_ids) = 'array')
);

create index if not exists website_publish_schedules_owner_project_idx on public.website_publish_schedules(user_id, project_id, scheduled_at);
create index if not exists website_publish_schedules_due_idx on public.website_publish_schedules(status, scheduled_at) where status = 'scheduled';

alter table public.website_publish_schedules enable row level security;
drop policy if exists "Users manage own website publish schedules" on public.website_publish_schedules;
create policy "Users manage own website publish schedules" on public.website_publish_schedules
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.website_redirects (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_path text not null,
  target text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_redirects_source_nonempty check (char_length(trim(source_path)) > 0),
  constraint website_redirects_target_nonempty check (char_length(trim(target)) > 0),
  constraint website_redirects_no_javascript check (lower(trim(target)) not like 'javascript:%'),
  unique(project_id, source_path)
);

create index if not exists website_redirects_owner_project_idx on public.website_redirects(user_id, project_id);
alter table public.website_redirects enable row level security;
drop policy if exists "Users manage own website redirects" on public.website_redirects;
create policy "Users manage own website redirects" on public.website_redirects
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ownership is enforced again against projects so a forged project_id cannot be attached to another user's row.
create or replace function public.enforce_website_publish_project_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'Website publishing project ownership mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists website_publish_schedules_owner_guard on public.website_publish_schedules;
create trigger website_publish_schedules_owner_guard before insert or update on public.website_publish_schedules for each row execute function public.enforce_website_publish_project_owner();
drop trigger if exists website_redirects_owner_guard on public.website_redirects;
create trigger website_redirects_owner_guard before insert or update on public.website_redirects for each row execute function public.enforce_website_publish_project_owner();
