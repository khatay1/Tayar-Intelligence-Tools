-- Sprint 97-108: immutable website publish releases and rollback metadata.

CREATE TABLE IF NOT EXISTS public.website_publish_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  release_note text NOT NULL DEFAULT '',
  published_url text NOT NULL,
  storage_prefix text NOT NULL,
  editor_fingerprint text NOT NULL,
  snapshot jsonb NOT NULL,
  file_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_publish_versions_release_note_length CHECK (char_length(release_note) <= 500),
  CONSTRAINT website_publish_versions_storage_prefix_length CHECK (char_length(storage_prefix) <= 700),
  CONSTRAINT website_publish_versions_fingerprint_length CHECK (char_length(editor_fingerprint) <= 2000000)
);

ALTER TABLE public.website_publish_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_website_publish_versions_project_created_at
  ON public.website_publish_versions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_publish_versions_user_created_at
  ON public.website_publish_versions(user_id, created_at DESC);

DROP POLICY IF EXISTS "website_publish_versions_owner_select" ON public.website_publish_versions;
CREATE POLICY "website_publish_versions_owner_select"
  ON public.website_publish_versions
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "website_publish_versions_owner_insert" ON public.website_publish_versions;
CREATE POLICY "website_publish_versions_owner_insert"
  ON public.website_publish_versions
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = website_publish_versions.project_id
        AND projects.user_id = (SELECT auth.uid())
        AND projects.type = 'website-builder'
    )
  );

DROP POLICY IF EXISTS "website_publish_versions_owner_delete" ON public.website_publish_versions;
CREATE POLICY "website_publish_versions_owner_delete"
  ON public.website_publish_versions
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
