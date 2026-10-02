import type { SupabaseClient } from '@supabase/supabase-js';
import { createWebsiteConnectionOAuthState } from '../src/modules/website-builder/services/websiteConnectionOAuthStateService';
import { storeWebsiteConnectionHandoff } from '../src/modules/website-builder/services/websiteConnectionHandoffService';
import { acceptVercelOAuthCallback, vercelAuthorizationUrl } from '../src/modules/website-builder/services/websiteVercelOAuthService';
import { bindWebsiteVercelProject, encodeVercelOAuthHandoff,
  listWebsiteVercelProjectChoices } from '../src/modules/website-builder/services/websiteVercelProjectChoiceService';
import { createWebsiteOwnedSourceReader } from './website-owned-source-reader';
import { disconnectOwnedVercelProject } from './website-owned-vercel-disconnect';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const state = /^[a-f0-9]{64}$/, code = /^[A-Za-z0-9._~-]{1,2048}$/;
const providerId = /^[A-Za-z0-9_-]{3,128}$/;
const configurationId = /^icfg_[A-Za-z0-9]{8,128}$/;
const teamId = /^team_[A-Za-z0-9]{8,128}$/;
const vercelProjectId = /^prj_[A-Za-z0-9]{8,128}$/;
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

type GithubTarget = { repositoryId: string; repositoryOwner: string;
  repositoryName: string; productionBranch: string };

/** Source-only Vercel External Integration endpoint. Raw grants stay in Vault;
 * repository identity comes from a trusted GitHub registry loader. */
