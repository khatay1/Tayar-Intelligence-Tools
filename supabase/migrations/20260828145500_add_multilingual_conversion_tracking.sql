-- Sprint 73-84: multilingual conversion analytics, UTM attribution and form spam protection.

ALTER TABLE public.website_analytics_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'page_view';

ALTER TABLE public.website_analytics_events
  ADD COLUMN IF NOT EXISTS event_data jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'website_analytics_event_type_check'
  ) THEN
    ALTER TABLE public.website_analytics_events
      ADD CONSTRAINT website_analytics_event_type_check
      CHECK (event_type IN ('page_view', 'cta_click', 'form_submit'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_website_analytics_project_event_created
  ON public.website_analytics_events(project_id, event_type, created_at DESC);

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
