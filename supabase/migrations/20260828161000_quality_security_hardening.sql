-- Sprint 145-156: quality, resilience and public-endpoint security hardening.

CREATE TABLE IF NOT EXISTS public.website_public_rate_limits (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  fingerprint_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, bucket, fingerprint_hash)
);

ALTER TABLE public.website_public_rate_limits ENABLE ROW LEVEL SECURITY;

-- No browser policies are created intentionally. This table is only touched through
-- SECURITY DEFINER RPCs below and therefore cannot be inspected or mutated directly.
REVOKE ALL ON public.website_public_rate_limits FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_website_public_rate_limits_updated
  ON public.website_public_rate_limits(updated_at);

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
  v_agent := left(btrim(coalesce(v_headers->>'user-agent', '')), 240);

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
  v_plan text := 'free';
  v_entitlements jsonb;
BEGIN
  SELECT CASE
           WHEN s.plan IN ('pro', 'business') AND s.status IN ('active', 'trialing') THEN s.plan
           ELSE 'free'
         END
    INTO v_plan
  FROM public.projects p
  LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
  WHERE p.id = p_project_id
    AND p.type = 'website-builder'
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Website project not found'; END IF;

  v_entitlements := public.website_builder_plan_entitlements(coalesce(v_plan, 'free'));
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

