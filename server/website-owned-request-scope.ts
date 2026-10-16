import type { OwnedApplicationRouteManifest } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';
import type { OwnedReleaseIdentity } from './website-owned-release-identity';

/** Vercel injects VERCEL_ENV and the scheme-less unique VERCEL_URL at runtime.
 * Preview uses only that exact deployment host; never infer a trusted origin
 * from Host, forwarded headers, request parameters or the production alias.
 * Production keeps its owner-verified canonical origin. Neither environment
 * may execute a package compiled for the other environment. */
export function resolveOwnedRuntimeRequestManifest(manifest: OwnedApplicationRouteManifest,
  identity: OwnedReleaseIdentity, environment: NodeJS.ProcessEnv = process.env): OwnedApplicationRouteManifest {
  if (identity.projectId !== manifest.projectId || !['preview', 'production'].includes(identity.environment)
    || environment.VERCEL_ENV !== identity.environment) throw new Error('Customer runtime environment is unavailable.');
  if (identity.environment === 'production') return manifest;
  const hostname = environment.VERCEL_URL;
  if (typeof hostname !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(hostname)) {
    throw new Error('Customer runtime environment is unavailable.');
  }
  return { ...manifest, applicationOrigin: `https://${hostname}` };
}
