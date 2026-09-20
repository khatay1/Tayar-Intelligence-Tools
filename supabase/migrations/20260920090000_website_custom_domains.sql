create table if not exists public.website_custom_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hostname text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'misconfigured')),
  verification jsonb not null default '[]'::jsonb check (jsonb_typeof(verification) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_custom_domains_hostname_format check (
    hostname = lower(hostname)
    and length(hostname) between 4 and 253
    and hostname ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  )
);

create index if not exists website_custom_domains_user_id_idx on public.website_custom_domains(user_id);
alter table public.website_custom_domains enable row level security;

revoke all on table public.website_custom_domains from public, anon, authenticated;
grant select on table public.website_custom_domains to authenticated;
grant all on table public.website_custom_domains to service_role;

drop policy if exists website_custom_domains_select_own on public.website_custom_domains;
create policy website_custom_domains_select_own on public.website_custom_domains
for select to authenticated using ((select auth.uid()) = user_id);

-- Mutations intentionally have no authenticated grants or policies. The server API
-- owns domain lifecycle after checking the Supabase session and project ownership.
