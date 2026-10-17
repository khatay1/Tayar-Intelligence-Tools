import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnedVercelStagingScope } from './website-owned-vercel-staging';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deployment = /^dpl_[A-Za-z0-9]{8,128}$/;
const digest = /^[a-f0-9]{64}$/;
const read = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join(',') !== 'deploymentId,liveUrl,operationId,runtimeDigest,sourceDigest,status'
    || item.status !== 'runtime-verified' || typeof item.operationId !== 'string' || !uuid.test(item.operationId)
    || typeof item.deploymentId !== 'string' || !deployment.test(item.deploymentId)
    || typeof item.liveUrl !== 'string' || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(item.liveUrl)
    || typeof item.sourceDigest !== 'string' || !digest.test(item.sourceDigest)
    || typeof item.runtimeDigest !== 'string' || !digest.test(item.runtimeDigest)) throw new Error();
  return item as { status: 'runtime-verified'; operationId: string; deploymentId: string; liveUrl: string;
    sourceDigest: string; runtimeDigest: string };
};

/** Persists only release identity already verified against the provider-pinned
 * URL. Exact retries recover by reading; no caller can turn this into activation. */
export async function recordWebsiteProductionRuntimeAttestation(input: {
  client: Pick<SupabaseClient, 'rpc'>; isCurrent(): Promise<boolean>; scope: OwnedVercelStagingScope;
  deploymentId: string; liveUrl: string; sourceDigest: string; runtimeDigest: string;
}) {
  const args = { p_operation_id: input.scope.candidate.operationId, p_project_id: input.scope.candidate.projectId,
    p_owner_id: input.scope.candidate.ownerId, p_scope: structuredClone(input.scope), p_deployment_id: input.deploymentId,
    p_live_url: input.liveUrl, p_source_digest: input.sourceDigest, p_runtime_digest: input.runtimeDigest };
  try {
    if (typeof window !== 'undefined' || !await input.isCurrent()) throw new Error();
    try {
      const result = await input.client.rpc('website_record_production_runtime_attestation', args);
      const receipt = read(result.data); if (result.error || !await input.isCurrent()) throw new Error(); return receipt;
    } catch {
      const result = await input.client.rpc('website_read_production_runtime_attestation', {
        p_operation_id: args.p_operation_id, p_project_id: args.p_project_id, p_owner_id: args.p_owner_id,
      });
      const receipt = read(result.data);
      if (result.error || !await input.isCurrent() || receipt.operationId !== args.p_operation_id
        || receipt.deploymentId !== args.p_deployment_id || receipt.liveUrl !== args.p_live_url
        || receipt.sourceDigest !== args.p_source_digest || receipt.runtimeDigest !== args.p_runtime_digest) throw new Error();
      return receipt;
    }
  } catch { throw new Error('Production runtime attestation unavailable.'); }
}
