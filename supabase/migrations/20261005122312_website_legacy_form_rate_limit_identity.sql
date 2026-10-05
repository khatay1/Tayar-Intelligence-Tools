-- Prevent legacy form callers from rotating email or User-Agent to reset limits.
-- CREATE OR REPLACE preserves current EXECUTE grants, including service_role.
CREATE OR REPLACE FUNCTION public.enforce_website_public_rate_limit(
  p_project_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer,
  p_client_key text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb := '{}'::jsonb;
  v_ip text := '';
  v_agent text := '';
  v_fingerprint text;
  v_hits integer;
  v_window_started timestamptz;
  v_now timestamptz := now();
BEGIN
  IF p_project_id IS NULL OR coalesce(p_limit, 0) < 1 OR coalesce(p_window_seconds, 0) < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit request';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND type = 'website-builder'
  ) THEN
    RAISE EXCEPTION 'Website project not found';
  END IF;

  BEGIN
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN others THEN
    v_headers := '{}'::jsonb;
  END;

  v_ip := left(btrim(coalesce(
    v_headers->>'cf-connecting-ip',
    nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''),
    v_headers->>'x-real-ip',
    ''
  )), 120);
  -- Legacy public callers control form fields and User-Agent. Neither may
  -- create a fresh visitor bucket. Keep trusted Edge client keys unchanged.
  IF lower(coalesce(p_bucket, '')) IN ('lead-form', 'lead-legacy') THEN
    v_agent := '';
    p_client_key := '';
  ELSE
    v_agent := left(btrim(coalesce(v_headers->>'user-agent', '')), 240);
  END IF;

  v_fingerprint := encode(
    digest(
      p_project_id::text || '|' || left(lower(coalesce(p_bucket, '')), 50) || '|' ||
      v_ip || '|' || v_agent || '|' || left(coalesce(p_client_key, ''), 120),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.website_public_rate_limits (
    project_id, bucket, fingerprint_hash, window_started_at, hit_count, updated_at
  ) VALUES (
    p_project_id,
    left(lower(coalesce(p_bucket, 'public')), 50),
    v_fingerprint,
    v_now,
    1,
    v_now
  )
  ON CONFLICT (project_id, bucket, fingerprint_hash)
  DO UPDATE SET
    hit_count = CASE
      WHEN public.website_public_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE public.website_public_rate_limits.hit_count + 1
    END,
    window_started_at = CASE
      WHEN public.website_public_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        THEN v_now
      ELSE public.website_public_rate_limits.window_started_at
    END,
    updated_at = v_now
  RETURNING hit_count, window_started_at INTO v_hits, v_window_started;

  IF v_hits > p_limit THEN
    RAISE EXCEPTION 'Too many requests. Please try again later.';
  END IF;

  -- Bound housekeeping cost to the current project. This removes stale fingerprints
  -- without needing a scheduled job and never touches active windows.
  DELETE FROM public.website_public_rate_limits
  WHERE project_id = p_project_id
    AND updated_at < v_now - interval '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_website_public_rate_limit(uuid, text, integer, integer, text) FROM PUBLIC;

