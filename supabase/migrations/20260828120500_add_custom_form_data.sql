-- Sprint 17: custom form builder submission payloads

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS page_path text;

UPDATE public.website_leads
SET form_data = jsonb_build_object(
  'name', name,
  'email', email,
  'message', message
)
WHERE form_data = '{}'::jsonb;

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
BEGIN
  IF p_form_data IS NULL OR jsonb_typeof(p_form_data) <> 'object' THEN
    RAISE EXCEPTION 'Invalid form data';
  END IF;

  IF octet_length(p_form_data::text) > 12000 THEN
    RAISE EXCEPTION 'Form data is too large';
  END IF;

  SELECT count(*) INTO v_field_count FROM jsonb_object_keys(p_form_data);
  IF v_field_count < 1 OR v_field_count > 30 THEN
    RAISE EXCEPTION 'Invalid number of form fields';
  END IF;

  SELECT projects.user_id
    INTO v_user_id
  FROM public.projects
  WHERE projects.id = p_project_id
    AND projects.type = 'website-builder';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Website project not found';
  END IF;

  SELECT left(value, 120)
    INTO v_name
  FROM jsonb_each_text(p_form_data)
  WHERE lower(key) = 'name' OR lower(key) LIKE '%name%'
  ORDER BY CASE WHEN lower(key) = 'name' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT left(lower(value), 200)
    INTO v_email
  FROM jsonb_each_text(p_form_data)
  WHERE lower(key) = 'email' OR lower(key) LIKE '%email%'
  ORDER BY CASE WHEN lower(key) = 'email' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT left(value, 4000)
    INTO v_message
  FROM jsonb_each_text(p_form_data)
  WHERE lower(key) = 'message'
     OR lower(key) LIKE '%message%'
     OR lower(key) LIKE '%comment%'
     OR lower(key) LIKE '%details%'
  ORDER BY CASE WHEN lower(key) = 'message' THEN 0 ELSE 1 END
  LIMIT 1;

  IF coalesce(btrim(v_name), '') = '' THEN
    v_name := 'Website visitor';
  END IF;

  IF coalesce(btrim(v_message), '') = '' THEN
    SELECT left(string_agg(key || ': ' || value, E'\n' ORDER BY key), 4000)
      INTO v_message
    FROM jsonb_each_text(p_form_data);
  END IF;

  INSERT INTO public.website_leads (
    project_id,
    user_id,
    name,
    email,
    message,
    form_data,
    page_path
  )
  VALUES (
    p_project_id,
    v_user_id,
    left(coalesce(v_name, 'Website visitor'), 120),
    left(coalesce(v_email, ''), 200),
    left(coalesce(v_message, 'Form submission'), 4000),
    p_form_data,
    nullif(v_page_path, '')
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_website_form(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_website_form(uuid, jsonb, text) TO anon, authenticated;
