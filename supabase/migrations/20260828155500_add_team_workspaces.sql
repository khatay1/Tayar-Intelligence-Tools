-- Sprint 133-144: team workspaces, invitations, roles, shared projects and secure collaboration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extend the commercial catalog with team/workspace limits while preserving all previous keys.
CREATE OR REPLACE FUNCTION public.website_builder_plan_entitlements(p_plan text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_plan, 'free'))
    WHEN 'business' THEN jsonb_build_object(
      'plan', 'business',
      'maxPages', 100,
      'maxWebsiteProjects', 50,
      'maxReleaseHistory', 100,
      'maxLeads', 100000,
      'maxAnalyticsEvents', 1000000,
      'maxTeamWorkspaces', 5,
      'maxTeamMembers', 10,
      'features', jsonb_build_object(
        'publish', true,
        'exportZip', true,
        'multilingual', true,
        'analytics', true,
        'productionIntegrations', true,
        'customCss', true,
        'releaseHistory', true,
        'clientDelivery', true,
        'whiteLabel', true,
        'teamWorkspaces', true
      )
    )
    WHEN 'pro' THEN jsonb_build_object(
      'plan', 'pro',
      'maxPages', 25,
      'maxWebsiteProjects', 10,
      'maxReleaseHistory', 25,
      'maxLeads', 10000,
      'maxAnalyticsEvents', 100000,
      'maxTeamWorkspaces', 1,
      'maxTeamMembers', 3,
      'features', jsonb_build_object(
        'publish', true,
        'exportZip', true,
        'multilingual', true,
        'analytics', true,
        'productionIntegrations', true,
        'customCss', true,
        'releaseHistory', true,
        'clientDelivery', false,
        'whiteLabel', false,
        'teamWorkspaces', true
      )
    )
    ELSE jsonb_build_object(
      'plan', 'free',
      'maxPages', 3,
      'maxWebsiteProjects', 1,
      'maxReleaseHistory', 3,
      'maxLeads', 50,
      'maxAnalyticsEvents', 1000,
      'maxTeamWorkspaces', 0,
      'maxTeamMembers', 1,
      'features', jsonb_build_object(
        'publish', true,
        'exportZip', false,
        'multilingual', false,
        'analytics', false,
        'productionIntegrations', false,
        'customCss', false,
        'releaseHistory', false,
        'clientDelivery', false,
        'whiteLabel', false,
        'teamWorkspaces', false
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.website_builder_plan_entitlements(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_builder_plan_entitlements(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.team_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.team_workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_workspaces_owner ON public.team_workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_workspace_members_user ON public.team_workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_workspace_invites_workspace ON public.team_workspace_invites(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_workspace_invites_email_unique
  ON public.team_workspace_invites(workspace_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);

ALTER TABLE public.team_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_workspace_invites ENABLE ROW LEVEL SECURITY;

-- Current-user membership helper avoids recursive RLS checks in policies.
CREATE OR REPLACE FUNCTION public.team_workspace_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.team_workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.team_workspace_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_workspace_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "team_workspaces_select_member" ON public.team_workspaces;
CREATE POLICY "team_workspaces_select_member"
  ON public.team_workspaces FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.team_workspace_role(id) IS NOT NULL);

DROP POLICY IF EXISTS "team_workspace_members_select_member" ON public.team_workspace_members;
CREATE POLICY "team_workspace_members_select_member"
  ON public.team_workspace_members FOR SELECT TO authenticated
  USING (public.team_workspace_role(workspace_id) IS NOT NULL);

DROP POLICY IF EXISTS "team_workspace_invites_select_manager" ON public.team_workspace_invites;
CREATE POLICY "team_workspace_invites_select_manager"
  ON public.team_workspace_invites FOR SELECT TO authenticated
  USING (public.team_workspace_role(workspace_id) IN ('owner', 'admin'));

-- Team tables are mutated only through the SECURITY DEFINER RPCs below.

CREATE OR REPLACE FUNCTION public.team_effective_plan(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
    ELSE 'free'
  END
  FROM (SELECT 1) x
  LEFT JOIN public.subscriptions s ON s.user_id = p_user_id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.team_effective_plan(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.list_team_workspaces()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  my_role text,
  member_count bigint,
  project_count bigint,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id,
         w.name,
         w.owner_id,
         m.role AS my_role,
         (SELECT count(*) FROM public.team_workspace_members mm WHERE mm.workspace_id = w.id) AS member_count,
         (SELECT count(*) FROM public.projects p WHERE p.workspace_id = w.id AND p.deleted_at IS NULL) AS project_count,
         w.updated_at
  FROM public.team_workspaces w
  JOIN public.team_workspace_members m
    ON m.workspace_id = w.id AND m.user_id = auth.uid()
  ORDER BY w.updated_at DESC, w.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.list_team_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_workspaces() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_workspace_details(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace public.team_workspaces%ROWTYPE;
  v_role text;
  v_plan text;
  v_entitlements jsonb;
  v_members jsonb;
  v_invites jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_workspace FROM public.team_workspaces WHERE id = p_workspace_id;
  IF v_workspace.id IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;

  SELECT role INTO v_role
  FROM public.team_workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_user_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Workspace access denied'; END IF;

  v_plan := public.team_effective_plan(v_workspace.owner_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'userId', m.user_id,
    'role', m.role,
    'joinedAt', m.joined_at,
    'fullName', coalesce(p.full_name, ''),
    'email', coalesce(u.email, '')
  ) ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END, m.joined_at), '[]'::jsonb)
  INTO v_members
  FROM public.team_workspace_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.workspace_id = p_workspace_id;

  IF v_role IN ('owner', 'admin') THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'email', i.email,
      'role', i.role,
      'expiresAt', i.expires_at,
      'createdAt', i.created_at
    ) ORDER BY i.created_at DESC), '[]'::jsonb)
    INTO v_invites
    FROM public.team_workspace_invites i
    WHERE i.workspace_id = p_workspace_id AND i.expires_at > now();
  END IF;

  RETURN jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_workspace.id,
      'name', v_workspace.name,
      'ownerId', v_workspace.owner_id,
      'myRole', v_role,
      'createdAt', v_workspace.created_at,
      'updatedAt', v_workspace.updated_at
    ),
    'members', v_members,
    'invites', v_invites,
    'plan', v_plan,
    'limits', jsonb_build_object(
      'maxTeamWorkspaces', (v_entitlements->>'maxTeamWorkspaces')::int,
      'maxTeamMembers', (v_entitlements->>'maxTeamMembers')::int,
      'memberCount', jsonb_array_length(v_members),
      'pendingInviteCount', jsonb_array_length(v_invites)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_workspace_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_workspace_details(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_team_workspace(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan text;
  v_entitlements jsonb;
  v_max integer;
  v_count integer;
  v_workspace_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(btrim(coalesce(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Workspace name is too short'; END IF;

  v_plan := public.team_effective_plan(v_user_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max := (v_entitlements->>'maxTeamWorkspaces')::int;
  SELECT count(*) INTO v_count FROM public.team_workspaces WHERE owner_id = v_user_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Team workspace limit reached for % plan', v_plan;
  END IF;

  INSERT INTO public.team_workspaces(owner_id, name)
  VALUES (v_user_id, left(btrim(p_name), 100))
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.team_workspace_members(workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner');

  RETURN v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team_workspace(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_team_workspace(p_workspace_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.team_workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();
  IF v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF length(btrim(coalesce(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Workspace name is too short'; END IF;
  UPDATE public.team_workspaces SET name = left(btrim(p_name), 100), updated_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_team_workspace(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_team_workspace(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_team_workspace_invite(
  p_workspace_id uuid,
  p_email text,
  p_role text DEFAULT 'viewer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_owner_id uuid;
  v_plan text;
  v_entitlements jsonb;
  v_max integer;
  v_members integer;
  v_pending integer;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_invite_id uuid;
  v_expires timestamptz := now() + interval '7 days';
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT owner_id INTO v_owner_id FROM public.team_workspaces WHERE id = p_workspace_id;
  SELECT role INTO v_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_user_id;
  IF v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF p_role NOT IN ('admin', 'editor', 'viewer') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF v_role = 'admin' AND p_role = 'admin' THEN RAISE EXCEPTION 'Only the owner can invite another admin'; END IF;
  IF length(v_email) < 5 OR position('@' in v_email) <= 1 OR position('.' in split_part(v_email, '@', 2)) <= 1 THEN RAISE EXCEPTION 'Invalid email address'; END IF;

  v_plan := public.team_effective_plan(v_owner_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max := (v_entitlements->>'maxTeamMembers')::int;
  SELECT count(*) INTO v_members FROM public.team_workspace_members WHERE workspace_id = p_workspace_id;
  SELECT count(*) INTO v_pending FROM public.team_workspace_invites WHERE workspace_id = p_workspace_id AND expires_at > now();

  -- Replacing an existing invite for the same email does not consume another seat.
  IF EXISTS (SELECT 1 FROM public.team_workspace_invites WHERE workspace_id = p_workspace_id AND lower(email) = v_email AND expires_at > now()) THEN
    v_pending := greatest(v_pending - 1, 0);
  END IF;
  IF v_members + v_pending >= v_max THEN
    RAISE EXCEPTION 'Team member limit reached for % plan', v_plan;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_workspace_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.workspace_id = p_workspace_id AND lower(coalesce(u.email, '')) = v_email
  ) THEN
    RAISE EXCEPTION 'This user is already a workspace member';
  END IF;

  DELETE FROM public.team_workspace_invites
  WHERE workspace_id = p_workspace_id AND lower(email) = v_email;

  v_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.team_workspace_invites(workspace_id, email, role, token_hash, invited_by, expires_at)
  VALUES (p_workspace_id, v_email, p_role, encode(digest(v_token, 'sha256'), 'hex'), v_user_id, v_expires)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('id', v_invite_id, 'token', v_token, 'expiresAt', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_workspace_invite(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team_workspace_invite(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_team_workspace_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.team_workspace_invites%ROWTYPE;
  v_owner_id uuid;
  v_plan text;
  v_entitlements jsonb;
  v_max integer;
  v_members integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT lower(coalesce(email, '')) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email = '' THEN RAISE EXCEPTION 'Authenticated account has no email'; END IF;

  SELECT * INTO v_invite
  FROM public.team_workspace_invites
  WHERE token_hash = encode(digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex')
    AND expires_at > now()
  LIMIT 1;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invite is invalid or expired'; END IF;
  IF lower(v_invite.email) <> v_email THEN RAISE EXCEPTION 'Invite email does not match this account'; END IF;

  IF EXISTS (SELECT 1 FROM public.team_workspace_members WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id) THEN
    DELETE FROM public.team_workspace_invites WHERE id = v_invite.id;
    RETURN v_invite.workspace_id;
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.team_workspaces WHERE id = v_invite.workspace_id;
  v_plan := public.team_effective_plan(v_owner_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max := (v_entitlements->>'maxTeamMembers')::int;
  SELECT count(*) INTO v_members FROM public.team_workspace_members WHERE workspace_id = v_invite.workspace_id;
  IF v_members >= v_max THEN RAISE EXCEPTION 'Workspace has reached its member limit'; END IF;

  INSERT INTO public.team_workspace_members(workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role);
  DELETE FROM public.team_workspace_invites WHERE id = v_invite.id;
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = v_invite.workspace_id;
  RETURN v_invite.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_workspace_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_workspace_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_team_workspace_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_workspace_id uuid; v_role text;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.team_workspace_invites WHERE id = p_invite_id;
  IF v_workspace_id IS NULL THEN RETURN; END IF;
  SELECT role INTO v_role FROM public.team_workspace_members WHERE workspace_id = v_workspace_id AND user_id = auth.uid();
  IF v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  DELETE FROM public.team_workspace_invites WHERE id = p_invite_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_team_workspace_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_team_workspace_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_team_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor_role text; v_target_role text;
BEGIN
  IF p_role NOT IN ('admin', 'editor', 'viewer') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT role INTO v_actor_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid();
  SELECT role INTO v_target_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Transfer ownership instead'; END IF;
  IF v_actor_role = 'owner' THEN NULL;
  ELSIF v_actor_role = 'admin' AND v_target_role IN ('editor', 'viewer') AND p_role IN ('editor', 'viewer') THEN NULL;
  ELSE RAISE EXCEPTION 'Insufficient permission';
  END IF;
  UPDATE public.team_workspace_members SET role = p_role WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_workspace_member_role(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_workspace_member_role(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_team_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor_role text; v_target_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid();
  SELECT role INTO v_target_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RETURN; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Owner cannot be removed'; END IF;
  IF auth.uid() = p_user_id THEN NULL;
  ELSIF v_actor_role = 'owner' THEN NULL;
  ELSIF v_actor_role = 'admin' AND v_target_role IN ('editor', 'viewer') THEN NULL;
  ELSE RAISE EXCEPTION 'Insufficient permission';
  END IF;
  DELETE FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_team_workspace_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_team_workspace_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_team_workspace_ownership(p_workspace_id uuid, p_new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_owner uuid := auth.uid();
  v_target_role text;
  v_plan text;
  v_entitlements jsonb;
  v_max_workspaces integer;
  v_max_members integer;
  v_owned integer;
  v_members integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_workspaces WHERE id = p_workspace_id AND owner_id = v_old_owner) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  SELECT role INTO v_target_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;
  IF v_target_role IS NULL OR v_target_role = 'owner' THEN RAISE EXCEPTION 'Choose another existing member'; END IF;

  v_plan := public.team_effective_plan(p_new_owner_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max_workspaces := (v_entitlements->>'maxTeamWorkspaces')::int;
  v_max_members := (v_entitlements->>'maxTeamMembers')::int;
  SELECT count(*) INTO v_owned FROM public.team_workspaces WHERE owner_id = p_new_owner_id;
  SELECT count(*) INTO v_members FROM public.team_workspace_members WHERE workspace_id = p_workspace_id;
  IF v_owned >= v_max_workspaces OR v_members > v_max_members THEN
    RAISE EXCEPTION 'New owner plan cannot support this workspace';
  END IF;

  UPDATE public.team_workspace_members SET role = 'admin' WHERE workspace_id = p_workspace_id AND user_id = v_old_owner;
  UPDATE public.team_workspace_members SET role = 'owner' WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;
  UPDATE public.team_workspaces SET owner_id = p_new_owner_id, updated_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_team_workspace_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_team_workspace_ownership(uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_team_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_workspaces
    WHERE id = p_workspace_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  DELETE FROM public.team_workspaces WHERE id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_team_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_team_workspace(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_project_to_team_workspace(p_project_id uuid, p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Project owner access required';
  END IF;
  SELECT role INTO v_role FROM public.team_workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid();
  IF v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Workspace manager access required'; END IF;
  UPDATE public.projects SET workspace_id = p_workspace_id, updated_at = now() WHERE id = p_project_id AND user_id = auth.uid();
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_project_to_team_workspace(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_project_to_team_workspace(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_project_from_team_workspace(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_project public.projects%ROWTYPE; v_role text;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_project.id IS NULL OR v_project.workspace_id IS NULL THEN RETURN; END IF;
  SELECT role INTO v_role FROM public.team_workspace_members WHERE workspace_id = v_project.workspace_id AND user_id = auth.uid();
  IF v_project.user_id <> auth.uid() AND v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  UPDATE public.projects SET workspace_id = NULL, updated_at = now() WHERE id = p_project_id;
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = v_project.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_project_from_team_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_project_from_team_workspace(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_team_access(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_project public.projects%ROWTYPE; v_role text; v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_project.id IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;

  IF v_project.user_id = v_user_id THEN
    v_role := 'owner';
  ELSIF v_project.workspace_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.team_workspace_members WHERE workspace_id = v_project.workspace_id AND user_id = v_user_id;
  END IF;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Project access denied'; END IF;

  RETURN jsonb_build_object(
    'ownerId', v_project.user_id,
    'workspaceId', v_project.workspace_id,
    'role', v_role,
    'canView', true,
    'canEdit', (v_project.user_id = v_user_id OR v_role IN ('owner', 'admin', 'editor')),
    'canManage', (v_project.user_id = v_user_id OR v_role IN ('owner', 'admin')),
    'canPublish', (v_project.user_id = v_user_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_team_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_team_access(uuid) TO authenticated;

-- Protect ownership and workspace assignment from collaborator-side direct updates.
CREATE OR REPLACE FUNCTION public.protect_shared_project_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Project ownership cannot be changed directly';
  END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id AND OLD.user_id <> auth.uid() THEN
    IF OLD.workspace_id IS NULL OR public.team_workspace_role(OLD.workspace_id) NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Only the project owner or workspace manager can change workspace assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shared_project_identity ON public.projects;
CREATE TRIGGER trg_protect_shared_project_identity
BEFORE UPDATE OF user_id, workspace_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.protect_shared_project_identity();

-- Replace owner-only project policies with role-aware collaboration policies.
DROP POLICY IF EXISTS "select_own_projects" ON public.projects;
DROP POLICY IF EXISTS "insert_own_projects" ON public.projects;
DROP POLICY IF EXISTS "update_own_projects" ON public.projects;
DROP POLICY IF EXISTS "delete_own_projects" ON public.projects;
DROP POLICY IF EXISTS "select_accessible_projects" ON public.projects;
DROP POLICY IF EXISTS "insert_personal_projects" ON public.projects;
DROP POLICY IF EXISTS "update_accessible_projects" ON public.projects;
DROP POLICY IF EXISTS "delete_owned_projects" ON public.projects;

CREATE POLICY "select_accessible_projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (workspace_id IS NOT NULL AND public.team_workspace_role(workspace_id) IS NOT NULL)
  );

CREATE POLICY "insert_personal_projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND workspace_id IS NULL);

CREATE POLICY "update_accessible_projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (workspace_id IS NOT NULL AND public.team_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (workspace_id IS NOT NULL AND public.team_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
  );

CREATE POLICY "delete_owned_projects"
  ON public.projects FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Update Website Builder limit enforcement so collaborators edit against the project owner's plan.
CREATE OR REPLACE FUNCTION public.enforce_website_builder_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_plan text := 'free';
  v_entitlements jsonb;
  v_max_projects integer;
  v_max_pages integer;
  v_project_count integer;
  v_new_pages integer := 0;
  v_old_pages integer := 0;
  v_entering_builder boolean := false;
  v_actor_role text;
BEGIN
  IF NEW.type <> 'website-builder' THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF;

  IF NEW.user_id IS DISTINCT FROM v_actor THEN
    IF NEW.workspace_id IS NULL THEN RAISE EXCEPTION 'Invalid website project owner'; END IF;
    SELECT role INTO v_actor_role FROM public.team_workspace_members
    WHERE workspace_id = NEW.workspace_id AND user_id = v_actor;
    IF v_actor_role NOT IN ('owner', 'admin', 'editor') THEN
      RAISE EXCEPTION 'Website project is read-only for this member';
    END IF;
  END IF;

  v_plan := public.team_effective_plan(NEW.user_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max_projects := (v_entitlements->>'maxWebsiteProjects')::integer;
  v_max_pages := (v_entitlements->>'maxPages')::integer;

  v_entering_builder := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN v_entering_builder := OLD.type IS DISTINCT FROM 'website-builder'; END IF;

  IF v_entering_builder THEN
    SELECT count(*) INTO v_project_count FROM public.projects WHERE user_id = NEW.user_id AND type = 'website-builder';
    IF v_project_count >= v_max_projects THEN
      RAISE EXCEPTION 'Website Builder project limit reached for % plan', v_plan;
    END IF;
  END IF;

  IF jsonb_typeof(NEW.content->'pages') = 'array' THEN v_new_pages := jsonb_array_length(NEW.content->'pages'); END IF;
  IF TG_OP = 'UPDATE' AND jsonb_typeof(OLD.content->'pages') = 'array' THEN v_old_pages := jsonb_array_length(OLD.content->'pages'); END IF;
  IF v_new_pages > v_max_pages AND (TG_OP = 'INSERT' OR v_new_pages > v_old_pages) THEN
    RAISE EXCEPTION 'Website Builder page limit reached for % plan', v_plan;
  END IF;
  RETURN NEW;
END;
$$;

-- Billing state for a shared project uses the project owner's subscription and exposes actor role.
CREATE OR REPLACE FUNCTION public.get_website_builder_billing_state(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_owner_id uuid := v_actor_id;
  v_actor_role text := 'owner';
  v_subscription public.subscriptions%ROWTYPE;
  v_plan text := 'free';
  v_entitlements jsonb;
  v_project_count integer := 0;
  v_page_count integer := 0;
  v_release_count integer := 0;
  v_lead_count integer := 0;
  v_analytics_count integer := 0;
  v_content jsonb;
  v_workspace_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF p_project_id IS NOT NULL THEN
    SELECT p.user_id, p.workspace_id, p.content
    INTO v_owner_id, v_workspace_id, v_content
    FROM public.projects p
    WHERE p.id = p_project_id AND p.type = 'website-builder';
    IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Website project not found'; END IF;
    IF v_owner_id <> v_actor_id THEN
      SELECT role INTO v_actor_role FROM public.team_workspace_members
      WHERE workspace_id = v_workspace_id AND user_id = v_actor_id;
      IF v_actor_role IS NULL THEN RAISE EXCEPTION 'Website project access denied'; END IF;
    END IF;
  END IF;

  SELECT * INTO v_subscription FROM public.subscriptions WHERE user_id = v_owner_id LIMIT 1;
  IF FOUND AND v_subscription.plan IN ('pro', 'business') AND v_subscription.status IN ('active', 'trialing') THEN
    v_plan := v_subscription.plan;
  END IF;
  v_entitlements := public.website_builder_plan_entitlements(v_plan);

  SELECT count(*) INTO v_project_count FROM public.projects WHERE user_id = v_owner_id AND type = 'website-builder';
  IF p_project_id IS NOT NULL AND v_content IS NOT NULL THEN
    IF jsonb_typeof(v_content->'pages') = 'array' THEN v_page_count := jsonb_array_length(v_content->'pages'); END IF;
    SELECT count(*) INTO v_release_count FROM public.website_publish_versions WHERE project_id = p_project_id AND user_id = v_owner_id;
    SELECT count(*) INTO v_lead_count FROM public.website_leads WHERE project_id = p_project_id AND user_id = v_owner_id;
    SELECT count(*) INTO v_analytics_count FROM public.website_analytics_events WHERE project_id = p_project_id AND user_id = v_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'entitlements', v_entitlements,
    'projectOwnerId', v_owner_id,
    'actorRole', v_actor_role,
    'subscription', CASE WHEN v_subscription.id IS NULL OR v_owner_id <> v_actor_id THEN NULL ELSE jsonb_build_object(
      'status', v_subscription.status,
      'renewalDate', v_subscription.renewal_date,
      'currentPeriodEnd', v_subscription.current_period_end,
      'cancelAtPeriodEnd', v_subscription.cancel_at_period_end,
      'stripeCustomerId', v_subscription.stripe_customer_id,
      'stripeSubscriptionId', v_subscription.stripe_subscription_id
    ) END,
    'usage', jsonb_build_object(
      'websiteProjects', v_project_count,
      'pages', v_page_count,
      'releases', v_release_count,
      'leads', v_lead_count,
      'analyticsEvents', v_analytics_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_builder_billing_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_builder_billing_state(uuid) TO authenticated;
