import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { assertOwnedApplicationBackendRevision, assertOwnedApplicationFormRequestCapability,
  type ApplicationRevisionReader } from '../src/modules/website-builder/core/application-backend-verification';
import { assertOwnedApplicationAuthSettings } from '../src/modules/website-builder/services/websiteApplicationAuthSettingsService';

export interface OwnedSupabaseRuntimeReader extends ApplicationRevisionReader {
  /** A privileged, customer-project-scoped catalog reader must check every
   * exposed table's actual RLS, grants and policy expressions, plus role RPCs.
   * This is deliberately separate from editable definition metadata. */
  verifyLiveSecurity(definition: ApplicationDefinition): Promise<boolean>;
}

/** All reads must target the exact verified customer project. A matching
 * definition or successful Auth settings call alone cannot assert RLS readiness. */
export async function verifyOwnedSupabaseApplicationRuntime(input: {
  definition: ApplicationDefinition;
  backend: ApplicationPublicBackend;
  expectedProjectRef: string;
  reader: OwnedSupabaseRuntimeReader;
  formsRequired: boolean;
}): Promise<void> {
  if (typeof window !== 'undefined') throw new Error('Customer backend verification requires a server runtime.');
  const backend = { ...input.backend };
  validateOwnedApplicationPublicBackend(backend, input.expectedProjectRef);
  if (input.reader.url !== backend.url || typeof input.reader.verifyLiveSecurity !== 'function') {
    throw new Error('Customer backend security verification is unavailable.');
  }
  const definition = readApplicationDefinition(input.definition);
  await assertOwnedApplicationBackendRevision(definition, backend, input.expectedProjectRef, input.reader);
  if (input.formsRequired || definition.tables.length) {
    await assertOwnedApplicationFormRequestCapability(backend, input.expectedProjectRef, input.reader);
  }
  await assertOwnedApplicationAuthSettings(definition, backend, input.expectedProjectRef);
  try {
    if (!await input.reader.verifyLiveSecurity(structuredClone(definition))) throw new Error();
  } catch { throw new Error('Customer backend RLS and grants could not be verified.'); }
}
