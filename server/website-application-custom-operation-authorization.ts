import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const maxResponseBytes = 64 * 1024;

async function readBounded(response: Response): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d{1,8}$/.test(declared) || Number(declared) > maxResponseBytes)) throw new Error();
  if (!response.body) throw new Error();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}

/** Verifies an application user's token with that application's Auth service,
 * then checks declared actor roles through the user's own RLS-bound role RPC.
 * Platform identities and editable JWT metadata are never authorization inputs.
 */
export async function authorizePublishedCustomOperationActor(input: {
  backend: ApplicationPublicBackend;
  expectedProjectRef: string;
  accessToken: string;
  specification: unknown;
  operationId: string;
  fetcher?: typeof fetch;
}): Promise<{ userId: string } | null> {
  const { backend, expectedProjectRef, accessToken, specification, operationId } = input;
  if (!record(specification) || !safeId(operationId) || accessToken.length > 3500 || !tokenPattern.test(accessToken)) return null;
  let operations: unknown[];
  let actors: unknown[];
  try {
    validateOwnedApplicationPublicBackend(backend, expectedProjectRef);
    operations = Array.isArray(specification.operations) && specification.operations.length <= 100 ? specification.operations : [];
    actors = Array.isArray(specification.actors) && specification.actors.length <= 100 ? specification.actors : [];
  } catch { return null; }
  const matches = operations.filter((value): value is JsonRecord => record(value) && value.id === operationId);
  if (matches.length !== 1 || matches[0].execution !== 'custom' || !Array.isArray(matches[0].actorIds)
    || matches[0].actorIds.length === 0 || matches[0].actorIds.length > 100) return null;
  const actorIds = matches[0].actorIds;
  if (actorIds.some(value => !safeId(value))) return null;
  const selectedActors = actors.filter((value): value is JsonRecord => record(value) && actorIds.includes(value.id));
  if (selectedActors.length !== actorIds.length || selectedActors.some(actor => !safeId(actor.id)
    || (actor.roleId !== undefined && !safeId(actor.roleId)))) return null;

  const fetcher = input.fetcher ?? fetch;
  const headers = { apikey: backend.publishableKey, authorization: `Bearer ${accessToken}`, accept: 'application/json' };
  const request = async (path: string, method: 'GET' | 'POST') => fetcher(new URL(path, `${backend.url}/`), {
    method, headers: { ...headers, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: '{}' } : {}), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  try {
    const auth = await request('auth/v1/user', 'GET');
    if (!auth.ok) return null;
    const user = await readBounded(auth);
    if (!record(user) || typeof user.id !== 'string' || !userIdPattern.test(user.id) || user.is_anonymous === true) return null;

    const permittedRoleIds = new Set(selectedActors.flatMap(actor => typeof actor.roleId === 'string' ? [actor.roleId] : []));
    if (permittedRoleIds.size > 0) {
      const roleResponse = await request('rest/v1/rpc/app_my_roles', 'POST');
      if (!roleResponse.ok) return null;
      const roles = await readBounded(roleResponse);
      if (!Array.isArray(roles) || roles.some(role => !safeId(role))) return null;
      if (![...permittedRoleIds].some(role => roles.includes(role))) return null;
    }
    return { userId: user.id };
  } catch { return null; }
}
