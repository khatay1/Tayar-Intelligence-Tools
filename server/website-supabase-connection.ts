import type { SupabaseClient } from '@supabase/supabase-js';
import { createWebsiteConnectionOAuthState } from '../src/modules/website-builder/services/websiteConnectionOAuthStateService';
import { acceptSupabaseOAuthCallback, supabaseAuthorizationUrl } from '../src/modules/website-builder/services/websiteSupabaseOAuthService';
import { storeWebsiteConnectionHandoff } from '../src/modules/website-builder/services/websiteConnectionHandoffService';
import { bindWebsiteSupabaseProject, encodeSupabaseOAuthHandoff,
  listWebsiteSupabaseProjectChoices } from '../src/modules/website-builder/services/websiteSupabaseProjectBindingService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const state = /^[a-f0-9]{64}$/, code = /^[A-Za-z0-9._~-]{1,2048}$/;
const ref = /^[a-z]{20}$/, slug = /^[a-z0-9][a-z0-9-]{0,199}$/;
const responseHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body),
  { status, headers: { ...responseHeaders, 'content-type': 'application/json' } });
function fixedHttps(value: string, callback = false): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash
    || (callback ? url.search !== '?action=callback' : !!url.search)) throw new Error();
  return url;
}

/** Source-only Supabase OAuth endpoint. Browser responses contain sanitized
 * choices or an opaque handoff; raw grants remain in short-lived Vault custody. */
export async function handleWebsiteSupabaseConnection(request: Request, context: {
  platform: Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>; clientId: string; clientSecret: string;
  pkceSecret: string; callback: string; returnUrl: string; platformOrganizationId: string;
  fetcher?: typeof fetch;
}): Promise<Response> {
  let callback: URL, destination: URL;
  try {
    callback = fixedHttps(context.callback, true); destination = fixedHttps(context.returnUrl);
    if (callback.origin !== new URL(request.url).origin || callback.pathname !== new URL(request.url).pathname
      || !/^[A-Za-z0-9_-]{5,128}$/.test(context.clientId) || !context.clientSecret
      || context.pkceSecret.length < 32 || !context.platformOrganizationId) throw new Error();
  } catch { return json(503, { error: 'Supabase connection is not configured.' }); }
  const action = new URL(request.url).searchParams.get('action');
  if (action === 'callback') {
    if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
    const params = new URL(request.url).searchParams;
    if (params.has('error') || !state.test(params.get('state') ?? '') || !code.test(params.get('code') ?? ''))
      return json(400, { error: 'Supabase authorization failed. Start the connection again.' });
    try {
      const grant = await acceptSupabaseOAuthCallback({ stateClient: context.platform,
        state: params.get('state')!, code: params.get('code')!, clientId: context.clientId,
        clientSecret: context.clientSecret, callback: callback.toString(),
        pkceSecret: context.pkceSecret, fetcher: context.fetcher });
      const handoffId = await storeWebsiteConnectionHandoff({ client: context.platform,
        ownerId: grant.ownerId, projectId: grant.projectId, environment: grant.environment,
        provider: 'supabase', userToken: encodeSupabaseOAuthHandoff({ accessToken: grant.accessToken,
          refreshToken: grant.refreshToken, expiresIn: grant.expiresIn, receivedAt: new Date().toISOString() }) });
      destination.hash = new URLSearchParams({ tayar_supabase_handoff: handoffId }).toString();
      return new Response(null, { status: 303, headers: { ...responseHeaders, location: destination.toString() } });
    } catch { return json(409, { error: 'Supabase authorization could not be completed. Start again.' }); }
  }
  if (!['begin', 'options', 'bind'].includes(action ?? '') || request.method !== 'POST')
    return json(405, { error: 'Method not allowed.' });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? ''))
    return json(415, { error: 'JSON request required.' });
  const bearer = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i
    .exec(request.headers.get('authorization') ?? '')?.[1];
  if (!bearer || bearer.length > 16_384) return json(401, { error: 'Sign in required.' });
  let ownerId: string, input: Record<string, unknown>, projectId: string;
  try {
    const identity = await context.platform.auth.getUser(bearer);
    if (identity.error || !identity.data.user || identity.data.user.is_anonymous
      || !uuid.test(identity.data.user.id)) throw new Error();
    ownerId = identity.data.user.id;
  } catch { return json(401, { error: 'Sign in required.' }); }
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 8192) throw new Error();
    const body = await request.text(); if (body.length > 8192) throw new Error();
    input = JSON.parse(body);
    const keys = action === 'begin' ? ['projectId', 'environment'] : action === 'options'
      ? ['projectId', 'handoffId'] : ['projectId', 'handoffId', 'connectionId', 'expectedVersion',
        'projectRef', 'organizationId', 'organizationSlug', 'accountUserId'];
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !keys.includes(key))
      || typeof input.projectId !== 'string' || !uuid.test(input.projectId)
      || (action === 'begin' && !['preview', 'production'].includes(String(input.environment)))
      || (action !== 'begin' && (typeof input.handoffId !== 'string' || !uuid.test(input.handoffId)))) throw new Error();
    if (action === 'bind' && (typeof input.projectRef !== 'string' || !ref.test(input.projectRef)
      || typeof input.organizationId !== 'string' || !input.organizationId
      || typeof input.organizationSlug !== 'string' || !slug.test(input.organizationSlug)
      || typeof input.accountUserId !== 'string' || !input.accountUserId)) throw new Error();
    projectId = input.projectId;
  } catch { return json(400, { error: 'Invalid connection request.' }); }
  try {
    const { data, error } = await context.platform.from('projects').select('id').eq('id', projectId)
      .eq('user_id', ownerId).eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
    if (error) return json(503, { error: 'Project is unavailable.' });
    if (!data) return json(404, { error: 'Project not found.' });
    if (action === 'begin') {
      const rawState = await createWebsiteConnectionOAuthState({ client: context.platform,
        ownerId, projectId, environment: input.environment as 'preview' | 'production',
        provider: 'supabase', isCurrentOwner: () => true });
      return json(200, { authorizationUrl: await supabaseAuthorizationUrl({ clientId: context.clientId,
        callback: callback.toString(), state: rawState, pkceSecret: context.pkceSecret }) });
    }
    if (action === 'options') return json(200, await listWebsiteSupabaseProjectChoices({
      client: context.platform, ownerId, projectId, handoffId: input.handoffId as string,
      platformOrganizationId: context.platformOrganizationId, isCurrentOwner: () => true,
      fetcher: context.fetcher }));
    const result = await bindWebsiteSupabaseProject({ client: context.platform, ownerId, projectId,
      handoffId: input.handoffId as string, connectionId: input.connectionId as string | undefined,
      expectedVersion: input.expectedVersion as number | undefined, projectRef: input.projectRef as string,
      organizationId: input.organizationId as string, organizationSlug: input.organizationSlug as string,
      accountUserId: input.accountUserId as string, platformOrganizationId: context.platformOrganizationId,
      isCurrentOwner: () => true, fetcher: context.fetcher });
    return json(200, { status: 'connected', ...result });
  } catch { return json(409, { error: 'Supabase connection could not be completed. Refresh and try again.' }); }
}
