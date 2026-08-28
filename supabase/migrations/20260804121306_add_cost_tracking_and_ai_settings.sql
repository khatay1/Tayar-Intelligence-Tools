/*
# Add Cost Tracking and AI Settings Tables

1. Modified Tables
- `ai_usage`: add `cost_usd` (numeric, nullable) column for per-request cost tracking
  - Cost is calculated server-side based on provider pricing

2. New Tables
- `ai_settings`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid())
  - `tool` (text, not null) — the tool id (cv-builder, ai-chat, etc.)
  - `model` (text) — selected model id
  - `temperature` (real, default 0.7) — creativity 0-2
  - `max_tokens` (integer, default 4096) — max output tokens
  - `created_at`, `updated_at` (timestamptz)
  - Unique constraint on (user_id, tool)

3. Security
- Enable RLS on ai_settings
- Owner-scoped CRUD: authenticated users can only access their own settings
*/

-- Add cost column to ai_usage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage' AND column_name = 'cost_usd'
  ) THEN
    ALTER TABLE ai_usage ADD COLUMN cost_usd numeric(10,6) DEFAULT 0;
  END IF;
END $$;

-- Create ai_settings table
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  model text,
  temperature real DEFAULT 0.7,
  max_tokens integer DEFAULT 4096,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool)
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_settings" ON ai_settings;
CREATE POLICY "select_own_ai_settings" ON ai_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ai_settings" ON ai_settings;
CREATE POLICY "insert_own_ai_settings" ON ai_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ai_settings" ON ai_settings;
CREATE POLICY "update_own_ai_settings" ON ai_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ai_settings" ON ai_settings;
CREATE POLICY "delete_own_ai_settings" ON ai_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_settings_user_tool ON ai_settings(user_id, tool);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
