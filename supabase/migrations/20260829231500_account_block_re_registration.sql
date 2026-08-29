-- Preserve administrator account enforcement across deletion and re-registration.
-- Email blocks are separate from auth.users so deleting an account cannot erase the ban decision.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.account_blocks (
  email citext PRIMARY KEY,
  reason text NOT NULL DEFAULT '',
  blocked_by uuid NOT NULL REFERENCES auth.users(id),
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

-- Explicit destructive action: record the identity block before deleting auth.users.
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
