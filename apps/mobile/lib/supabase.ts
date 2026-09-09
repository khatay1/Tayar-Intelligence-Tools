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

const nativeFetch = globalThis.fetch.bind(globalThis);

function toolFromRequestBody(body: unknown) {
  if (typeof body !== 'string') return 'ai';
  try {
    const payload = JSON.parse(body) as Record<string, unknown>;
    return typeof payload.tool === 'string' && payload.tool.trim() ? payload.tool.trim() : 'ai';
  } catch {
    return 'ai';
  }
}

function outputFromPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const payload = value as Record<string, unknown>;
  if (typeof payload.content === 'string') return payload.content;
  if (payload.json && typeof payload.json === 'object') {
    try {
      return JSON.stringify(payload.json);
    } catch {
      return '';
    }
  }
  return '';
}

const trackedFetch: typeof globalThis.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  if (response.ok && url.includes('/functions/v1/ai-engine')) {
    const tool = toolFromRequestBody(init?.body);
    void response.clone().json()
      .then((payload) => recordAiOutput(tool, outputFromPayload(payload)))
      .catch(() => undefined);
  }

  return response;
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: nativeAuthStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: trackedFetch,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
