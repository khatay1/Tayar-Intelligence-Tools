-- Give active administrators full product access without fabricating a paid Stripe subscription.
-- Billing records remain the source of truth for revenue; admin access is an authorization override.

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
      WHEN p.role = 'admin' AND coalesce(p.suspended, false) = false THEN 'admin'
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

CREATE OR REPLACE FUNCTION public.get_website_builder_billing_state(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
  v_plan text := 'free';
  v_is_active_admin boolean := false;
  v_entitlements jsonb;
  v_project_count integer := 0;
  v_page_count integer := 0;
  v_release_count integer := 0;
  v_lead_count integer := 0;
  v_analytics_count integer := 0;
  v_content jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT (role = 'admin' AND coalesce(suspended, false) = false)
  INTO v_is_active_admin
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = v_user_id
  LIMIT 1;

  IF coalesce(v_is_active_admin, false) THEN
    v_plan := 'business';
  ELSIF FOUND
     AND v_subscription.plan IN ('pro', 'business')
     AND v_subscription.status IN ('active', 'trialing') THEN
    v_plan := v_subscription.plan;
  END IF;

  v_entitlements := public.website_builder_plan_entitlements(v_plan);

  SELECT count(*) INTO v_project_count
  FROM public.projects
  WHERE user_id = v_user_id AND type = 'website-builder';

  IF p_project_id IS NOT NULL THEN
    SELECT content INTO v_content
    FROM public.projects
    WHERE id = p_project_id
      AND user_id = v_user_id
      AND type = 'website-builder';

    IF v_content IS NOT NULL THEN
      IF jsonb_typeof(v_content->'pages') = 'array' THEN
        v_page_count := jsonb_array_length(v_content->'pages');
      END IF;

      SELECT count(*) INTO v_release_count
      FROM public.website_publish_versions
      WHERE project_id = p_project_id AND user_id = v_user_id;

      SELECT count(*) INTO v_lead_count
      FROM public.website_leads
      WHERE project_id = p_project_id AND user_id = v_user_id;

      SELECT count(*) INTO v_analytics_count
      FROM public.website_analytics_events
      WHERE project_id = p_project_id AND user_id = v_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'accessSource', CASE WHEN coalesce(v_is_active_admin, false) THEN 'admin' ELSE 'billing' END,
    'entitlements', v_entitlements,
    'subscription', CASE WHEN v_subscription.id IS NULL THEN NULL ELSE jsonb_build_object(
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

CREATE OR REPLACE FUNCTION public.enforce_website_builder_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text := 'free';
  v_is_active_admin boolean := false;
  v_entitlements jsonb;
  v_max_projects integer;
  v_max_pages integer;
  v_project_count integer;
  v_new_pages integer := 0;
  v_old_pages integer := 0;
  v_entering_builder boolean := false;
BEGIN
  IF NEW.type <> 'website-builder' THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Invalid website project owner';
  END IF;

  SELECT (role = 'admin' AND coalesce(suspended, false) = false)
  INTO v_is_active_admin
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF coalesce(v_is_active_admin, false) THEN
    v_plan := 'business';
  ELSE
    SELECT CASE
             WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
             ELSE 'free'
           END
      INTO v_plan
    FROM public.subscriptions s
    WHERE s.user_id = NEW.user_id
    LIMIT 1;
  END IF;

  v_plan := coalesce(v_plan, 'free');
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max_projects := (v_entitlements->>'maxWebsiteProjects')::integer;
  v_max_pages := (v_entitlements->>'maxPages')::integer;

  v_entering_builder := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    v_entering_builder := OLD.type IS DISTINCT FROM 'website-builder';
  END IF;

  IF v_entering_builder THEN
    SELECT count(*) INTO v_project_count
    FROM public.projects
    WHERE user_id = NEW.user_id AND type = 'website-builder';

    IF v_project_count >= v_max_projects THEN
      RAISE EXCEPTION 'Website Builder project limit reached for % plan', v_plan;
    END IF;
  END IF;

  IF jsonb_typeof(NEW.content->'pages') = 'array' THEN
    v_new_pages := jsonb_array_length(NEW.content->'pages');
  END IF;

  IF TG_OP = 'UPDATE' AND jsonb_typeof(OLD.content->'pages') = 'array' THEN
    v_old_pages := jsonb_array_length(OLD.content->'pages');
  END IF;

  IF v_new_pages > v_max_pages
     AND (TG_OP = 'INSERT' OR v_new_pages > v_old_pages) THEN
    RAISE EXCEPTION 'Website Builder page limit reached for % plan', v_plan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_website_builder_plan_limits ON public.projects;
CREATE TRIGGER trg_enforce_website_builder_plan_limits
BEFORE INSERT OR UPDATE OF content, type, user_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_website_builder_plan_limits();
