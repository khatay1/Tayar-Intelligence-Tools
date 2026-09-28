import { assertDedicatedApplicationAuthSettings } from './websiteApplicationAuthSettingsService';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDefinition } from '../core/application-model';
import { assertApplicationBackendRevision, type ApplicationRevisionReader } from '../core/application-backend-verification';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';
import { readApplicationDefinition } from '../core/application-validation';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDedicatedServiceKey(key: string, ref: string): boolean {
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return claims.role === 'service_role' && claims.ref === ref && claims.iss === 'supabase';
  } catch { return false; }
}

/** Server runtime only: never serialize the service key or this client into a project snapshot. */
export function createDedicatedApplicationRevisionReader(
  backend: ApplicationPublicBackend,
  platformUrl: string,
  serviceKey: string,
): ApplicationRevisionReader {
  if (typeof window !== 'undefined') throw new Error('Application service credentials require a server runtime.');
  validateApplicationPublicBackend(backend, platformUrl);
  if (!isDedicatedServiceKey(serviceKey, backend.projectRef)) throw new Error('A dedicated backend service credential is required.');
  const backendUrl = backend.url;
  const client = createClient(backendUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const target = input instanceof Request ? input.url : String(input);
        if (target !== `${backendUrl}/rest/v1/rpc/app_deployed_definition`
          && target !== `${backendUrl}/rest/v1/rpc/app_form_request_revision`) {
          throw new Error('Unexpected application revision endpoint.');
        }
        return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) });
      },
    },
  });
  return {
    url: backendUrl,
    async readDeployedDefinition() {
      try {
        const { data, error } = await client.rpc('app_deployed_definition');
        if (error || !data) throw new Error();
        return data;
      } catch { throw new Error('Dedicated application revision is unavailable.'); }
    },
    async readFormRequestRevision() {
      try {
        const { data, error } = await client.rpc('app_form_request_revision');
        if (error || data !== 2) throw new Error();
        return data;
      } catch { throw new Error('Dedicated application request capability is unavailable.'); }
    },
  };
}

/** Trusted server operation; the platform RPC is service-role-only and compares the saved snapshot under lock. */
export async function recordVerifiedWebsiteApplicationBackend(input: {
  platform: Pick<SupabaseClient, 'rpc'>;
  platformUrl: string;
  projectId: string;
  definition: ApplicationDefinition;
  backend: ApplicationPublicBackend;
  revisionReader: ApplicationRevisionReader;
}): Promise<void> {
  if (typeof window !== 'undefined') throw new Error('Application backend registration requires a server runtime.');
  const { projectId, platformUrl, platform, revisionReader } = input;
  if (!uuid.test(projectId)) throw new Error('Invalid Tayar project ID.');
  if (!input.definition) throw new Error('Missing application definition.');
  const definition = readApplicationDefinition(input.definition);
  const backend = { ...input.backend };
  validateApplicationPublicBackend(backend, platformUrl);
  await assertApplicationBackendRevision(definition, backend, platformUrl, revisionReader);
  try {
    const { error } = await platform.rpc('website_record_application_backend', {
      p_project_id: projectId,
      p_backend_ref: backend.projectRef,
      p_publishable_key: backend.publishableKey,
      p_deployed_definition: definition,
    });
    if (error) throw new Error();
  } catch { throw new Error('Application backend could not be recorded against the current project revision.'); }
}

/** Trusted server preflight only. Call after authorizing the project owner.
 * A successful check is NOT permission to publish: auth/routes/runtime gates still apply.
 */
export async function verifySavedWebsiteApplicationBackend(input: {
  platform: Pick<SupabaseClient, 'rpc'>;
  platformUrl: string;
  projectId: string;
  definition: ApplicationDefinition;
  createRevisionReader: (backend: ApplicationPublicBackend) => Promise<ApplicationRevisionReader>;
}): Promise<ApplicationPublicBackend> {
  if (typeof window !== 'undefined') throw new Error('Application backend verification requires a server runtime.');
  const { projectId, platformUrl, platform, createRevisionReader } = input;
  if (!input.definition) throw new Error('Missing application definition.');
  if (!uuid.test(projectId)) throw new Error('Invalid Tayar project ID.');
  const definition = readApplicationDefinition(input.definition);
  const readBinding = async () => {
    let data: unknown;
    try {
      const result = await platform.rpc('website_application_backend_record', { p_project_id: projectId });
      if (result.error) throw new Error();
      data = result.data;
    } catch { throw new Error('Saved application backend is unavailable.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Saved application backend is unavailable.');
    const record = data as Record<string, unknown>;
    if (typeof record.url !== 'string' || typeof record.projectRef !== 'string' || typeof record.publishableKey !== 'string') {
      throw new Error('Invalid saved application backend.');
    }
    const backend = { url: record.url, projectRef: record.projectRef, publishableKey: record.publishableKey };
    validateApplicationPublicBackend(backend, platformUrl);
    await assertApplicationBackendRevision(definition, backend, platformUrl, {
      url: backend.url,
      async readDeployedDefinition() { return record.deployedDefinition; },
    });
    return backend;
  };
  const backend = await readBinding();
  let reader: ApplicationRevisionReader;
  try { reader = await createRevisionReader({ ...backend }); }
  catch { throw new Error('Dedicated application credentials are unavailable.'); }
  await Promise.all([
    assertApplicationBackendRevision(definition, backend, platformUrl, reader),
    assertDedicatedApplicationAuthSettings(definition, backend, platformUrl),
  ]);
  // Detect saves, deletion and backend rebinding during the remote request.
  const current = await readBinding();
  if (current.url !== backend.url || current.projectRef !== backend.projectRef || current.publishableKey !== backend.publishableKey) {
    throw new Error('Application backend binding changed during verification.');
  }
  return backend;
}
