-- Core V3 phase 0: align shared Website Builder runtime access with project roles.
-- Project ownership remains authoritative for publishing, while collaborators receive
-- only the operational data their role is allowed to use.

CREATE OR REPLACE FUNCTION public.website_project_team_role(p_project_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.user_id = auth.uid() THEN 'owner'
    WHEN p.workspace_id IS NOT NULL THEN public.team_workspace_role(p.workspace_id)
    ELSE NULL
  END
  FROM public.projects AS p
  WHERE p.id = p_project_id
    AND p.type = 'website-builder'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.website_project_team_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_project_team_role(uuid) TO authenticated;

-- Leads can contain personal information. Limit them to project owners and admins.
DROP POLICY IF EXISTS "website_leads_owner_select" ON public.website_leads;
CREATE POLICY "website_leads_owner_select"
  ON public.website_leads
  FOR SELECT TO authenticated
  USING (public.website_project_team_role(project_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "website_leads_owner_update" ON public.website_leads;
CREATE POLICY "website_leads_owner_update"
  ON public.website_leads
  FOR UPDATE TO authenticated
  USING (public.website_project_team_role(project_id) IN ('owner', 'admin'))
  WITH CHECK (
    public.website_project_team_role(project_id) IN ('owner', 'admin')
    AND user_id = (SELECT p.user_id FROM public.projects p WHERE p.id = project_id)
  );

DROP POLICY IF EXISTS "website_leads_owner_delete" ON public.website_leads;
CREATE POLICY "website_leads_owner_delete"
  ON public.website_leads
  FOR DELETE TO authenticated
  USING (public.website_project_team_role(project_id) IN ('owner', 'admin'));

-- Analytics is available to collaborators who can edit the shared website.
DROP POLICY IF EXISTS "website_analytics_owner_select" ON public.website_analytics_events;
CREATE POLICY "website_analytics_owner_select"
  ON public.website_analytics_events
  FOR SELECT TO authenticated
  USING (public.website_project_team_role(project_id) IN ('owner', 'admin', 'editor'));

DROP POLICY IF EXISTS "website_analytics_owner_delete" ON public.website_analytics_events;
CREATE POLICY "website_analytics_owner_delete"
  ON public.website_analytics_events
  FOR DELETE TO authenticated
  USING (public.website_project_team_role(project_id) IN ('owner', 'admin'));

-- Release history is read-only for collaborators. Publishing, rollback archive writes,
-- inserts and deletes remain owner-only through the existing policies and UI guards.
DROP POLICY IF EXISTS "website_publish_versions_owner_select" ON public.website_publish_versions;
CREATE POLICY "website_publish_versions_owner_select"
  ON public.website_publish_versions
  FOR SELECT TO authenticated
  USING (public.website_project_team_role(project_id) IN ('owner', 'admin', 'editor', 'viewer'));
