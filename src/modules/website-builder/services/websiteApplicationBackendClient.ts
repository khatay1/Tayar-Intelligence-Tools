import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDefinition } from '../core/application-model';
import { applicationDefinitionDigest } from '../core/application-backend-verification';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function publicBackend(value: unknown, platformUrl: string): ApplicationPublicBackend {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  const record = value as Record<string, unknown>;
  if (typeof record.url !== 'string' || typeof record.projectRef !== 'string' || typeof record.publishableKey !== 'string') throw new Error();
  const backend = { url: record.url, projectRef: record.projectRef, publishableKey: record.publishableKey };
  validateApplicationPublicBackend(backend, platformUrl);
  return backend;
}

/** Browser boundary: secrets go only to the owner-authenticated endpoint, never snapshots/history/AI. */
export function createWebsiteApplicationBackendClient(client: Pick<SupabaseClient, 'rpc' | 'functions'>, platformUrl: string) {
  return {
    async read(projectId: string, definition: ApplicationDefinition): Promise<ApplicationPublicBackend | null> {
      if (!uuid.test(projectId)) throw new Error('Save this project before linking a backend.');
      const expected = await applicationDefinitionDigest(definition);
      try {
        const { data, error } = await client.rpc('website_application_backend_public', { p_project_id: projectId });
        if (error) throw new Error();
        if (data === null) return null;
        if (!data.deployedDefinition) throw new Error();
        const backend = publicBackend(data, platformUrl);
        if (await applicationDefinitionDigest(data.deployedDefinition) !== expected) throw new Error();
        return backend;
      } catch { throw new Error('Backend status is unavailable. Save the project and try again.'); }
    },
    async link(projectId: string, definition: ApplicationDefinition, backend: ApplicationPublicBackend, serviceKey: string, isCurrent: () => boolean): Promise<ApplicationPublicBackend> {
      if (!uuid.test(projectId)) throw new Error('Save this project before linking a backend.');
      const captured = publicBackend(backend, platformUrl);
      if (serviceKey.length < 20 || serviceKey.length > 16_384 || /\s/.test(serviceKey)) throw new Error('Enter a valid backend service key.');
      const expectedRevision = await applicationDefinitionDigest(definition);
      if (!isCurrent()) throw new Error('The project changed. Review the backend connection again.');
      try {
        const { data, error } = await client.functions.invoke('website-application-backend-link', { body: {
          projectId, backend: captured, serviceKey, expectedRevision,
        } });
        if (!isCurrent()) throw new Error();
        if (error || data?.status !== 'linked') throw new Error();
        const linked = publicBackend(data.backend, platformUrl);
        if (linked.url !== captured.url || linked.projectRef !== captured.projectRef || linked.publishableKey !== captured.publishableKey) throw new Error();
        return linked;
      } catch { throw new Error('Backend linking failed. Check the saved schema and connection settings, then enter the service key again.'); }
    },
  };
}
