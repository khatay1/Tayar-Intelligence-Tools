drop index if exists public.idx_project_items_project;
drop index if exists public.idx_project_items_user;
drop index if exists public.idx_projects_parent;
drop index if exists public.idx_support_tickets_user;

create index if not exists idx_account_blocks_blocked_by on public.account_blocks(blocked_by);
create index if not exists idx_admin_access_overrides_granted_by on public.admin_access_overrides(granted_by);
create index if not exists idx_team_workspace_invites_invited_by on public.team_workspace_invites(invited_by);
create index if not exists idx_template_import_runs_requested_by on public.template_import_runs(requested_by);
create index if not exists idx_tool_access_rules_updated_by on public.tool_access_rules(updated_by);
create index if not exists idx_tool_plan_limits_updated_by on public.tool_plan_limits(updated_by);
