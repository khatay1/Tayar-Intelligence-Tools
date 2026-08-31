-- Harden Website Builder public runtime ingestion.
-- Public lead and analytics rows are accepted only while the referenced
-- Website Builder project is explicitly published (status = completed).

CREATE OR REPLACE FUNCTION public.enforce_published_website_ingestion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_project_type text;
  v_project_status text;
BEGIN
  -- Trusted backend maintenance remains possible.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id, p.type, p.status
    INTO v_owner_id, v_project_type, v_project_status
  FROM public.projects AS p
  WHERE p.id = NEW.project_id
  LIMIT 1;

  IF v_owner_id IS NULL
     OR v_project_type <> 'website-builder'
     OR v_project_status <> 'completed' THEN
    RAISE EXCEPTION 'Website is not currently published';
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Website ingestion owner mismatch';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_published_website_ingestion() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_published_website_lead_ingestion
  ON public.website_leads;

CREATE TRIGGER trg_enforce_published_website_lead_ingestion
BEFORE INSERT ON public.website_leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_published_website_ingestion();

DROP TRIGGER IF EXISTS trg_enforce_published_website_analytics_ingestion
  ON public.website_analytics_events;

CREATE TRIGGER trg_enforce_published_website_analytics_ingestion
BEFORE INSERT ON public.website_analytics_events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_published_website_ingestion();
