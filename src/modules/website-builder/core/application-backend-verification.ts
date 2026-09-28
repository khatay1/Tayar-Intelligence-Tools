import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from './application-data-runtime';

export interface ApplicationRevisionReader {
  /** The trusted server client must target this exact dedicated app backend. */
  url: string;
  readDeployedDefinition(): Promise<unknown>;
  readFormRequestRevision?(): Promise<unknown>;
}

/** Check the separately upgraded runtime capability on the same dedicated
 * backend. Definition equality alone cannot prove that legacy tables have the
 * request identity column/index/trigger. */
export async function assertApplicationFormRequestCapability(backend: ApplicationPublicBackend, platformUrl: string, reader: ApplicationRevisionReader): Promise<void> {
  validateApplicationPublicBackend(backend, platformUrl);
  if (reader.url !== backend.url || !reader.readFormRequestRevision) throw new Error('Application form request capability is unavailable.');
  try {
    if (await reader.readFormRequestRevision() !== 1) throw new Error();
  } catch { throw new Error('Application form request capability is unavailable.'); }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/** Server-side preflight. The reader uses the dedicated app's service-only revision RPC. */
export async function assertApplicationBackendRevision(
  definition: ApplicationDefinition,
  backend: ApplicationPublicBackend,
  platformUrl: string,
  reader: ApplicationRevisionReader,
): Promise<void> {
  validateApplicationPublicBackend(backend, platformUrl);
  if (reader.url !== backend.url) throw new Error('Application revision reader targets another backend.');
  const expected = readApplicationDefinition(definition);
  let deployed: ApplicationDefinition;
  try { deployed = readApplicationDefinition(await reader.readDeployedDefinition()); }
  catch { throw new Error('Application backend revision could not be verified.'); }
  if (canonical(deployed) !== canonical(expected)) throw new Error('Application backend schema revision does not match the project.');
}

/** Stable across PostgreSQL JSONB key ordering; arrays retain semantic order. */
export async function applicationDefinitionDigest(definition: ApplicationDefinition): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(readApplicationDefinition(definition)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
