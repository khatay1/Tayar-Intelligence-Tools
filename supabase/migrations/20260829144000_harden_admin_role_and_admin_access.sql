-- Harden administrator access and make the admin panel use trusted server-side operations.
-- This closes profile privilege-escalation paths and gives admins explicit read access
-- to the operational tables used by the admin dashboard.

-- Admin status is false for suspended administrators.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND coalesce(suspended, false) = false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- A browser user may only edit ordinary profile fields directly.
-- Sensitive fields are changed only through the admin SECURITY DEFINER RPC below.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, language) ON public.profiles TO authenticated;

REVOKE INSERT ON public.profiles FROM authenticated;
GRANT INSERT (id, full_name, avatar_url, language) ON public.profiles TO authenticated;

REVOKE DELETE ON public.profiles FROM authenticated;

DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_delete_profiles_directly" ON public.profiles;

-- Keep self-service profile updates owner-scoped. Column privileges above prevent
-- role, plan and suspension changes even when this row policy matches.
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Operational admin read policies. Existing owner policies continue to apply.
DROP POLICY IF EXISTS "admin_select_projects" ON public.projects;
CREATE POLICY "admin_select_projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_select_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_select_subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_select_ai_usage" ON public.ai_usage;
CREATE POLICY "admin_select_ai_usage"
  ON public.ai_usage
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin-only user list. SECURITY DEFINER is required to include auth email while
-- keeping auth.users inaccessible to ordinary browser queries.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  plan text,
  role text,
  suspended boolean,
  created_at timestamptz,
  project_count bigint,
  ai_request_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    coalesce(u.email, '')::text,
    p.full_name,
    CASE
      WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
      ELSE 'free'
    END::text AS plan,
    p.role,
    coalesce(p.suspended, false),
    p.created_at,
    (SELECT count(*) FROM public.projects pr WHERE pr.user_id = p.id) AS project_count,
    (SELECT count(*) FROM public.ai_usage au WHERE au.user_id = p.id) AS ai_request_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.subscriptions s ON s.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Central admin mutation endpoint. Billing plan is intentionally excluded:
-- subscription state is managed by Stripe/service-role billing sync.
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_suspended boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
  v_current_suspended boolean;
  v_active_admins integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid user role';
  END IF;

  SELECT role, coalesce(suspended, false)
  INTO v_current_role, v_current_suspended
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Never allow an administrator to lock themselves out from the admin panel.
  IF p_user_id = auth.uid() AND (p_role <> 'admin' OR coalesce(p_suspended, false)) THEN
    RAISE EXCEPTION 'You cannot remove or suspend your own administrator access';
  END IF;

  -- Keep at least one active administrator in the platform.
  IF v_current_role = 'admin'
     AND (p_role <> 'admin' OR coalesce(p_suspended, false))
     AND p_user_id <> auth.uid() THEN
    SELECT count(*)
    INTO v_active_admins
    FROM public.profiles
    WHERE role = 'admin'
      AND coalesce(suspended, false) = false
      AND id <> p_user_id;

    IF v_active_admins < 1 THEN
      RAISE EXCEPTION 'At least one active administrator is required';
    END IF;
  END IF;

  UPDATE public.profiles
  SET full_name = left(coalesce(p_full_name, ''), 200),
      role = p_role,
      suspended = coalesce(p_suspended, false),
      suspended_at = CASE
        WHEN coalesce(p_suspended, false) AND NOT v_current_suspended THEN now()
        WHEN NOT coalesce(p_suspended, false) THEN NULL
        ELSE suspended_at
      END,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.system_logs(level, category, message, metadata)
  VALUES (
    'info',
    'admin',
    'Administrator updated user access',
    jsonb_build_object(
      'actor_id', auth.uid(),
      'target_user_id', p_user_id,
      'role', p_role,
      'suspended', coalesce(p_suspended, false)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, boolean) TO authenticated;

-- Delete the actual auth account rather than only deleting the profile row.
-- FK cascades remove the user's owned application rows.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_role text;
  v_active_admins integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own administrator account';
  END IF;

  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_role = 'admin' THEN
    SELECT count(*)
    INTO v_active_admins
    FROM public.profiles
    WHERE role = 'admin'
      AND coalesce(suspended, false) = false
      AND id <> p_user_id;

    IF v_active_admins < 1 THEN
      RAISE EXCEPTION 'At least one active administrator is required';
    END IF;
  END IF;

  INSERT INTO public.system_logs(level, category, message, metadata)
  VALUES (
    'warning',
    'admin',
    'Administrator deleted user account',
    jsonb_build_object('actor_id', auth.uid(), 'target_user_id', p_user_id)
  );

  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- admin_settings is not public configuration. Feature flags remain readable by
-- authenticated users because they are consumed by normal product code.
DROP POLICY IF EXISTS "admin_settings_select" ON public.admin_settings;
CREATE POLICY "admin_settings_select"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
