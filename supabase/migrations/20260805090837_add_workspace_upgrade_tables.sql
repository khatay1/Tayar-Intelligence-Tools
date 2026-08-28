/*
# Workspace Upgrade: Favorites, Pin, Soft Delete, Project Folders
*/

-- Add columns to projects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'favorite') THEN
    ALTER TABLE projects ADD COLUMN favorite boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'pinned') THEN
    ALTER TABLE projects ADD COLUMN pinned boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_at') THEN
    ALTER TABLE projects ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'parent_project_id') THEN
    ALTER TABLE projects ADD COLUMN parent_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add columns to workspace_files
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_files' AND column_name = 'favorite') THEN
    ALTER TABLE workspace_files ADD COLUMN favorite boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_files' AND column_name = 'pinned') THEN
    ALTER TABLE workspace_files ADD COLUMN pinned boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_files' AND column_name = 'deleted_at') THEN
    ALTER TABLE workspace_files ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Create project_items table
CREATE TABLE IF NOT EXISTS project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid,
  title text NOT NULL DEFAULT 'Untitled',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_project_items" ON project_items;
CREATE POLICY "select_own_project_items" ON project_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_project_items" ON project_items;
CREATE POLICY "insert_own_project_items" ON project_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_project_items" ON project_items;
CREATE POLICY "update_own_project_items" ON project_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_project_items" ON project_items;
CREATE POLICY "delete_own_project_items" ON project_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_items_project ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_user ON project_items(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_deleted_at ON workspace_files(deleted_at);
