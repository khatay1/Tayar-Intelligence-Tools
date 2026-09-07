drop policy if exists admin_select_ai_usage on public.ai_usage;
drop policy if exists select_own_ai_usage on public.ai_usage;
create policy select_own_or_admin_ai_usage
on public.ai_usage for select to authenticated
using (((select auth.uid()) = user_id) or public.is_admin());

drop policy if exists admin_select_projects on public.projects;
drop policy if exists select_accessible_projects on public.projects;
create policy select_accessible_or_admin_projects
on public.projects for select to authenticated
using (
  public.is_admin()
  or user_id = (select auth.uid())
  or (workspace_id is not null and public.team_workspace_role(workspace_id) is not null)
);

drop policy if exists admin_select_subscriptions on public.subscriptions;
drop policy if exists select_own_subscriptions on public.subscriptions;
create policy select_own_or_admin_subscriptions
on public.subscriptions for select to authenticated
using (((select auth.uid()) = user_id) or public.is_admin());

drop policy if exists template_assets_admin_write on public.template_assets;
drop policy if exists template_assets_public_read on public.template_assets;
create policy template_assets_public_read
on public.template_assets for select to anon
using (status = 'ready' and is_public = true);
create policy template_assets_authenticated_read
on public.template_assets for select to authenticated
using ((status = 'ready' and is_public = true) or public.is_admin());
create policy template_assets_admin_insert
on public.template_assets for insert to authenticated
with check (public.is_admin());
create policy template_assets_admin_update
on public.template_assets for update to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy template_assets_admin_delete
on public.template_assets for delete to authenticated
using (public.is_admin());

drop policy if exists template_sources_admin_write on public.template_sources;
drop policy if exists template_sources_public_read on public.template_sources;
create policy template_sources_public_read
on public.template_sources for select to anon
using (active = true and can_redistribute = true);
create policy template_sources_authenticated_read
on public.template_sources for select to authenticated
using ((active = true and can_redistribute = true) or public.is_admin());
create policy template_sources_admin_insert
on public.template_sources for insert to authenticated
with check (public.is_admin());
create policy template_sources_admin_update
on public.template_sources for update to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy template_sources_admin_delete
on public.template_sources for delete to authenticated
using (public.is_admin());
