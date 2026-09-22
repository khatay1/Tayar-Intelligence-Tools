-- Forms + Automations MAX: immutable published form definitions, private uploads,
-- and owner-visible delivery history. Public writes are handled only by the
-- website-form-submit Edge Function using the service role after validation.

alter table public.website_leads
  add column if not exists form_id text,
  add column if not exists form_name text,
  add column if not exists files jsonb not null default '[]'::jsonb,
  add column if not exists workflow_status text not null default 'completed';

alter table public.website_leads
  drop constraint if exists website_leads_workflow_status_check;
alter table public.website_leads
  add constraint website_leads_workflow_status_check
  check (workflow_status in ('pending', 'processing', 'completed', 'partial', 'failed'));

create index if not exists website_leads_project_form_created_idx
  on public.website_leads (project_id, form_id, created_at desc);

create table if not exists public.website_forms (
  project_id uuid not null references public.projects(id) on delete cascade,
  form_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  page_id text not null,
  page_path text not null default '',
  definition jsonb not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, form_id),
  constraint website_forms_id_length check (char_length(form_id) between 1 and 120),
  constraint website_forms_definition_object check (jsonb_typeof(definition) = 'object')
);

alter table public.website_forms enable row level security;
create index if not exists website_forms_user_updated_idx on public.website_forms (user_id, updated_at desc);
revoke all on public.website_forms from anon;
grant select, insert, update, delete on public.website_forms to authenticated;

drop policy if exists website_forms_owner_select on public.website_forms;
create policy website_forms_owner_select on public.website_forms for select to authenticated
  using (public.website_project_team_role(project_id) in ('owner', 'admin', 'editor'));
drop policy if exists website_forms_owner_insert on public.website_forms;
create policy website_forms_owner_insert on public.website_forms for insert to authenticated
  with check ((select auth.uid()) = user_id and public.website_project_team_role(project_id) = 'owner');
drop policy if exists website_forms_owner_update on public.website_forms;
create policy website_forms_owner_update on public.website_forms for update to authenticated
  using ((select auth.uid()) = user_id and public.website_project_team_role(project_id) = 'owner')
  with check ((select auth.uid()) = user_id and public.website_project_team_role(project_id) = 'owner');
drop policy if exists website_forms_owner_delete on public.website_forms;
create policy website_forms_owner_delete on public.website_forms for delete to authenticated
  using ((select auth.uid()) = user_id and public.website_project_team_role(project_id) = 'owner');

create table if not exists public.website_form_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  lead_id uuid not null references public.website_leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  automation_id text not null,
  action_type text not null check (action_type in ('email', 'webhook')),
  destination_hint text not null default '',
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text,
  response_status integer,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_form_deliveries_project_created_idx
  on public.website_form_deliveries (project_id, created_at desc);
create index if not exists website_form_deliveries_lead_idx on public.website_form_deliveries (lead_id);
create index if not exists website_form_deliveries_user_created_idx on public.website_form_deliveries (user_id, created_at desc);
create index if not exists website_form_deliveries_pending_idx
  on public.website_form_deliveries (status, created_at) where status in ('pending', 'failed');

alter table public.website_form_deliveries enable row level security;
revoke all on public.website_form_deliveries from anon, authenticated;
grant select on public.website_form_deliveries to authenticated;
drop policy if exists website_form_deliveries_team_select on public.website_form_deliveries;
create policy website_form_deliveries_team_select on public.website_form_deliveries for select to authenticated
  using (public.website_project_team_role(project_id) in ('owner', 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-form-uploads',
  'website-form-uploads',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists website_form_uploads_owner_select on storage.objects;
create policy website_form_uploads_owner_select on storage.objects for select to authenticated
using (
  bucket_id = 'website-form-uploads'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.website_project_team_role(((storage.foldername(name))[1])::uuid) in ('owner', 'admin')
    else false
  end
);

drop policy if exists website_form_uploads_owner_delete on storage.objects;
create policy website_form_uploads_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'website-form-uploads'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.website_project_team_role(((storage.foldername(name))[1])::uuid) in ('owner', 'admin')
    else false
  end
);

comment on table public.website_forms is 'Published, server-trusted form definitions used by website-form-submit.';
comment on table public.website_form_deliveries is 'Auditable email/webhook attempts for website submissions.';

grant execute on function public.enforce_website_public_rate_limit(uuid, text, integer, integer, text) to service_role;
grant execute on function public.website_public_ingestion_limit(uuid, text) to service_role;
