import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnedVercelStagingScope, OwnedVercelStagingStore } from './website-owned-vercel-staging';

/** Service-only adapter; each SQL call rechecks current source, custody and the
 * Production-only backend receipt. An uncertain claim never authorizes a POST. */
export function createWebsiteProductionStagingStore(input: {
  client: Pick<SupabaseClient, 'rpc'>; isCurrent(): Promise<boolean>;
}): OwnedVercelStagingStore {
  const args = (scope: OwnedVercelStagingScope) => ({ p_operation_id: scope.candidate.operationId,
    p_project_id: scope.candidate.projectId, p_owner_id: scope.candidate.ownerId, p_scope: structuredClone(scope) });
  const read = async (scope: OwnedVercelStagingScope) => {
    if (typeof window !== 'undefined' || !await input.isCurrent()) throw new Error();
    const result = await input.client.rpc('website_claim_production_staging', args(scope));
    if (result.error || !await input.isCurrent() || !result.data || typeof result.data !== 'object'
      || Array.isArray(result.data) || Object.keys(result.data).sort().join(',') !== 'deploymentId,issueCreate'
      || typeof result.data.issueCreate !== 'boolean' || result.data.deploymentId !== null
      && (typeof result.data.deploymentId !== 'string' || !/^dpl_[A-Za-z0-9]{8,128}$/.test(result.data.deploymentId))
      || result.data.issueCreate && result.data.deploymentId !== null) throw new Error();
    return result.data as { issueCreate: boolean; deploymentId: string | null };
  };
  return {
    async claim(scope) {
      try { return await read(scope); } catch { throw new Error('Production staging claim unavailable.'); }
    },
    async record(scope, deploymentId) {
      try {
        if (typeof window !== 'undefined' || !/^dpl_[A-Za-z0-9]{8,128}$/.test(deploymentId) || !await input.isCurrent()) throw new Error();
        try {
          const result = await input.client.rpc('website_record_production_staging', { ...args(scope), p_deployment_id: deploymentId });
          if (result.error || result.data !== deploymentId || !await input.isCurrent()) throw new Error();
        } catch {
          const recovered = await read(scope);
          if (recovered.issueCreate || recovered.deploymentId !== deploymentId) throw new Error();
        }
      } catch { throw new Error('Production staging record unavailable.'); }
    },
  };
}
