import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const supabaseUrl = env.supabaseUrl.trim();
const supabaseAnonKey = env.supabaseAnonKey.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase browser configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before starting Tayar.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'tayar-auth',
    },
  }
);
