import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDefinition } from '../core/application-model';
import { assertApplicationBackendRevision, type ApplicationRevisionReader } from '../core/application-backend-verification';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';
import { readApplicationDefinition } from '../core/application-validation';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trusted server operation; the platform RPC is service-role-only and compares the saved snapshot under lock. */
export async function recordVerifiedWebsiteApplicationBackend(input: {
  platform: Pick<SupabaseClient, 'rpc'>;
  platformUrl: string;
  projectId: string;
  definition: ApplicationDefinition;
  backend: ApplicationPublicBackend;
  revisionReader: ApplicationRevisionReader;
}): Promise<void> {
  if (!uuid.test(input.projectId)) throw new Error('Invalid Tayar project ID.');
  const definition = readApplicationDefinition(input.definition);
  validateApplicationPublicBackend(input.backend, input.platformUrl);
  await assertApplicationBackendRevision(definition, input.backend, input.platformUrl, input.revisionReader);
  const { error } = await input.platform.rpc('website_record_application_backend', {
    p_project_id: input.projectId,
    p_backend_ref: input.backend.projectRef,
    p_publishable_key: input.backend.publishableKey,
    p_deployed_definition: definition,
  });
  if (error) throw new Error('Application backend could not be recorded against the current project revision.');
}
