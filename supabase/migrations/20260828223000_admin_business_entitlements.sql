-- Global administrators need production-equivalent Business access for operations
-- and QA. This is an entitlement override only: subscription and payment records
-- remain unchanged and continue to describe the customer's actual billing state.

CREATE OR REPLACE FUNCTION public.team_effective_plan(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.role = 'admin' THEN 'business'
    WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
    ELSE 'free'
  END
  FROM (SELECT p_user_id AS id) requested_user
  LEFT JOIN public.profiles p ON p.id = requested_user.id
  LEFT JOIN public.subscriptions s ON s.user_id = requested_user.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.team_effective_plan(uuid) FROM PUBLIC;

-- Keep the raw subscription snapshot truthful while deriving feature access from
-- the shared effective-plan function above.
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
  v_plan := public.team_effective_plan(v_owner_id);
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

CREATE OR REPLACE FUNCTION public.website_public_ingestion_limit(
  p_project_id uuid,
  p_kind text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_plan text := 'free';
  v_entitlements jsonb;
BEGIN
  SELECT p.user_id
  INTO v_owner_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.type = 'website-builder'
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Website project not found'; END IF;

  v_plan := public.team_effective_plan(v_owner_id);
  v_entitlements := public.website_builder_plan_entitlements(v_plan);
  IF lower(coalesce(p_kind, '')) = 'leads' THEN
    RETURN greatest(1, coalesce((v_entitlements->>'maxLeads')::integer, 50));
  END IF;
  IF lower(coalesce(p_kind, '')) = 'analytics' THEN
    RETURN greatest(1, coalesce((v_entitlements->>'maxAnalyticsEvents')::integer, 1000));
  END IF;
  RAISE EXCEPTION 'Unsupported ingestion limit kind';
END;
$$;

REVOKE ALL ON FUNCTION public.website_public_ingestion_limit(uuid, text) FROM PUBLIC;