export async function handleWebsiteVercelConnection(request: Request, context: {
  platform: Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>; integrationSlug: string;
  clientId: string; clientSecret: string; callback: string; returnUrl: string;
  platformAccountId: string; loadGithubTarget(input: { ownerId: string; projectId: string }): Promise<GithubTarget | null>;
  fetcher?: typeof fetch;
}): Promise<Response> {
  const action = new URL(request.url).searchParams.get('action');
  let callback: URL, destination: URL | null = null;
  try {
    callback = fixedHttps(context.callback, true);
    const current = new URL(request.url);
    if (callback.origin !== current.origin || callback.pathname !== current.pathname
      || (action !== 'disconnect' && (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(context.integrationSlug)
        || !providerId.test(context.clientId) || context.clientSecret.length < 20
        || /[\r\n]/.test(context.clientSecret) || !providerId.test(context.platformAccountId)))) throw new Error();
    if (action !== 'disconnect') destination = fixedHttps(context.returnUrl);
  } catch { return json(503, { error: 'Vercel connection is not configured.' }); }
  if (action === 'callback') {
    if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
    const params = new URL(request.url).searchParams, callbackTeamId = params.get('teamId');
    if (params.has('error') || !state.test(params.get('state') ?? '')
      || !code.test(params.get('code') ?? '')
      || !configurationId.test(params.get('configurationId') ?? '')
      || (callbackTeamId !== null && !teamId.test(callbackTeamId))) {
      return json(400, { error: 'Vercel authorization failed. Start the connection again.' });
    }
    try {
      const grant = await acceptVercelOAuthCallback({ stateClient: context.platform,
        state: params.get('state')!, code: params.get('code')!, callbackTeamId,
        callbackConfigurationId: params.get('configurationId')!, clientId: context.clientId,
        clientSecret: context.clientSecret, callback: callback.toString(), fetcher: context.fetcher });
      const handoffId = await storeWebsiteConnectionHandoff({ client: context.platform,
        ownerId: grant.ownerId, projectId: grant.projectId, environment: grant.environment,
        provider: 'vercel', userToken: encodeVercelOAuthHandoff({ accessToken: grant.accessToken,
          userId: grant.userId, teamId: grant.teamId, configurationId: grant.configurationId,
          receivedAt: new Date().toISOString() }) });
      destination!.hash = new URLSearchParams({ tayar_vercel_handoff: handoffId }).toString();
      return new Response(null, { status: 303, headers: { ...responseHeaders, location: destination!.toString() } });
    } catch { return json(409, { error: 'Vercel authorization could not be completed. Start again.' }); }
  }
  if (!['begin', 'options', 'bind', 'disconnect'].includes(action ?? '') || request.method !== 'POST')
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
    const raw = await request.text(); if (raw.length > 8192) throw new Error();
    input = JSON.parse(raw);
    const keys = action === 'begin' ? ['projectId', 'environment'] : action === 'options'
      ? ['projectId', 'handoffId'] : action === 'disconnect'
        ? ['projectId', 'connectionId', 'expectedVersion', 'operationId', 'commitId']
        : ['projectId', 'handoffId', 'connectionId', 'expectedVersion',
          'userId', 'accountId', 'configurationId', 'vercelProjectId'];
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !keys.includes(key))
      || typeof input.projectId !== 'string' || !uuid.test(input.projectId)
      || (action === 'begin' && !['preview', 'production'].includes(String(input.environment)))
      || (['options', 'bind'].includes(action ?? '')
        && (typeof input.handoffId !== 'string' || !uuid.test(input.handoffId)))) throw new Error();
    if (action === 'disconnect' && (Object.keys(input).sort().join(',') !== keys.sort().join(',')
      || typeof input.connectionId !== 'string' || !uuid.test(input.connectionId)
      || !Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1
      || typeof input.operationId !== 'string' || !uuid.test(input.operationId)
      || typeof input.commitId !== 'string' || !uuid.test(input.commitId))) throw new Error();
    if (action === 'bind' && (!providerId.test(String(input.userId))
      || !providerId.test(String(input.accountId)) || !configurationId.test(String(input.configurationId))
      || !vercelProjectId.test(String(input.vercelProjectId)))) throw new Error();
    projectId = input.projectId;
  } catch { return json(400, { error: 'Invalid connection request.' }); }
  try {
    const { data, error } = await context.platform.from('projects').select('id').eq('id', projectId)
      .eq('user_id', ownerId).eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
    if (error) return json(503, { error: 'Project is unavailable.' });
    if (!data) return json(404, { error: 'Project not found.' });
    const isCurrentOwner = async () => {
      try {
        const currentIdentity = await context.platform.auth.getUser(bearer);
        if (currentIdentity.error || currentIdentity.data.user?.id !== ownerId
          || currentIdentity.data.user.is_anonymous) return false;
        const currentProject = await context.platform.from('projects').select('id').eq('id', projectId)
          .eq('user_id', ownerId).eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
        return !currentProject.error && currentProject.data?.id === projectId;
      } catch { return false; }
    };
    if (action === 'begin') {
      const rawState = await createWebsiteConnectionOAuthState({ client: context.platform,
        ownerId, projectId, environment: input.environment as 'preview' | 'production',
        provider: 'vercel', isCurrentOwner: () => true });
      return json(200, { authorizationUrl: vercelAuthorizationUrl({
        integrationSlug: context.integrationSlug, state: rawState }) });
    }
    if (action === 'disconnect') {
      const connectionId = input.connectionId as string, expectedVersion = input.expectedVersion as number;
      const operationId = input.operationId as string, commitId = input.commitId as string;
      const completedArgs = { p_connection_id: connectionId, p_project_id: projectId, p_owner_id: ownerId,
        p_expected_connection_version: expectedVersion, p_operation_id: operationId, p_commit_id: commitId };
      const completed = await context.platform.rpc('website_reconcile_completed_vercel_runtime_disconnect', completedArgs);
      if (completed.error || !await isCurrentOwner()) throw new Error();
      if (completed.data != null) {
        const exact = completed.data as Record<string, unknown>;
        if (!exact || typeof exact !== 'object' || Array.isArray(exact)
          || Object.keys(exact).sort().join(',') !== 'connectionVersion,receiptVersion'
          || exact.connectionVersion !== expectedVersion + 1
          || !(exact.receiptVersion == null
            || (Number.isSafeInteger(exact.receiptVersion) && Number(exact.receiptVersion) > 0))) throw new Error();
        return json(200, { status: 'disconnected', connectionId,
          version: exact.connectionVersion, installation: 'retained' });
      }
      const connection = await createWebsiteOwnedSourceReader(context.platform)
        .readConnection(connectionId, projectId, ownerId);
      if (!connection || connection.provider !== 'vercel' || connection.version !== expectedVersion
        || connection.status === 'disconnected') throw new Error();
      const result = await disconnectOwnedVercelProject({ client: context.platform, connection,
        operationId, commitId, isCurrentOwner, fetcher: context.fetcher });
      return json(200, { status: 'disconnected', connectionId, ...result });
    }
    const target = await context.loadGithubTarget({ ownerId, projectId });
    if (!target) return json(409, { error: 'Connect the correct GitHub repository first.' });
    const shared = { client: context.platform, ownerId, projectId,
      handoffId: input.handoffId as string, platformAccountId: context.platformAccountId,
      ...target, isCurrentOwner: () => true, fetcher: context.fetcher };
    if (action === 'options') return json(200, await listWebsiteVercelProjectChoices(shared));
    const result = await bindWebsiteVercelProject({ ...shared,
      connectionId: input.connectionId as string | undefined,
      expectedVersion: input.expectedVersion as number | undefined,
      userId: input.userId as string, accountId: input.accountId as string,
      configurationId: input.configurationId as string,
      vercelProjectId: input.vercelProjectId as string });
    return json(200, { status: 'connected', ...result });
  } catch { return json(409, { error: action === 'disconnect'
    ? 'Vercel connection could not be disconnected. Refresh and try again.'
    : 'Vercel connection could not be completed. Refresh and try again.' }); }
}
