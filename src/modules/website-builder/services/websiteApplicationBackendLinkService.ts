import type { SupabaseClient } from '@supabase/supabase-js';
import { readApplicationDefinition } from '../core/application-validation';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';
import { applicationDefinitionDigest, assertApplicationBackendRevision } from '../core/application-backend-verification';
import { assertDedicatedApplicationAuthSettings } from './websiteApplicationAuthSettingsService';
import { createDedicatedApplicationRevisionReader } from './websiteApplicationBackendService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export async function readBoundedJson(request: Request, limit = 32_768): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit || !request.body) throw new Error();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

/** Owner-authenticated linking endpoint. Not a provisioner and never a publish grant.
 * Receives an existing dedicated backend credential over HTTPS, verifies its actual
 * schema, and commits the binding + encrypted credential in one platform transaction.
 */
export async function handleWebsiteApplicationBackendLink(request: Request, context: {
  platform: Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>;
  platformUrl: string;
}): Promise<Response> {
  if (typeof window !== 'undefined') throw new Error('Backend linking requires a server runtime.');
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return response(415, { error: 'JSON request required.' });
  const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token || token.length > 16_384) return response(401, { error: 'Sign in required.' });
  const { platform, platformUrl } = context;
  let ownerId: string;
  try {
    const { data, error } = await platform.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous || !uuid.test(data.user.id)) return response(401, { error: 'Sign in required.' });
    ownerId = data.user.id;
  } catch { return response(401, { error: 'Sign in required.' }); }
  let projectId: string;
  let backend: ApplicationPublicBackend;
  let serviceKey: string;
  let expectedRevision: string;
  try {
    const value = await readBoundedJson(request);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const body = value as Record<string, unknown>;
    if (Object.keys(body).some(key => !['projectId', 'backend', 'serviceKey', 'expectedRevision'].includes(key)) || typeof body.projectId !== 'string' || !uuid.test(body.projectId)) throw new Error();
    if (!body.backend || typeof body.backend !== 'object' || Array.isArray(body.backend)) throw new Error();
    const config = body.backend as Record<string, unknown>;
    if (Object.keys(config).some(key => !['url', 'projectRef', 'publishableKey'].includes(key))
      || typeof config.url !== 'string' || typeof config.projectRef !== 'string' || typeof config.publishableKey !== 'string') throw new Error();
    if (typeof body.serviceKey !== 'string' || body.serviceKey.length < 20 || body.serviceKey.length > 16_384 || /\s/.test(body.serviceKey)) throw new Error();
    if (typeof body.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedRevision)) throw new Error();
    expectedRevision = body.expectedRevision;
    projectId = body.projectId;
    backend = { url: config.url, projectRef: config.projectRef, publishableKey: config.publishableKey };
    serviceKey = body.serviceKey;
    validateApplicationPublicBackend(backend, platformUrl);
  } catch { return response(400, { error: 'Invalid application backend request.' }); }
  try {
    // Read the saved owner-scoped definition, never trust a caller's schema or owner ID.
    const { data: project, error } = await platform.from('projects').select('content')
      .eq('id', projectId).eq('user_id', ownerId).eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
    if (error) return response(503, { error: 'Project is unavailable.' });
    if (!project) return response(404, { error: 'Project not found.' });
    if (!project.content?.application) return response(409, { error: 'Save an application definition before linking its backend.' });
    const definition = readApplicationDefinition(project.content.application);
    if (await applicationDefinitionDigest(definition) !== expectedRevision) return response(409, { error: 'Save and refresh the application before linking its backend.' });
    const reader = createDedicatedApplicationRevisionReader(backend, platformUrl, serviceKey);
    await Promise.all([
      assertApplicationBackendRevision(definition, backend, platformUrl, reader),
      assertDedicatedApplicationAuthSettings(definition, backend, platformUrl),
    ]);
    const result = await platform.rpc('website_link_application_backend', {
      p_project_id: projectId, p_owner_id: ownerId, p_backend_ref: backend.projectRef,
      p_publishable_key: backend.publishableKey, p_deployed_definition: definition, p_service_key: serviceKey,
    });
    if (result.error) return response(409, { error: 'Backend link could not be committed. Verify the saved project and backend ownership.' });
    return response(200, { status: 'linked', backend });
  } catch { return response(409, { error: 'Application backend could not be verified or linked.' }); }
}

/** Credential lookup is server-only and tied to the currently saved binding/ref. */
export async function createStoredApplicationRevisionReader(input: {
  platform: Pick<SupabaseClient, 'rpc'>;
  platformUrl: string;
  projectId: string;
  backend: ApplicationPublicBackend;
}) {
  if (typeof window !== 'undefined') throw new Error('Backend credentials require a server runtime.');
  const { platform, platformUrl, projectId } = input;
  const backend = { ...input.backend };
  if (!uuid.test(projectId)) throw new Error('Invalid Tayar project ID.');
  validateApplicationPublicBackend(backend, platformUrl);
  try {
    const { data, error } = await platform.rpc('website_application_backend_credential', {
      p_project_id: projectId, p_backend_ref: backend.projectRef,
    });
    if (error || typeof data !== 'string' || !data) throw new Error();
    return createDedicatedApplicationRevisionReader(backend, platformUrl, data);
  } catch { throw new Error('Dedicated application credential is unavailable.'); }
}
