-- AI engine server-side rate limiting and trusted usage logging.

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_updated_at
  ON public.ai_rate_limits(updated_at);

CREATE OR REPLACE FUNCTION public.enforce_ai_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_hits integer;
BEGIN
  IF p_user_id IS NULL OR coalesce(p_limit, 0) < 1 OR coalesce(p_window_seconds, 0) < 1 THEN
    RAISE EXCEPTION 'Invalid AI rate limit request';
  END IF;

  INSERT INTO public.ai_rate_limits (user_id, bucket, window_started_at, hit_count, updated_at)
  VALUES (p_user_id, left(lower(coalesce(p_bucket, 'ai-engine')), 80), v_now, 1, v_now)
  ON CONFLICT (user_id, bucket)
  DO UPDATE SET
    hit_count = CASE
      WHEN public.ai_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN 1
      ELSE public.ai_rate_limits.hit_count + 1
    END,
    window_started_at = CASE
      WHEN public.ai_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN v_now
      ELSE public.ai_rate_limits.window_started_at
    END,
    updated_at = v_now
  RETURNING hit_count INTO v_hits;

  IF v_hits > p_limit THEN
    RAISE EXCEPTION 'Too many AI requests. Please try again later.';
  END IF;

  DELETE FROM public.ai_rate_limits
  WHERE user_id = p_user_id
    AND updated_at < v_now - interval '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_ai_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_ai_rate_limit(uuid, text, integer, integer) TO service_role;

-- Usage rows are trusted server records. Browser clients may read their own rows,
-- but cannot forge new usage records.
DROP POLICY IF EXISTS "insert_own_ai_usage" ON public.ai_usage;
REVOKE INSERT ON public.ai_usage FROM anon, authenticated;
