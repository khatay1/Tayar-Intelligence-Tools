-- Recover durable account-access controls from the pre-release branch without
-- restoring its older admin/billing implementation wholesale.
--
-- This migration adds email-level account blocks, protects submitted support
-- content, exposes the public signup flag, and gives paid subscriptions a small
-- past-due grace period while preserving the current admin Business override.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.account_blocks (
  email citext PRIMARY KEY,
  reason text NOT NULL DEFAULT '',
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  source_user_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_blocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_blocks TO authenticated;

DROP POLICY IF EXISTS "account_blocks_admin_select" ON public.account_blocks;
CREATE POLICY "account_blocks_admin_select"
  ON public.account_blocks
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_email_blocked(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_blocks b
    WHERE lower(trim(b.email::text)) = lower(trim(coalesce(p_email, '')))
      AND (b.expires_at IS NULL OR b.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_email_blocked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_blocked(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_block_email(
  p_email text,
  p_reason text DEFAULT '',
  p_expires_at timestamptz DEFAULT NULL,
  p_source_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF v_email = '' OR position('@' in v_email) < 2 THEN
    RAISE EXCEPTION 'Valid email is required';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'Block expiration must be in the future';
  END IF;

  INSERT INTO public.account_blocks(email, reason, blocked_by, expires_at, source_user_id, updated_at)
  VALUES (v_email, left(coalesce(p_reason, ''), 500), auth.uid(), p_expires_at, p_source_user_id, now())
  ON CONFLICT (email) DO UPDATE SET
    reason = EXCLUDED.reason,
    blocked_by = auth.uid(),
    expires_at = EXCLUDED.expires_at,
    source_user_id = coalesce(EXCLUDED.source_user_id, public.account_blocks.source_user_id),
    updated_at = now();

  INSERT INTO public.system_logs(level, category, message, metadata)
  VALUES (
    'warning',
    'admin',
    'Administrator blocked account email',
    jsonb_build_object(
      'actor_id', auth.uid(),
      'email', v_email,
      'source_user_id', p_source_user_id,
      'expires_at', p_expires_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_block_email(text, text, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_block_email(text, text, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unblock_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  DELETE FROM public.account_blocks
  WHERE lower(trim(email::text)) = lower(trim(coalesce(p_email, '')));

  INSERT INTO public.system_logs(level, category, message, metadata)
  VALUES (
    'info',
    'admin',
    'Administrator removed account email block',
    jsonb_build_object('actor_id', auth.uid(), 'email', lower(trim(coalesce(p_email, ''))))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unblock_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unblock_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_account_blocks()
RETURNS TABLE (
  email text,
  reason text,
  blocked_by uuid,
  blocked_by_email text,
  blocked_at timestamptz,
  expires_at timestamptz,
  source_user_id uuid,
  active boolean
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
    b.email::text,
    b.reason,
    b.blocked_by,
    coalesce(u.email, '')::text,
    b.blocked_at,
    b.expires_at,
    b.source_user_id,
    (b.expires_at IS NULL OR b.expires_at > now()) AS active
  FROM public.account_blocks b
  LEFT JOIN auth.users u ON u.id = b.blocked_by
  ORDER BY
    CASE WHEN b.expires_at IS NULL OR b.expires_at > now() THEN 0 ELSE 1 END,
    b.blocked_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_account_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_account_blocks() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user_and_block(
  p_user_id uuid,
  p_reason text DEFAULT '',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
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

  SELECT p.role, u.email
  INTO v_target_role, v_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_role = 'admin' THEN
    SELECT count(*) INTO v_active_admins
    FROM public.profiles
    WHERE role = 'admin'
      AND coalesce(suspended, false) = false
      AND id <> p_user_id;

    IF v_active_admins < 1 THEN
      RAISE EXCEPTION 'At least one active administrator is required';
    END IF;
  END IF;

  PERFORM public.admin_block_email(v_email, p_reason, p_expires_at, p_user_id);

  DELETE FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user_and_block(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_and_block(uuid, text, timestamptz) TO authenticated;

-- Owners may not rewrite the originally submitted support request. Existing
-- admin-only field protection remains in place from the admin hardening migration.
CREATE OR REPLACE FUNCTION public.protect_support_ticket_owner_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Submitted support ticket content cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_support_ticket_owner_content ON public.support_tickets;
CREATE TRIGGER trg_protect_support_ticket_owner_content
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.protect_support_ticket_owner_content();

CREATE OR REPLACE FUNCTION public.is_signup_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT CASE
        WHEN jsonb_typeof(value) = 'boolean' THEN (value::text)::boolean
        WHEN jsonb_typeof(value) = 'string' THEN trim(both '"' from value::text)::boolean
        ELSE true
      END
      FROM public.admin_settings
      WHERE key = 'signup_enabled'
      LIMIT 1
    ),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.is_signup_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_signup_enabled() TO anon, authenticated;

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
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY
    CASE
      WHEN s.status IN ('active', 'trialing') THEN 0
      WHEN s.status = 'past_due' THEN 1
      ELSE 2
    END,
    coalesce(s.updated_at, s.created_at) DESC
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

CREATE OR REPLACE FUNCTION public.team_effective_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_suspended boolean := false;
BEGIN
  SELECT p.role, coalesce(p.suspended, false)
  INTO v_role, v_suspended
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_suspended THEN
    RETURN 'free';
  END IF;

  IF v_role = 'admin' THEN
    RETURN 'business';
  END IF;

  RETURN public.subscription_effective_paid_plan(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.team_effective_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_effective_plan(uuid) TO authenticated;

-- Keep the admin user list aligned with the same effective-plan calculation used
-- by product entitlements, including active/trialing and the short past-due grace.
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
    public.team_effective_plan(p.id)::text,
    p.role,
    coalesce(p.suspended, false),
    p.created_at,
    (SELECT count(*) FROM public.projects pr WHERE pr.user_id = p.id) AS project_count,
    (SELECT count(*) FROM public.ai_usage au WHERE au.user_id = p.id) AS ai_request_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
