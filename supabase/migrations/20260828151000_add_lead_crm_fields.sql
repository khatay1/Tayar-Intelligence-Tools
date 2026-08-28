-- Sprint 85-96: lead CRM fields for qualification, prioritization and follow-up.

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new';

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 0;

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'website_leads_stage_check'
  ) THEN
    ALTER TABLE public.website_leads
      ADD CONSTRAINT website_leads_stage_check
      CHECK (stage IN ('new', 'qualified', 'contacted', 'won', 'lost'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'website_leads_priority_check'
  ) THEN
    ALTER TABLE public.website_leads
      ADD CONSTRAINT website_leads_priority_check
      CHECK (priority BETWEEN 0 AND 2);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_website_leads_project_stage_created_at
  ON public.website_leads(project_id, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_leads_project_priority_created_at
  ON public.website_leads(project_id, priority DESC, created_at DESC);
