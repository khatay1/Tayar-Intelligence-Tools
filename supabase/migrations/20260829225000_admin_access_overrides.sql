-- Administrator-granted product access that is intentionally separate from Stripe billing.
-- Overrides never create paid subscriptions and never contribute to billing revenue.

CREATE TABLE IF NOT EXISTS public.admin_access_overrides (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('pro', 'business')),
  reason text NOT NULL DEFAULT '',
  expires_at timestamptz,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_access_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_access_overrides_admin_select" ON public.admin_access_overrides;
CREATE POLICY "admin_access_overrides_admin_select"
  ON public.admin_access_overrides FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.admin_access_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_access_overrides TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_access_override(
  p_user_id uuid,
  p_plan text DEFAULT NULL,
  p_reason text DEFAULT '',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text := lower(nullif(trim(coalesce(p_plan, '')), ''));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_plan IS NULL THEN
    DELETE FROM public.admin_access_overrides WHERE user_id = p_user_id;
  ELSE
    IF v_plan NOT IN ('pro', 'business') THEN
      RAISE EXCEPTION 'Override plan must be pro or business';
    END IF;
    IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
      RAISE EXCEPTION 'Override expiration must be in the future';
    END IF;

    INSERT INTO public.admin_access_overrides(user_id, plan, reason, expires_at, granted_by, updated_at)
    VALUES (
      p_user_id,
      v_plan,
      left(coalesce(p_reason, ''), 500),
      p_expires_at,
      auth.uid(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      reason = EXCLUDED.reason,
      expires_at = EXCLUDED.expires_at,
      granted_by = auth.uid(),
      updated_at = now();
  END IF;

  INSERT INTO public.system_logs(level, category, message, metadata)
  VALUES (
    'info',
    'admin',
    'Administrator changed product access override',
    jsonb_build_object(
      'actor_id', auth.uid(),
      'target_user_id', p_user_id,
      'override_plan', v_plan,
      'expires_at', p_expires_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_access_override(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_access_override(uuid, text, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.effective_access_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_suspended boolean;
  v_override text;
  v_paid text;
BEGIN
  SELECT role, coalesce(suspended, false)
  INTO v_role, v_suspended
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_suspended THEN
    RETURN 'free';
  END IF;

  IF v_role = 'admin' THEN
    RETURN 'business';
  END IF;

  SELECT ao.plan INTO v_override
  FROM public.admin_access_overrides ao
  WHERE ao.user_id = p_user_id
    AND (ao.expires_at IS NULL OR ao.expires_at > now());

  IF v_override IN ('pro', 'business') THEN
    RETURN v_override;
  END IF;

  SELECT CASE
           WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
           ELSE 'free'
         END
  INTO v_paid
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  LIMIT 1;

  RETURN coalesce(v_paid, 'free');
END;
$$;

REVOKE ALL ON FUNCTION public.effective_access_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_access_plan(uuid) TO authenticated;

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
      ELSE public.effective_access_plan(p.id)
    END::text,
    p.role,
    coalesce(p.suspended, false),
    p.created_at,
    (SELECT count(*) FROM public.projects pr WHERE pr.user_id = p.id),
    (SELECT count(*) FROM public.ai_usage au WHERE au.user_id = p.id)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;


-- Website Builder reads the same effective access source: admin role, admin grant, then Stripe.
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
  v_access_source text := 'billing';
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

  v_plan := public.effective_access_plan(v_user_id);

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND role = 'admin' AND coalesce(suspended, false) = false
  ) THEN
    v_access_source := 'admin';
  ELSIF EXISTS (
    SELECT 1 FROM public.admin_access_overrides ao
    WHERE ao.user_id = v_user_id AND (ao.expires_at IS NULL OR ao.expires_at > now())
  ) THEN
    v_access_source := 'admin_override';
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = v_user_id
  LIMIT 1;

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
    'accessSource', v_access_source,
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
  v_entitlements jsonb;
  v_max_projects integer;
  v_max_pages integer;
  v_project_count integer;
  v_new_pages integer := 0;
  v_old_pages integer := 0;
  v_entering_builder boolean := false;
BEGIN
  IF NEW.type <> 'website-builder' THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Invalid website project owner';
  END IF;

  v_plan := public.effective_access_plan(NEW.user_id);
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
