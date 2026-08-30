-- Ensure administrators receive Business-equivalent product access without
-- mutating Stripe subscription records. Billing data remains truthful; this is
-- an entitlement/display override for trusted administrators.

CREATE OR REPLACE FUNCTION public.team_effective_plan(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.role = 'admin' AND coalesce(p.suspended, false) = false THEN 'business'
    WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
    ELSE 'free'
  END
  FROM (SELECT p_user_id AS id) requested_user
  LEFT JOIN public.profiles p ON p.id = requested_user.id
  LEFT JOIN LATERAL (
    SELECT subscription.plan, subscription.status
    FROM public.subscriptions subscription
    WHERE subscription.user_id = requested_user.id
    ORDER BY
      CASE WHEN subscription.status IN ('active', 'trialing') THEN 0 ELSE 1 END,
      subscription.created_at DESC
    LIMIT 1
  ) s ON true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.team_effective_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_effective_plan(uuid) TO authenticated;

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
      WHEN p.role = 'admin' AND coalesce(p.suspended, false) = false THEN 'business'
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
  LEFT JOIN LATERAL (
    SELECT subscription.plan, subscription.status
    FROM public.subscriptions subscription
    WHERE subscription.user_id = p.id
    ORDER BY
      CASE WHEN subscription.status IN ('active', 'trialing') THEN 0 ELSE 1 END,
      subscription.created_at DESC
    LIMIT 1
  ) s ON true
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
