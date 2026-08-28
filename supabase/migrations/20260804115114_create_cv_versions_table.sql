/*
# Create CV Versions Table for Resume Version History

1. New Tables
- `cv_versions`
  - `id` (uuid, primary key)
  - `cv_id` (uuid, references cvs table, cascade delete)
  - `user_id` (uuid, not null, defaults to auth.uid())
  - `version_label` (text, e.g. "v1", "v2")
  - `data` (jsonb, full CV data snapshot)
  - `template` (text, template id used)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on cv_versions
- Owner-scoped CRUD: authenticated users can only access their own versions
*/

CREATE TABLE IF NOT EXISTS cv_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_id uuid REFERENCES cvs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  version_label text DEFAULT 'v1',
  data jsonb NOT NULL,
  template text DEFAULT 'modern',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cv_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cv_versions" ON cv_versions;
CREATE POLICY "select_own_cv_versions" ON cv_versions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cv_versions" ON cv_versions;
CREATE POLICY "insert_own_cv_versions" ON cv_versions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cv_versions" ON cv_versions;
CREATE POLICY "delete_own_cv_versions" ON cv_versions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cv_versions_cv_id ON cv_versions(cv_id);
CREATE INDEX IF NOT EXISTS idx_cv_versions_user_id ON cv_versions(user_id);
