/*
# Create cvs table for CV drafts

1. New Tables
- `cvs`
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, defaults to auth.uid())
- `title` (text, name of the CV draft)
- `data` (jsonb, full CV document data)
- `template` (text, selected template name)
- `ats_score` (integer, 0-100)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
2. Security
- Enable RLS on `cvs`.
- Owner-scoped CRUD: each authenticated user can only access their own CV drafts.
*/

CREATE TABLE IF NOT EXISTS cvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled CV',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  template text NOT NULL DEFAULT 'modern',
  ats_score integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cvs" ON cvs;
CREATE POLICY "select_own_cvs" ON cvs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cvs" ON cvs;
CREATE POLICY "insert_own_cvs" ON cvs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cvs" ON cvs;
CREATE POLICY "update_own_cvs" ON cvs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cvs" ON cvs;
CREATE POLICY "delete_own_cvs" ON cvs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs(user_id);
