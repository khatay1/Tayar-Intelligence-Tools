/*
# Create tool_preferences table for favorites, pinned, recently used, and analytics

1. New Table
- `tool_preferences` — per-user tool state
  - id (uuid, pk)
  - user_id (uuid, defaults to auth.uid(), references auth.users)
  - tool_id (text, which tool)
  - is_favorite (bool, default false)
  - is_pinned (bool, default false)
  - last_used (timestamptz, when last opened)
  - use_count (int, default 0, how many times used)
  - created_at, updated_at (timestamptz)

2. Security
- Enable RLS.
- Owner-scoped CRUD.
- Unique constraint on (user_id, tool_id).
*/

CREATE TABLE IF NOT EXISTS tool_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id text NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  last_used timestamptz,
  use_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

ALTER TABLE tool_preferences ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tool_preferences_user_id ON tool_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_preferences_tool_id ON tool_preferences(tool_id);

DROP POLICY IF EXISTS "select_own_tool_preferences" ON tool_preferences;
CREATE POLICY "select_own_tool_preferences" ON tool_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tool_preferences" ON tool_preferences;
CREATE POLICY "insert_own_tool_preferences" ON tool_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tool_preferences" ON tool_preferences;
CREATE POLICY "update_own_tool_preferences" ON tool_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tool_preferences" ON tool_preferences;
CREATE POLICY "delete_own_tool_preferences" ON tool_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
