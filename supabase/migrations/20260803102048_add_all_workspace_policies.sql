/*
# Add all missing RLS policies to workspace_files and activity_log

Previous migration attempts failed partway, leaving workspace_files with RLS enabled but no policies,
and activity_log missing its SELECT policy. This adds all owner-scoped CRUD policies to both tables.
*/

-- workspace_files: full CRUD
DROP POLICY IF EXISTS "select_own_workspace_files" ON workspace_files;
CREATE POLICY "select_own_workspace_files" ON workspace_files FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_workspace_files" ON workspace_files;
CREATE POLICY "insert_own_workspace_files" ON workspace_files FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_workspace_files" ON workspace_files;
CREATE POLICY "update_own_workspace_files" ON workspace_files FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_workspace_files" ON workspace_files;
CREATE POLICY "delete_own_workspace_files" ON workspace_files FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- activity_log: select (insert + delete already exist)
DROP POLICY IF EXISTS "select_own_activity_log" ON activity_log;
CREATE POLICY "select_own_activity_log" ON activity_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
