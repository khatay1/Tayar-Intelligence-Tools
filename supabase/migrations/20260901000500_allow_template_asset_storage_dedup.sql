-- Allow multiple source records to reference the same stored binary.
-- This is required when the same template appears under more than one
-- 24Billions / Google Drive URL. The object is stored once and source
-- provenance remains per template_assets row.

ALTER TABLE public.template_assets
  DROP CONSTRAINT IF EXISTS template_assets_storage_path_key;

CREATE INDEX IF NOT EXISTS idx_template_assets_storage_path
  ON public.template_assets(storage_path)
  WHERE storage_path IS NOT NULL;
