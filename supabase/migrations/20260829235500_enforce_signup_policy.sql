-- Enforce public signup policy through a narrow SECURITY DEFINER helper.
-- Ordinary sign-in is unaffected when signup is disabled.
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
