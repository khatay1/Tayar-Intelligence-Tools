import type { GitHubSourceFile } from '../src/modules/website-builder/services/websiteGithubExportTransport';

export interface OwnedReleaseIdentity {
  version: 1;
  projectId: string;
  environment: 'preview' | 'production';
  runtimeDigest: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const prefix = 'const __TAYAR_RELEASE_IDENTITY__ = ';
const valid = (value: unknown): value is OwnedReleaseIdentity => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join(',') === 'environment,projectId,runtimeDigest,version'
    && item.version === 1 && typeof item.projectId === 'string' && uuid.test(item.projectId)
    && ['preview', 'production'].includes(String(item.environment))
    && typeof item.runtimeDigest === 'string' && /^[a-f0-9]{64}$/.test(item.runtimeDigest);
};

async function runtimeDigest(runtime: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(runtime));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Hash all executable bytes, including the manifest, pages, public backend
 * binding and compiled handler. Only the identity line excludes itself. */
export async function bindOwnedReleaseIdentity(runtime: string, projectId: string,
  environment: 'preview' | 'production'): Promise<string> {
  const identity: OwnedReleaseIdentity = { version: 1, projectId, environment, runtimeDigest: await runtimeDigest(runtime) };
  if (!valid(identity)) throw new Error('Customer runtime identity is unavailable.');
  return `${prefix}${JSON.stringify(identity)};\n${runtime}`;
}

/** Read only the server-compiled captured artifact, never an HTTP manifest.
 * Rehashing detects modification after source capture or a stale identity. */
export async function readOwnedReleaseIdentity(files: GitHubSourceFile[]): Promise<OwnedReleaseIdentity> {
  const matches = files.filter(file => file.path === 'api/application.js');
  if (matches.length !== 1) throw new Error('Customer runtime identity is unavailable.');
  const source = matches[0].content, end = source.indexOf('\n');
  if (!source.startsWith(prefix) || end < 0 || end > 512 || source[end - 1] !== ';') throw new Error('Customer runtime identity is unavailable.');
  const identity: unknown = JSON.parse(source.slice(prefix.length, end - 1));
  if (!valid(identity) || await runtimeDigest(source.slice(end + 1)) !== identity.runtimeDigest) throw new Error('Customer runtime identity is unavailable.');
  return { ...identity };
}

/** Public read-only identity handshake: no schema, rows, credentials or Auth
 * state. The fresh challenge rejects cached proof. Not behavioral evidence. */
export function serveOwnedReleaseIdentity(request: Request, identity: OwnedReleaseIdentity): Response {
  const headers = { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store',
    'vercel-cdn-cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...headers, allow: 'GET' } });
  const url = new URL(request.url), challenge = url.searchParams.get('challenge');
  if (!valid(identity) || !challenge || !uuid.test(challenge)
    || url.searchParams.get('tayarRoute') !== 'release-proof'
    || [...url.searchParams.keys()].some(key => !['tayarRoute', 'challenge'].includes(key))
    || url.searchParams.getAll('challenge').length !== 1 || url.searchParams.getAll('tayarRoute').length !== 1) {
    return new Response(null, { status: 400, headers });
  }
  return Response.json({ ...identity, challenge }, { headers });
}
