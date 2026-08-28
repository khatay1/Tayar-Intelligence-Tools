-- Sprint 11: website builder lead capture

CREATE TABLE IF NOT EXISTS public.website_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_website_leads_project_id
  ON public.website_leads(project_id);
CREATE INDEX IF NOT EXISTS idx_website_leads_user_id_created_at
  ON public.website_leads(user_id, created_at DESC);

DROP POLICY IF EXISTS "website_leads_owner_select" ON public.website_leads;
CREATE POLICY "website_leads_owner_select"
  ON public.website_leads
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "website_leads_owner_update" ON public.website_leads;
CREATE POLICY "website_leads_owner_update"
  ON public.website_leads
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "website_leads_owner_delete" ON public.website_leads;
CREATE POLICY "website_leads_owner_delete"
  ON public.website_leads
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.submit_website_lead(
  p_project_id uuid,
  p_name text,
  p_email text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lead_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_message text := btrim(coalesce(p_message, ''));
BEGIN
  IF char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  IF char_length(v_email) < 3 OR char_length(v_email) > 200 OR position('@' in v_email) < 2 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  IF char_length(v_message) < 1 OR char_length(v_message) > 4000 THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  SELECT projects.user_id
    INTO v_user_id
  FROM public.projects
  WHERE projects.id = p_project_id
    AND projects.type = 'website-builder';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Website project not found';
  END IF;

  INSERT INTO public.website_leads (project_id, user_id, name, email, message)
  VALUES (p_project_id, v_user_id, v_name, v_email, v_message)
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_website_lead(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_website_lead(uuid, text, text, text) TO anon, authenticated;
