-- Define a clear subscription access lifecycle.
-- active/trialing keep paid access; past_due gets a 3-day grace period; unpaid/canceled do not.
CREATE OR REPLACE FUNCTION public.subscription_effective_paid_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_grace_until timestamptz;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND OR v_subscription.plan NOT IN ('pro', 'business') THEN
    RETURN 'free';
  END IF;

  IF v_subscription.status IN ('active', 'trialing') THEN
    RETURN v_subscription.plan;
  END IF;

  IF v_subscription.status = 'past_due' THEN
    v_grace_until := coalesce(v_subscription.updated_at, v_subscription.created_at, now()) + interval '3 days';
    IF now() < v_grace_until THEN
      RETURN v_subscription.plan;
    END IF;
  END IF;

  RETURN 'free';
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_effective_paid_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscription_effective_paid_plan(uuid) TO authenticated;

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

  RETURN public.subscription_effective_paid_plan(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.effective_access_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_access_plan(uuid) TO authenticated;
