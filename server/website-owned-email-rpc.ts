import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import type { OwnedEmailRpcClient } from './website-owned-email-store';

const rpcNames = new Set(['app_email_due', 'app_email_enqueue', 'app_email_claim', 'app_email_finish']);

function privateCredential(key: string, projectRef: string): boolean {
  if (typeof key !== 'string' || key.length > 4096 || /\s/.test(key)) return false;
  if (/^sb_secret_[A-Za-z0-9_-]{16,200}$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    const encoded = key.split('.')[1];
    const claims = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)));
    return claims.role === 'service_role' && claims.ref === projectRef && claims.iss === 'supabase'
      && typeof claims.exp === 'number' && claims.exp * 1000 > Date.now();
  } catch { return false; }
}

async function readReply(response: Response): Promise<unknown> {
  if (!response.body) throw new Error();
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 150_000) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { reader.releaseLock(); }
}

/** A private server client for a fixed customer backend and four fixed RPCs.
 * Public/publishable credentials and cross-project legacy tokens fail closed. */
export function createOwnedEmailRpcClient(input: {
  backend: ApplicationPublicBackend; expectedProjectRef: string; secretKey: string; fetcher?: typeof fetch;
}): OwnedEmailRpcClient {
  if (typeof window !== 'undefined') throw new Error('Server-only email client.');
  validateOwnedApplicationPublicBackend(input.backend, input.expectedProjectRef);
  const backendOrigin = new URL(input.backend.url).origin;
  if (!privateCredential(input.secretKey, input.expectedProjectRef) || input.secretKey === input.backend.publishableKey) {
    throw new Error('Customer email credentials unavailable.');
  }
  return {
    async rpc(name, args) {
      if (typeof window !== 'undefined' || !rpcNames.has(name)) return { data: null, error: true };
      try {
        const body = JSON.stringify(args);
        if (body.length > 150_000) throw new Error();
        const response = await (input.fetcher ?? fetch)(`${backendOrigin}/rest/v1/rpc/${name}`, {
          method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5_000),
          headers: { apikey: input.secretKey, 'Content-Type': 'application/json', Accept: 'application/json',
            // New secret keys use only apikey; legacy service JWTs also use Bearer.
            ...(input.secretKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${input.secretKey}` }) }, body,
        });
        if (!response.ok) { await response.body?.cancel(); return { data: null, error: true }; }
        return { data: await readReply(response), error: null };
      } catch { return { data: null, error: true }; }
    },
  };
}
