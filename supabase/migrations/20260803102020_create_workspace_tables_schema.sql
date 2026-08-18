/*
# Create workspace_files and activity_log tables (schema only)

1. New Tables
- `workspace_files` — stores all user-generated files (CVs, documents, translations, projects)
  - id, user_id, name, type, status, data (jsonb), favorite, timestamps
- `activity_log` — records user actions for the activity feed
  - id, user_id, action, tool, metadata, created_at

2. Security
- RLS enabled on both tables. Policies added in a follow-up migration.
*/

CREATE TABLE IF NOT EXISTS workspace_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled',
  type text NOT NULL DEFAULT 'document',
  status text NOT NULL DEFAULT 'draft',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspace_files_user_id ON workspace_files(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_type ON workspace_files(type);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  tool text NOT NULL DEFAULT 'workspace',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
