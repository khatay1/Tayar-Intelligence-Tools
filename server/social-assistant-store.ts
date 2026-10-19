import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSocialAssistantEngineHandler, type SocialAssistantEngineHost, type SocialAssistantHostContext } from './social-assistant-engine';
import { isUntrustedBrowserRuntime } from '../src/modules/website-builder/services/trustedServerRuntime';

/** One host per request, using the caller's verified JWT and authenticated SQL RPCs. */
export function createSocialAssistantRpcHost(client: Pick<SupabaseClient, 'auth' | 'rpc'>): SocialAssistantEngineHost {
  if (isUntrustedBrowserRuntime()) throw Error('Server required.');
  let authenticatedUser: string | null = null;
  return {
    async authenticate(request) {
      authenticatedUser = null;
      const token = /^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(request.headers.get('authorization') ?? '')?.[1];
      if (!token) return null;
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) return null;
      authenticatedUser = data.user.id;
      return { userId: authenticatedUser };
    },
    async loadContext(actor, scope) {
      if (!authenticatedUser || actor.userId !== authenticatedUser) return null;
      const { data, error } = await client.rpc('get_social_hub_assistant_context', {
        p_scope_id: scope.scopeId, p_conversation_id: scope.conversationId, p_message_id: scope.messageId,
      });
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
      const context = data as unknown as SocialAssistantHostContext;
      if (!context.input || context.input.scopeId !== scope.scopeId || context.input.messageId !== scope.messageId
        || typeof context.input.text !== 'string' || typeof context.input.language !== 'string'
        || typeof context.input.enabled !== 'boolean' || typeof context.input.humanAssigned !== 'boolean'
        || !Array.isArray(context.input.knowledge) || context.input.knowledge.length > 50
        || context.input.knowledge.some(answer => !answer || answer.scopeId !== scope.scopeId || typeof answer.id !== 'string'
          || typeof answer.question !== 'string' || typeof answer.answer !== 'string' || typeof answer.language !== 'string'
          || typeof answer.approved !== 'boolean' || typeof answer.sensitive !== 'boolean')
        || typeof context.externalClassification?.approved !== 'boolean'
        || !(context.externalClassification.redactedText === null || typeof context.externalClassification.redactedText === 'string')) return null;
      return { ...context, input: { ...context.input, automationEnabled: false } };
    },
    async reserveClassification(actor, scope) {
      if (!authenticatedUser || actor.userId !== authenticatedUser) return false;
      const { data, error } = await client.rpc('reserve_social_hub_assistant_classification', {
        p_scope_id: scope.scopeId, p_conversation_id: scope.conversationId, p_message_id: scope.messageId,
      });
      return !error && data === true;
    },
  };
}

export function createSocialAssistantDeployment(environment: Record<string, string | undefined>) {
  const disabled = async () => new Response(null, { status: 503 });
  if (environment.SOCIAL_HUB_ENABLED !== 'true' || environment.SOCIAL_ASSISTANT_ENABLED !== 'true') return disabled;
  try {
    const config = { platformOrigin: environment.SUPABASE_URL ?? '', applicationOrigin: environment.SOCIAL_HUB_ORIGIN ?? '',
      publicApiKey: environment.SUPABASE_PUBLISHABLE_KEY ?? environment.SUPABASE_ANON_KEY ?? '' };
    // Validate deployment values at cold start; no platform request is issued here.
    createSocialAssistantEngineHandler(config, { authenticate: async () => null, loadContext: async () => null, reserveClassification: async () => false });
    return async (request: Request) => {
      const authorization = request.headers.get('authorization') ?? '';
      const client = createClient(config.platformOrigin, config.publicApiKey, { global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      return createSocialAssistantEngineHandler(config, createSocialAssistantRpcHost(client))(request);
    };
  } catch { return disabled; }
}