CREATE OR REPLACE FUNCTION public.track_website_page_view(
  p_project_id uuid,
  p_page_path text,
  p_referrer text,
  p_session_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_event_id uuid;
  v_page_path text := left(btrim(coalesce(p_page_path, '/')), 500);
  v_referrer text := nullif(left(btrim(coalesce(p_referrer, '')), 500), '');
  v_session_id text := left(btrim(coalesce(p_session_id, '')), 100);
  v_total integer;
  v_limit integer;
BEGIN
  IF v_page_path = '' THEN v_page_path := '/'; END IF;
  IF char_length(v_session_id) < 6 THEN RAISE EXCEPTION 'Invalid session'; END IF;

  SELECT projects.user_id INTO v_user_id
  FROM public.projects
  WHERE projects.id = p_project_id
    AND projects.type = 'website-builder';

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Website project not found'; END IF;

  SELECT events.id INTO v_event_id
  FROM public.website_analytics_events AS events
  WHERE events.project_id = p_project_id
    AND events.session_id = v_session_id
    AND events.page_path = v_page_path
    AND events.event_type = 'page_view'
    AND events.created_at > now() - interval '30 seconds'
  ORDER BY events.created_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN RETURN v_event_id; END IF;

  PERFORM public.enforce_website_public_rate_limit(
    p_project_id, 'analytics-page-view', 120, 600, v_session_id
  );

  v_limit := public.website_public_ingestion_limit(p_project_id, 'analytics');
  SELECT count(*) INTO v_total
  FROM public.website_analytics_events
  WHERE project_id = p_project_id;
  IF v_total >= v_limit THEN RAISE EXCEPTION 'Analytics storage limit reached'; END IF;

  INSERT INTO public.website_analytics_events (
    project_id, user_id, page_path, referrer, session_id, event_type, event_data
  ) VALUES (
    p_project_id, v_user_id, v_page_path, v_referrer, v_session_id, 'page_view', '{}'::jsonb
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_website_page_view(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_website_page_view(uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_website_event(
  p_project_id uuid,
  p_page_path text,
  p_referrer text,
  p_session_id text,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_event_id uuid;
  v_page_path text := left(btrim(coalesce(p_page_path, '/')), 500);
  v_referrer text := nullif(left(btrim(coalesce(p_referrer, '')), 500), '');
  v_session_id text := left(btrim(coalesce(p_session_id, '')), 100);
  v_event_type text := lower(btrim(coalesce(p_event_type, '')));
  v_event_data jsonb := coalesce(p_event_data, '{}'::jsonb);
  v_total integer;
  v_limit integer;
BEGIN
  IF v_event_type NOT IN ('cta_click', 'form_submit') THEN
    RAISE EXCEPTION 'Unsupported event type';
  END IF;
  IF char_length(v_session_id) < 6 THEN RAISE EXCEPTION 'Invalid session'; END IF;
  IF jsonb_typeof(v_event_data) <> 'object' OR octet_length(v_event_data::text) > 5000 THEN
    RAISE EXCEPTION 'Invalid event data';
  END IF;

  SELECT projects.user_id INTO v_user_id
  FROM public.projects
  WHERE projects.id = p_project_id
    AND projects.type = 'website-builder';

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Website project not found'; END IF;

  SELECT events.id INTO v_event_id
  FROM public.website_analytics_events AS events
  WHERE events.project_id = p_project_id
    AND events.session_id = v_session_id
    AND events.page_path = v_page_path
    AND events.event_type = v_event_type
    AND events.created_at > now() - interval '2 seconds'
  ORDER BY events.created_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN RETURN v_event_id; END IF;

  PERFORM public.enforce_website_public_rate_limit(
    p_project_id, 'analytics-event', 80, 600, v_session_id
  );

  v_limit := public.website_public_ingestion_limit(p_project_id, 'analytics');
  SELECT count(*) INTO v_total
  FROM public.website_analytics_events
  WHERE project_id = p_project_id;
  IF v_total >= v_limit THEN RAISE EXCEPTION 'Analytics storage limit reached'; END IF;

  INSERT INTO public.website_analytics_events (
    project_id, user_id, page_path, referrer, session_id, event_type, event_data
  ) VALUES (
    p_project_id, v_user_id, v_page_path, v_referrer, v_session_id, v_event_type, v_event_data
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_website_event(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_website_event(uuid, text, text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_website_form(
  p_project_id uuid,
  p_form_data jsonb,
  p_page_path text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lead_id uuid;
  v_name text := '';
  v_email text := '';
  v_message text := '';
  v_page_path text := left(btrim(coalesce(p_page_path, '')), 500);
  v_field_count integer := 0;
  v_clean_data jsonb;
  v_total integer;
  v_limit integer;
BEGIN
  IF p_form_data IS NULL OR jsonb_typeof(p_form_data) <> 'object' THEN
    RAISE EXCEPTION 'Invalid form data';
  END IF;

  IF coalesce(btrim(p_form_data->>'_tayar_company'), '') <> '' THEN
    RAISE EXCEPTION 'Spam rejected';
  END IF;

  v_clean_data := p_form_data - '_tayar_company';

  IF octet_length(v_clean_data::text) > 16000 THEN
    RAISE EXCEPTION 'Form data is too large';
  END IF;

  SELECT count(*) INTO v_field_count FROM jsonb_object_keys(v_clean_data);
  IF v_field_count < 1 OR v_field_count > 45 THEN
    RAISE EXCEPTION 'Invalid number of form fields';
  END IF;

  SELECT projects.user_id INTO v_user_id
  FROM public.projects
  WHERE projects.id = p_project_id
    AND projects.type = 'website-builder';

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Website project not found'; END IF;

  PERFORM public.enforce_website_public_rate_limit(
    p_project_id,
    'lead-form',
    8,
    900,
    coalesce(v_clean_data->>'email', v_clean_data->>'Email', '')
  );

  v_limit := public.website_public_ingestion_limit(p_project_id, 'leads');
  SELECT count(*) INTO v_total
  FROM public.website_leads
  WHERE project_id = p_project_id;
  IF v_total >= v_limit THEN RAISE EXCEPTION 'Lead storage limit reached'; END IF;

  SELECT left(value, 120) INTO v_name
  FROM jsonb_each_text(v_clean_data)
  WHERE left(key, 1) <> '_'
    AND (lower(key) = 'name' OR lower(key) LIKE '%name%')
  ORDER BY CASE WHEN lower(key) = 'name' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT left(lower(value), 200) INTO v_email
  FROM jsonb_each_text(v_clean_data)
  WHERE left(key, 1) <> '_'
    AND (lower(key) = 'email' OR lower(key) LIKE '%email%')
  ORDER BY CASE WHEN lower(key) = 'email' THEN 0 ELSE 1 END
  LIMIT 1;

  IF coalesce(v_email, '') <> ''
     AND v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,63}$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  SELECT left(value, 4000) INTO v_message
  FROM jsonb_each_text(v_clean_data)
  WHERE left(key, 1) <> '_'
    AND (
      lower(key) = 'message'
      OR lower(key) LIKE '%message%'
      OR lower(key) LIKE '%comment%'
      OR lower(key) LIKE '%details%'
    )
  ORDER BY CASE WHEN lower(key) = 'message' THEN 0 ELSE 1 END
  LIMIT 1;

  IF coalesce(btrim(v_name), '') = '' THEN v_name := 'Website visitor'; END IF;

  IF coalesce(btrim(v_message), '') = '' THEN
    SELECT left(string_agg(key || ': ' || value, E'\n' ORDER BY key), 4000)
      INTO v_message
    FROM jsonb_each_text(v_clean_data)
    WHERE left(key, 1) <> '_';
  END IF;

  INSERT INTO public.website_leads (
    project_id, user_id, name, email, message, form_data, page_path
  ) VALUES (
    p_project_id,
    v_user_id,
    left(coalesce(v_name, 'Website visitor'), 120),
    left(coalesce(v_email, ''), 200),
    left(coalesce(v_message, 'Form submission'), 4000),
    v_clean_data,
    nullif(v_page_path, '')
  ) RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_website_form(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_website_form(uuid, jsonb, text) TO anon, authenticated;
