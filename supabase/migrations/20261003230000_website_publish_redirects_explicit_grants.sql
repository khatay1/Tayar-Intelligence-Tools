-- Make Publishing MAX redirects reachable through the Data API on projects
-- where automatic public-schema grants are disabled, while keeping anonymous
-- callers blocked and ownership enforced by RLS.

revoke all on table public.website_publish_redirects from public, anon;
grant select, insert, delete on table public.website_publish_redirects to authenticated;
grant select, insert, update, delete on table public.website_publish_redirects to service_role;
