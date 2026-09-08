import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { nativeAuthStorage } from './auth-storage';
import { recordAiOutput } from './ai-output-report';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('[mobile] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: nativeAuthStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const invokeFunction = supabase.functions.invoke.bind(supabase.functions);
supabase.functions.invoke = (async (functionName, options) => {
  const response = await invokeFunction(functionName, options);

  if (functionName === 'ai-engine' && !response.error) {
    const body = options?.body && typeof options.body === 'object' && !Array.isArray(options.body)
      ? options.body as Record<string, unknown>
      : {};
    const payload = response.data && typeof response.data === 'object' && !Array.isArray(response.data)
      ? response.data as Record<string, unknown>
      : {};
    const tool = typeof body.tool === 'string' ? body.tool : 'ai';
    let output = typeof payload.content === 'string' ? payload.content : '';

    if (!output && payload.json && typeof payload.json === 'object') {
      try {
        output = JSON.stringify(payload.json);
      } catch {
        output = '';
      }
    }

    recordAiOutput(tool, output);
  }

  return response;
}) as typeof supabase.functions.invoke;

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
