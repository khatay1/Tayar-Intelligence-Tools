-- Tayar Template Library mirror foundation.
-- Binary assets live in Supabase Storage, not in Git/Vercel.
-- The source record below reflects user-confirmed redistribution rights and should
-- remain auditable separately from the provider's public marketing copy.

CREATE TABLE IF NOT EXISTS public.template_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  base_url text NOT NULL,
  license_basis text NOT NULL,
  can_redistribute boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, base_url)
);

CREATE TABLE IF NOT EXISTS public.template_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.template_sources(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'uncategorized',
  format text NOT NULL DEFAULT 'file',
  source_page_url text,
  source_download_url text NOT NULL,
  original_filename text NOT NULL,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  sha256 text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ready', 'failed', 'disabled')),
  error_message text,
  is_public boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_download_url),
  UNIQUE (storage_path)
);

CREATE TABLE IF NOT EXISTS public.template_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.template_sources(id) ON DELETE RESTRICT,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '',
  requested_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  bytes_imported bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_template_assets_catalog
  ON public.template_assets(status, is_public, category, format);

CREATE INDEX IF NOT EXISTS idx_template_assets_source
  ON public.template_assets(source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_import_runs_source
  ON public.template_import_runs(source_id, created_at DESC);

ALTER TABLE public.template_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_sources_public_read" ON public.template_sources;
CREATE POLICY "template_sources_public_read"
  ON public.template_sources
  FOR SELECT
  TO anon, authenticated
  USING (active = true AND can_redistribute = true);

DROP POLICY IF EXISTS "template_sources_admin_write" ON public.template_sources;
CREATE POLICY "template_sources_admin_write"
  ON public.template_sources
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "template_assets_public_read" ON public.template_assets;
CREATE POLICY "template_assets_public_read"
  ON public.template_assets
  FOR SELECT
  TO anon, authenticated
  USING (status = 'ready' AND is_public = true);

DROP POLICY IF EXISTS "template_assets_admin_write" ON public.template_assets;
CREATE POLICY "template_assets_admin_write"
  ON public.template_assets
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "template_import_runs_admin_only" ON public.template_import_runs;
CREATE POLICY "template_import_runs_admin_only"
  ON public.template_import_runs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'template-library',
  'template-library',
  true,
  52428800,
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/octet-stream',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "template_library_admin_insert" ON storage.objects;
CREATE POLICY "template_library_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'template-library'
  AND public.is_admin()
);

DROP POLICY IF EXISTS "template_library_admin_update" ON storage.objects;
CREATE POLICY "template_library_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'template-library'
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'template-library'
  AND public.is_admin()
);

DROP POLICY IF EXISTS "template_library_admin_delete" ON storage.objects;
CREATE POLICY "template_library_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'template-library'
  AND public.is_admin()
);

INSERT INTO public.template_sources (
  provider,
  base_url,
  license_basis,
  can_redistribute,
  active,
  metadata
)
VALUES (
  '24billions',
  'https://24billions.com',
  'User-confirmed redistribution rights for the Tayar project on 2026-08-31',
  true,
  true,
  jsonb_build_object(
    'note', 'Keep source URLs and checksums for every mirrored asset',
    'ingestion_policy', 'Admin-only allowlisted mirror'
  )
)
ON CONFLICT (provider, base_url) DO UPDATE
SET license_basis = EXCLUDED.license_basis,
    can_redistribute = EXCLUDED.can_redistribute,
    active = EXCLUDED.active,
    metadata = EXCLUDED.metadata,
    updated_at = now();
