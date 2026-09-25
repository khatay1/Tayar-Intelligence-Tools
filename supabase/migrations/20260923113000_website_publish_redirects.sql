create table if not exists public.website_publish_redirects (
  id text primary key,
  project_id uuid not null references public.website_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_path text not null,
  target text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id, source_path)
);

alter table public.website_publish_redirects enable row level security;

drop policy if exists "website_publish_redirects_select_own" on public.website_publish_redirects;
create policy "website_publish_redirects_select_own"
  on public.website_publish_redirects for select
  using (auth.uid() = user_id);

drop policy if exists "website_publish_redirects_insert_own" on public.website_publish_redirects;
create policy "website_publish_redirects_insert_own"
  on public.website_publish_redirects for insert
  with check (auth.uid() = user_id);

drop policy if exists "website_publish_redirects_update_own" on public.website_publish_redirects;
create policy "website_publish_redirects_update_own"
  on public.website_publish_redirects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "website_publish_redirects_delete_own" on public.website_publish_redirects;
create policy "website_publish_redirects_delete_own"
  on public.website_publish_redirects for delete
  using (auth.uid() = user_id);

create index if not exists website_publish_redirects_project_owner_idx
  on public.website_publish_redirects(project_id, user_id);
