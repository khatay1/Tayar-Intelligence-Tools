// Environment configuration and validation for Tayar Intelligence Tools

export type AppEnv = 'development' | 'staging' | 'production';

interface EnvConfig {
  appName: string;
  appUrl: string;
  env: AppEnv;
  supabaseUrl: string;
  supabaseAnonKey: string;
  posthogKey: string;
  posthogHost: string;
  gaMeasurementId: string;
  sentryDsn: string;
  stripePublishableKey: string;
}

function getEnv(key: string, fallback = ''): string {
  const val = (import.meta.env as Record<string, string | undefined>)[key];
  return val ?? fallback;
}

export const env: EnvConfig = {
  appName: getEnv('VITE_APP_NAME', 'Tayar Intelligence Tools'),
  appUrl: getEnv('VITE_APP_URL', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
  env: (getEnv('VITE_APP_ENV', 'development') as AppEnv),
  supabaseUrl: getEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
  posthogKey: getEnv('VITE_POSTHOG_KEY'),
  posthogHost: getEnv('VITE_POSTHOG_HOST', 'https://app.posthog.com'),
  gaMeasurementId: getEnv('VITE_GA_MEASUREMENT_ID'),
  sentryDsn: getEnv('VITE_SENTRY_DSN'),
  stripePublishableKey: getEnv('VITE_STRIPE_PUBLISHABLE_KEY'),
};

export const isProd = env.env === 'production';
export const isStaging = env.env === 'staging';
export const isDev = env.env === 'development';

// Warn (not crash) if critical vars are missing in production
if (isProd && typeof window !== 'undefined') {
  if (!env.supabaseUrl) console.warn('[env] VITE_SUPABASE_URL not set');
  if (!env.supabaseAnonKey) console.warn('[env] VITE_SUPABASE_ANON_KEY not set');
}
