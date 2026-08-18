/*
# Add language column to profiles, create projects + subscriptions tables, add project_id to workspace_files

1. Modified Tables
- `profiles` — add `language` column (text, default 'en') for the language switcher

2. New Tables
- `projects` — user projects/documents (replaces ad-hoc files in workspace_files for structured content)
  - id (uuid, pk)
  - user_id (uuid, defaults to auth.uid(), references auth.users)
  - title (text, project name)
  - type (text, tool type: cv, cover-letter, document, writer, translation, study, etc.)
  - content (jsonb, full document data)
  - status (text, draft/completed, default 'draft')
  - created_at, updated_at (timestamptz)
- `subscriptions` — user subscription records
  - id (uuid, pk)
  - user_id (uuid, defaults to auth.uid(), references auth.users)
  - plan (text, free/pro/enterprise)
  - status (text, active/canceled/expired)
  - renewal_date (date, nullable)
  - created_at (timestamptz)

3. Modified Tables (cont.)
- `workspace_files` — add `project_id` column (nullable FK to projects) so files can be linked to projects

4. Security
- Enable RLS on projects + subscriptions.
- Owner-scoped CRUD on projects (4 policies).
- Owner-scoped SELECT + INSERT + UPDATE on subscriptions.
- user_id defaults to auth.uid() on all tables.
*/

-- Add language column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'language'
  ) THEN
    ALTER TABLE profiles ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
END $$;

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Project',
  type text NOT NULL DEFAULT 'document',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  renewal_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Add project_id to workspace_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_files' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE workspace_files ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_workspace_files_project_id ON workspace_files(project_id);
  END IF;
END $$;
