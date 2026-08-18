/*
# Create user onboarding table

1. New Tables
- `user_onboarding`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `user_type` (text: student, job-seeker, professional, business-owner, freelancer)
  - `full_name` (text)
  - `country` (text)
  - `profession` (text)
  - `main_goal` (text)
  - `language` (text: en, ar, sv)
  - `recommended_tools` (text[] — array of tool ids)
  - `tour_completed` (boolean, default false)
  - `tour_skipped` (boolean, default false)
  - `tour_steps_seen` (text[] — array of step ids)
  - `wizard_completed` (boolean, default false)
  - `achievements` (jsonb — map of achievement id to unlocked timestamp)
  - `progress` (integer, default 0 — 0-100 percentage)
  - `sample_content_seeded` (boolean, default false)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `user_onboarding`.
- Owner-scoped CRUD: each authenticated user can only access their own onboarding row.
- `user_id` defaults to `auth.uid()` so inserts without explicit user_id succeed.
*/

CREATE TABLE IF NOT EXISTS user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text DEFAULT '',
  full_name text DEFAULT '',
  country text DEFAULT '',
  profession text DEFAULT '',
  main_goal text DEFAULT '',
  language text DEFAULT 'en',
  recommended_tools text[] DEFAULT '{}',
  tour_completed boolean DEFAULT false,
  tour_skipped boolean DEFAULT false,
  tour_steps_seen text[] DEFAULT '{}',
  wizard_completed boolean DEFAULT false,
  achievements jsonb DEFAULT '{}',
  progress integer DEFAULT 0,
  sample_content_seeded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_onboarding" ON user_onboarding;
CREATE POLICY "select_own_onboarding" ON user_onboarding FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_onboarding" ON user_onboarding;
CREATE POLICY "insert_own_onboarding" ON user_onboarding FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_onboarding" ON user_onboarding;
CREATE POLICY "update_own_onboarding" ON user_onboarding FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_onboarding" ON user_onboarding;
CREATE POLICY "delete_own_onboarding" ON user_onboarding FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
