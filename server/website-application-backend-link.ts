import { createClient } from '@supabase/supabase-js';
import { getSecretKey, getSupabaseUrl } from '../supabase/functions/_shared/billing.ts';
import { handleWebsiteApplicationBackendLink } from '../src/modules/website-builder/services/websiteApplicationBackendLinkService.ts';

// Source for the generated Edge entrypoint. Build with build:application-backend-link.
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const allowedOrigins = new Set((Deno.env.get('WEBSITE_BACKEND_LINK_ORIGINS') ?? 'https://tayar.se,https://www.tayar.se').split(',').map(value => value.trim()).filter(Boolean));
  const headers = new Headers({ 'cache-control': 'no-store', 'vary': 'Origin' });
  const reply = (status: number, message: string) => new Response(JSON.stringify({ error: message }), { status, headers });
  headers.set('content-type', 'application/json');
  if (origin && !allowedOrigins.has(origin)) return reply(403, 'Origin not allowed.');
  if (origin) headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'Method not allowed.');
  try {
    const platformUrl = getSupabaseUrl();
    const platform = createClient(platformUrl, getSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (resource, init) => {
          try {
            const url = resource instanceof Request ? resource.url : String(resource);
            if (new URL(url).origin !== new URL(platformUrl).origin) throw new Error();
            return await fetch(resource, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
          } catch {
            return new Response(JSON.stringify({ message: 'Platform request unavailable.' }), {
              status: 503, headers: { 'content-type': 'application/json' },
            });
          }
        },
      },
    });
    const result = await handleWebsiteApplicationBackendLink(request, { platform, platformUrl });
    const resultHeaders = new Headers(result.headers);
    headers.forEach((value, key) => resultHeaders.set(key, value));
    return new Response(result.body, { status: result.status, headers: resultHeaders });
  } catch { return reply(503, 'Application backend linking is unavailable.'); }
});
