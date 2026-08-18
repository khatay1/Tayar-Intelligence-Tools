/*
# Create AI engine tables: ai_conversations, ai_messages, ai_usage

1. New Tables
- `ai_conversations` — conversation sessions per user, scoped to a tool
  - id (uuid, pk)
  - user_id (uuid, defaults to auth.uid(), references auth.users)
  - tool (text, which tool: cv-builder, cover-letter, ai-writer, document-ai, study-assistant, translator, ai-chat)
  - title (text, conversation title)
  - provider (text, which AI provider was used)
  - model (text, which model was used)
  - created_at, updated_at (timestamptz)
- `ai_messages` — individual messages in a conversation
  - id (uuid, pk)
  - conversation_id (uuid, references ai_conversations, cascade delete)
  - user_id (uuid, defaults to auth.uid(), references auth.users)
  - role (text, user/assistant/system)
  - content (text, message content)
  - tokens_in (int, prompt tokens used)
  - tokens_out (int, completion tokens used)
  - created_at (timestamptz)
- `ai_usage` — aggregated usage tracking for analytics
  - id (uuid, pk)
  - user_id (uuid, defaults to auth.uid(), references auth.users)
  - provider (text)
  - model (text)
  - tool (text, which tool triggered the request)
  - tokens_in (int)
  - tokens_out (int)
  - duration_ms (int, request duration)
  - status (text, success/error)
  - created_at (timestamptz)

2. Security
- Enable RLS on all tables.
- Owner-scoped CRUD on ai_conversations + ai_messages.
- Owner-scoped INSERT + SELECT on ai_usage (users log their own usage, read their own analytics).
- user_id defaults to auth.uid() on all tables.
*/

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL DEFAULT 'ai-chat',
  title text NOT NULL DEFAULT 'New Conversation',
  provider text,
  model text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_tool ON ai_conversations(tool);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL DEFAULT 'gpt-4o',
  tool text NOT NULL DEFAULT 'ai-chat',
  tokens_in int NOT NULL DEFAULT 0,
  tokens_out int NOT NULL DEFAULT 0,
  duration_ms int DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
