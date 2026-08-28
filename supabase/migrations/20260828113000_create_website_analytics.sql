-- Sprint 15: privacy-friendly website analytics

CREATE TABLE IF NOT EXISTS public.website_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_path text NOT NULL,
  referrer text,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_website_analytics_project_created_at
  ON public.website_analytics_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_analytics_user_created_at
  ON public.website_analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_analytics_session
  ON public.website_analytics_events(project_id, session_id, created_at DESC);

DROP POLICY IF EXISTS "website_analytics_owner_select" ON public.website_analytics_events;
CREATE POLICY "website_analytics_owner_select"
  ON public.website_analytics_events
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "website_analytics_owner_delete" ON public.website_analytics_events;
CREATE POLICY "website_analytics_owner_delete"
  ON public.website_analytics_events
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

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
  IF v_page_path = '' THEN
    v_page_path := '/';
  END IF;

  IF char_length(v_session_id) < 6 THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  SELECT projects.user_id
    INTO v_user_id
  FROM public.projects
  WHERE projects.id = p_project_id
    AND projects.type = 'website-builder';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Website project not found';
  END IF;

  SELECT events.id
    INTO v_event_id
  FROM public.website_analytics_events AS events
  WHERE events.project_id = p_project_id
    AND events.session_id = v_session_id
    AND events.page_path = v_page_path
    AND events.created_at > now() - interval '30 seconds'
  ORDER BY events.created_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  INSERT INTO public.website_analytics_events (
    project_id,
    user_id,
    page_path,
    referrer,
    session_id
  ) VALUES (
    p_project_id,
    v_user_id,
    v_page_path,
    v_referrer,
    v_session_id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_website_page_view(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_website_page_view(uuid, text, text, text) TO anon, authenticated;
