-- Make Publishing MAX redirects reachable through the Data API on projects
-- where automatic public-schema grants are disabled, while keeping anonymous
-- callers blocked and ownership enforced by RLS.

revoke all on table public.website_publish_redirects from public, anon, authenticated;
grant select, insert, delete on table public.website_publish_redirects to authenticated;
grant select, insert, update, delete on table public.website_publish_redirects to service_role;

create index if not exists website_publish_redirects_user_project_idx
  on public.website_publish_redirects(user_id,project_id);
