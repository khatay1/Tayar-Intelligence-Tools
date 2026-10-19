import { createClient } from '@supabase/supabase-js';
import { createSocialConnectEdge } from './social-connect-endpoint';
import { createSocialHubRpcWorkers } from './social-hub-worker-store';
import { createSocialAssistantDeployment } from './social-assistant-store';

/** Cold-start server composition. All channels remain off until explicitly enabled. */
export function createSocialHubDeployment(environment: Record<string, string | undefined>) {
  const unavailable = () => new Response(null, { status: 503 });
  let connect: (request: Request) => Promise<Response> = async () => unavailable();
  try {
    const origin = new URL(environment.SOCIAL_HUB_ORIGIN ?? '');
    const callback = environment.SOCIAL_META_CALLBACK_URL ?? environment.SOCIAL_CONNECT_CALLBACK_URL;
    if (origin.protocol !== 'https:' || origin.origin !== environment.SOCIAL_HUB_ORIGIN
      || (environment.SOCIAL_CONNECT_ENDPOINT_PATH && environment.SOCIAL_CONNECT_ENDPOINT_PATH !== '/api/social-connect')
      || (callback && callback !== `${origin.origin}/api/social-connect-callback`)) throw Error();
    connect = createSocialConnectEdge(environment);
  } catch { /* Do not accept a callback path the deployed router cannot serve. */ }
  let webhook: (request: Request, opaqueId: string) => Promise<Response> = async () => unavailable();
  if (environment.SOCIAL_HUB_ENABLED === 'true') {
    try {
      const url = new URL(environment.SUPABASE_URL ?? '');
      const key = environment.SUPABASE_SECRET_KEY ?? environment.SUPABASE_SERVICE_ROLE_KEY;
      if (url.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
        || url.origin + '/' !== url.href || !key || /\s/.test(key)) throw Error();
      const client = createClient(url.origin, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const workers = createSocialHubRpcWorkers(client, { enabled: () => true });
      // GET verification needs a separately scoped Vault token; until provisioned it stays denied.
      webhook = workers.webhook;
    } catch { /* Sanitized unavailable response; never log configuration. */ }
  }
  return { connect, webhook, assistant: createSocialAssistantDeployment(environment) };
}
