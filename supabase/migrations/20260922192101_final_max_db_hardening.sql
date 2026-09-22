-- Final MAX database hardening: close an unnecessary RPC surface and remove
-- the concrete performance warnings introduced by Collaboration/Publishing MAX.

create index if not exists idx_website_project_comments_user_id
  on public.website_project_comments(user_id);
create index if not exists idx_website_project_comments_resolved_by
  on public.website_project_comments(resolved_by);
create index if not exists idx_website_project_presence_user_id
  on public.website_project_presence(user_id);
create index if not exists idx_website_publish_schedules_project_id
  on public.website_publish_schedules(project_id);

-- Trigger helpers are internal implementation details, not public RPCs.
revoke all on function public.enforce_website_publish_project_owner() from public, anon, authenticated;
grant execute on function public.enforce_website_publish_project_owner() to service_role;

-- Cache auth.uid() once per statement instead of re-evaluating it per row.
drop policy if exists "website_project_presence_self_insert" on public.website_project_presence;
create policy "website_project_presence_self_insert"
  on public.website_project_presence for insert to authenticated
  with check (user_id = (select auth.uid()) and public.website_project_team_role(project_id) is not null);

drop policy if exists "website_project_presence_self_update" on public.website_project_presence;
create policy "website_project_presence_self_update"
  on public.website_project_presence for update to authenticated
  using (user_id = (select auth.uid()) and public.website_project_team_role(project_id) is not null)
  with check (user_id = (select auth.uid()) and public.website_project_team_role(project_id) is not null);

drop policy if exists "website_project_presence_self_delete" on public.website_project_presence;
create policy "website_project_presence_self_delete"
  on public.website_project_presence for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users manage own website publish schedules" on public.website_publish_schedules;
create policy "Users manage own website publish schedules"
  on public.website_publish_schedules for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own website redirects" on public.website_redirects;
create policy "Users manage own website redirects"
  on public.website_redirects for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
