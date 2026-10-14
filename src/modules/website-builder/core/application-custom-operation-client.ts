import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublishedCustomOperationScope {
  ownerId: string;
  projectId: string;
  releaseId: string;
  applicationOrigin: string;
  operationIds: readonly string[];
}

export class PublishedCustomOperationClientError extends Error {
  constructor(readonly code: 'unavailable' | 'not-authorized' | 'operation-not-found' | 'invalid-input' | 'execution-failed') {
    super(code);
    this.name = 'PublishedCustomOperationClientError';
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const operationIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const maxInputBytes = 32 * 1024;

function validJson(value: unknown): boolean {
  const ancestors = new Set<object>();
  const visit = (entry: unknown, depth: number): boolean => {
    if (depth > 20) return false;
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') return true;
    if (typeof entry === 'number') return Number.isFinite(entry);
    if (typeof entry !== 'object' || ancestors.has(entry)) return false;
    if (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null) return false;
    ancestors.add(entry);
    const ok = Array.isArray(entry)
      ? entry.every(item => visit(item, depth + 1))
      : Object.entries(entry).every(([, item]) => visit(item, depth + 1));
    ancestors.delete(entry);
    return ok;
  };
  try {
    return visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxInputBytes;
  } catch { return false; }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d{1,8}$/.test(declared) || Number(declared) > maxInputBytes)) throw new Error();
  if (!response.body) throw new Error();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxInputBytes) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

/** Calls the same-origin platform route with a verified, current application session.
 * The server repeats authorization against the immutable release before execution. */
export function createPublishedCustomOperationClient(
  client: Pick<SupabaseClient, 'auth'>,
  scope: PublishedCustomOperationScope,
  fetcher: typeof fetch = fetch,
) {
  const origin = new URL(scope.applicationOrigin);
  if (!uuid.test(scope.ownerId) || !uuid.test(scope.projectId) || !uuid.test(scope.releaseId)
    || origin.protocol !== 'https:' || origin.origin !== scope.applicationOrigin
    || typeof window !== 'undefined' && window.location.origin !== scope.applicationOrigin
    || !Array.isArray(scope.operationIds) || scope.operationIds.some(id => !operationIdPattern.test(id))) {
    throw new PublishedCustomOperationClientError('unavailable');
  }
  const endpoint = new URL('/api/application-operation', origin);
  endpoint.searchParams.set('ownerId', scope.ownerId);
  endpoint.searchParams.set('projectId', scope.projectId);

  return {
    async execute(operationId: string, input: unknown, expectedUserId: string): Promise<unknown> {
      if (!scope.operationIds.includes(operationId) || !operationIdPattern.test(operationId)) {
        throw new PublishedCustomOperationClientError('operation-not-found');
      }
      if (!uuid.test(expectedUserId) || !validJson(input)) throw new PublishedCustomOperationClientError('invalid-input');
      try {
        const session = await client.auth.getSession();
        const token = session.data.session?.access_token;
        if (session.error || !token || token.length > 3500
          || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
          throw new PublishedCustomOperationClientError('not-authorized');
        }
        const identity = await client.auth.getUser(token);
        if (identity.error || !identity.data.user || identity.data.user.is_anonymous || identity.data.user.id !== expectedUserId) {
          throw new PublishedCustomOperationClientError('not-authorized');
        }
        const response = await fetcher(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ releaseId: scope.releaseId, operationId, input }),
        });
        const payload = await readBoundedJson(response) as { result?: unknown; error?: unknown };
        if (!response.ok || !payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'result')) {
          const code = payload && typeof payload === 'object' && typeof payload.error === 'string' ? payload.error : '';
          throw new PublishedCustomOperationClientError(code === 'not_authorized' ? 'not-authorized'
            : code === 'invalid_request' ? 'invalid-input' : code.startsWith('execution') ? 'execution-failed' : 'unavailable');
        }
        const current = await client.auth.getSession();
        const currentUser = current.data.session && await client.auth.getUser(current.data.session.access_token);
        if (current.error || !currentUser || currentUser.error || currentUser.data.user?.id !== expectedUserId
          || currentUser.data.user.is_anonymous) throw new PublishedCustomOperationClientError('not-authorized');
        return payload.result;
      } catch (error) {
        if (error instanceof PublishedCustomOperationClientError) throw error;
        throw new PublishedCustomOperationClientError('unavailable');
      }
    },
  };
}
