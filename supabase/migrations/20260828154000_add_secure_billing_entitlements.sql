-- Sprint 121-132: secure plans, billing entitlements and website-builder usage limits.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Normalize the legacy enterprise name into the v1 commercial catalog.
UPDATE public.subscriptions SET plan = 'business' WHERE plan = 'enterprise';
UPDATE public.profiles SET plan = 'business' WHERE plan = 'enterprise';

-- Keep one canonical subscription row per account before adding uniqueness.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS row_number
  FROM public.subscriptions
)
DELETE FROM public.subscriptions s
USING ranked r
WHERE s.id = r.id AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_unique
  ON public.subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_unique
  ON public.subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_unique
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Seed a canonical subscription row for every existing profile, preserving a valid legacy plan.
INSERT INTO public.subscriptions (user_id, plan, status, updated_at)
SELECT p.id,
       CASE WHEN p.plan IN ('pro', 'business') THEN p.plan ELSE 'free' END,
       'active',
       now()
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id
);

-- Keep the profile badge synchronized with the canonical subscription record.
UPDATE public.profiles p
SET plan = CASE WHEN s.plan IN ('pro', 'business') THEN s.plan ELSE 'free' END,
    updated_at = now()
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND p.plan IS DISTINCT FROM CASE WHEN s.plan IN ('pro', 'business') THEN s.plan ELSE 'free' END;

-- Users may read their own subscription, but billing writes are reserved for trusted backend code.
DROP POLICY IF EXISTS "insert_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "update_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "delete_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "select_own_subscriptions" ON public.subscriptions;
CREATE POLICY "select_own_subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Prevent a browser client from self-upgrading by changing profiles.plan directly.
CREATE OR REPLACE FUNCTION public.protect_managed_profile_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' AND coalesce(NEW.plan, 'free') <> 'free' THEN
      RAISE EXCEPTION 'Profile plan is managed by billing';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Profile plan is managed by billing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_managed_profile_plan ON public.profiles;
CREATE TRIGGER trg_protect_managed_profile_plan
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_managed_profile_plan();

-- Centralized plan catalog. This function intentionally contains no user input.
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
      'features', jsonb_build_object(
        'publish', true,
        'exportZip', true,
        'multilingual', true,
        'analytics', true,
        'productionIntegrations', true,
        'customCss', true,
        'releaseHistory', true,
        'clientDelivery', true,
        'whiteLabel', true
      )
    )
    WHEN 'pro' THEN jsonb_build_object(
      'plan', 'pro',
      'maxPages', 25,
      'maxWebsiteProjects', 10,
      'maxReleaseHistory', 25,
      'maxLeads', 10000,
      'maxAnalyticsEvents', 100000,
      'features', jsonb_build_object(
        'publish', true,
        'exportZip', true,
        'multilingual', true,
        'analytics', true,
        'productionIntegrations', true,
        'customCss', true,
        'releaseHistory', true,
        'clientDelivery', false,
        'whiteLabel', false
      )
    )
    ELSE jsonb_build_object(
      'plan', 'free',
      'maxPages', 3,
      'maxWebsiteProjects', 1,
      'maxReleaseHistory', 3,
      'maxLeads', 50,
      'maxAnalyticsEvents', 1000,
      'features', jsonb_build_object(
        'publish', true,
        'exportZip', false,
        'multilingual', false,
        'analytics', false,
        'productionIntegrations', false,
        'customCss', false,
        'releaseHistory', false,
        'clientDelivery', false,
        'whiteLabel', false
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.website_builder_plan_entitlements(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_builder_plan_entitlements(text) TO authenticated;

-- One RPC gives the builder a trusted plan, subscription snapshot and usage counters.
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

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = v_user_id
  LIMIT 1;

  IF FOUND
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

-- Enforce website-builder project and page growth limits at the database boundary.
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
  IF NEW.type <> 'website-builder' THEN
    RETURN NEW;
  END IF;

  -- Trusted backend operations are not constrained by browser plan limits.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Invalid website project owner';
  END IF;

  SELECT CASE
           WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
           ELSE 'free'
         END
    INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = NEW.user_id
  LIMIT 1;

  v_plan := coalesce(v_plan, 'free');
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  v_max_projects := (v_entitlements->>'maxWebsiteProjects')::integer;
  v_max_pages := (v_entitlements->>'maxPages')::integer;

  v_entering_builder := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    v_entering_builder := OLD.type IS DISTINCT FROM 'website-builder';
  END IF;

  -- Count both direct inserts and conversions from another project type, closing a type-change bypass.
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

  -- Grandfather existing oversized projects: editing remains possible, growth does not.
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

-- Webhook/service-role helper: one atomic upsert keeps subscription + profile badge aligned.
CREATE OR REPLACE FUNCTION public.sync_billing_subscription(
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_price_id text DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text := CASE lower(coalesce(p_plan, 'free'))
                   WHEN 'pro' THEN 'pro'
                   WHEN 'business' THEN 'business'
                   ELSE 'free'
                 END;
  v_effective_profile_plan text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, current_period_end, cancel_at_period_end, updated_at
  ) VALUES (
    p_user_id, v_plan, left(coalesce(p_status, 'active'), 40),
    nullif(p_stripe_customer_id, ''), nullif(p_stripe_subscription_id, ''),
    nullif(p_stripe_price_id, ''), p_current_period_end,
    coalesce(p_cancel_at_period_end, false), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    stripe_customer_id = coalesce(EXCLUDED.stripe_customer_id, public.subscriptions.stripe_customer_id),
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = now();

  v_effective_profile_plan := CASE
    WHEN v_plan IN ('pro', 'business') AND p_status IN ('active', 'trialing') THEN v_plan
    ELSE 'free'
  END;

  UPDATE public.profiles
  SET plan = v_effective_profile_plan,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_billing_subscription(uuid, text, text, text, text, text, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_billing_subscription(uuid, text, text, text, text, text, timestamptz, boolean) TO service_role;
