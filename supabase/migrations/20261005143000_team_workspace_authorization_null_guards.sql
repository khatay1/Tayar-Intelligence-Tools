-- Fail closed when the caller has no workspace membership. Existing grants are preserved.

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
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF length(btrim(coalesce(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Workspace name is too short'; END IF;
  UPDATE public.team_workspaces SET name = left(btrim(p_name), 100), updated_at = now() WHERE id = p_workspace_id;
END;
$$;

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
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
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
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  DELETE FROM public.team_workspace_invites WHERE id = p_invite_id;
END;
$$;

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
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Workspace manager access required'; END IF;
  UPDATE public.projects SET workspace_id = p_workspace_id, updated_at = now() WHERE id = p_project_id AND user_id = auth.uid();
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = p_workspace_id;
END;
$$;

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
  IF v_project.user_id IS DISTINCT FROM auth.uid() AND (v_role IS NULL OR v_role NOT IN ('owner', 'admin')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  UPDATE public.projects SET workspace_id = NULL, updated_at = now() WHERE id = p_project_id;
  UPDATE public.team_workspaces SET updated_at = now() WHERE id = v_project.workspace_id;
END;
$$;
