import type { SupabaseClient } from '@supabase/supabase-js';
import { captureWebsiteByoPublishTargets } from './website-byo-publish-targets';
import { createWebsiteOwnedSourceReader } from './website-owned-source-reader';
import { captureWebsiteOwnedProductionSource } from './website-owned-source-capture';
import { readProductionSourceCandidate } from './website-production-source-candidate';
import { createWebsiteProductionStagingStore } from './website-production-staging-store';
import { stageOwnedVercelProductionDeployment, type OwnedVercelStagingScope } from './website-owned-vercel-staging';
import { readOwnedReleaseIdentity } from './website-owned-release-identity';
import { verifyOwnedDeployedRuntime } from './website-owned-runtime-verification';
import { recordWebsiteProductionRuntimeAttestation } from './website-production-runtime-attestation';
import { verifyOwnedDeployedBehavior } from './website-owned-behavior-verification';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider = /^[A-Za-z0-9_-]{3,128}$/;
const object = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
};
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function readTarget(value: unknown, input: { operationId: string; projectId: string; ownerId: string }) {
  const target = object(value), raw = object(target.scope), candidate = readProductionSourceCandidate(raw.candidate);
  if (Object.keys(target).sort().join(',') !== 'scope,vercelConnectionId,vercelConnectionVersion'
    || Object.keys(raw).sort().join(',') !== 'accountId,candidate,projectId,repositoryId,runtimeEnvironmentIds,runtimeEnvironmentReceiptVersion,sourceBranch'
    || candidate.operationId !== input.operationId || candidate.projectId !== input.projectId || candidate.ownerId !== input.ownerId
    || candidate.sourceDigest === candidate.previewSourceDigest
    || typeof target.vercelConnectionId !== 'string' || !uuid.test(target.vercelConnectionId)
    || !Number.isSafeInteger(target.vercelConnectionVersion) || Number(target.vercelConnectionVersion) < 1
    || typeof raw.accountId !== 'string' || !provider.test(raw.accountId)
    || typeof raw.projectId !== 'string' || !/^prj_[A-Za-z0-9]{8,128}$/.test(raw.projectId)
    || typeof raw.repositoryId !== 'string' || !/^\d+$/.test(raw.repositoryId)
    || raw.sourceBranch !== `tayar/${input.projectId}/production`
    || !Number.isSafeInteger(raw.runtimeEnvironmentReceiptVersion) || Number(raw.runtimeEnvironmentReceiptVersion) < 1) throw new Error();
  const ids = object(raw.runtimeEnvironmentIds);
  // This coordinator currently supports the independently verified public
  // Supabase pair. Secret/provider receipt orchestration remains separate.
  if (Object.keys(ids).sort().join(',') !== 'SUPABASE_ANON_KEY,SUPABASE_URL'
    || Object.values(ids).some(value => typeof value !== 'string' || !provider.test(value))
    || new Set(Object.values(ids)).size !== 2) throw new Error();
  return { scope: structuredClone(raw) as unknown as OwnedVercelStagingScope,
    vercelConnectionId: target.vercelConnectionId, vercelConnectionVersion: Number(target.vercelConnectionVersion) };
}

/** Trusted coordinator for an existing prepared source/runtime receipt.
 * Only application/owner/operation scope enters; SQL selects all provider IDs.
 * It has no environment mutation, export, promotion or delivery callback. */
export async function stageWebsiteProductionCandidate(input: {
  client: Pick<SupabaseClient, 'rpc'>; operationId: string; projectId: string; ownerId: string;
  platformOrigin: string; platformUrl: string; platformVercelAccountId: string;
  verifyRuntime: Parameters<typeof captureWebsiteOwnedProductionSource>[0]['verifyRuntime'];
  isCurrent(): Promise<boolean>; fetcher?: typeof fetch;
}) {
  try {
    if (typeof window !== 'undefined' || ![input.operationId, input.projectId, input.ownerId].every(value => uuid.test(value))
      || !provider.test(input.platformVercelAccountId) || !await input.isCurrent()) throw new Error();
    const read = async () => {
      if (!await input.isCurrent()) throw new Error();
      const result = await input.client.rpc('website_production_staging_target', {
        p_operation_id: input.operationId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      });
      if (result.error || !await input.isCurrent()) throw new Error(); return readTarget(result.data, input);
    };
    const target = await read(), selected = await captureWebsiteByoPublishTargets({ client: input.client,
      projectId: input.projectId, ownerId: input.ownerId, requireProductionSource: true });
    const github = selected.targets.githubProduction, vercel = selected.targets.vercelProduction;
    if (!github || !vercel || github.connectionId !== target.scope.candidate.githubConnectionId
      || vercel.connectionId !== target.vercelConnectionId || vercel.version !== target.vercelConnectionVersion) throw new Error();
    const reader = createWebsiteOwnedSourceReader(input.client);
    const source = await captureWebsiteOwnedProductionSource({ projectId: input.projectId, ownerId: input.ownerId,
      platformOrigin: input.platformOrigin, platformUrl: input.platformUrl, reader, verifyRuntime: input.verifyRuntime,
      previewGithubConnectionId: selected.targets.githubPreview.connectionId, productionGithubConnectionId: github.connectionId,
      expectedPreviewSourceDigest: target.scope.candidate.previewSourceDigest });
    const identity = await readOwnedReleaseIdentity(source.files);
    if (source.sourceDigest !== target.scope.candidate.sourceDigest || source.snapshotDigest !== target.scope.candidate.snapshotDigest
      || identity.projectId !== input.projectId || identity.environment !== 'production' || identity.runtimeDigest !== target.scope.candidate.runtimeDigest
      || source.connection.version !== github.version || source.connection.targetId !== target.scope.repositoryId
      || source.vercel.id !== vercel.connectionId || source.vercel.version !== vercel.version
      || source.vercel.accountId !== target.scope.accountId || source.vercel.targetId !== target.scope.projectId
      || source.stripeRuntime || source.emailRuntime || source.capabilities.blockers.length || source.capabilities.needs.integrations
      || source.capabilities.needs.cms) throw new Error();
    let active = true;
    const current = async () => {
      if (!active) return false;
      try {
        active = await input.isCurrent() && canonical(await read()) === canonical(target)
          && await selected.isCurrent() && await source.isCurrent();
      } catch { active = false; }
      return active;
    };
    if (!await current()) throw new Error();
    const result = await input.client.rpc('website_read_vercel_integration_custody', {
      p_connection_id: target.vercelConnectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_connection_version: target.vercelConnectionVersion,
    });
    if (result.error || !await current()) throw new Error();
    const custody = object(result.data);
    if (typeof custody.accessToken !== 'string' || !custody.accessToken || custody.accessToken.length > 4096 || /[\r\n]/.test(custody.accessToken)
      || typeof custody.userId !== 'string' || !provider.test(custody.userId) || custody.environment !== 'production'
      || custody.accountId !== target.scope.accountId || custody.vercelProjectId !== target.scope.projectId
      || custody.repositoryId !== target.scope.repositoryId || typeof custody.repositoryOwner !== 'string'
      || typeof custody.repositoryName !== 'string' || typeof custody.productionBranch !== 'string') throw new Error();
    const staged = await stageOwnedVercelProductionDeployment({ candidate: target.scope.candidate,
      runtimeEnvironmentReceiptVersion: target.scope.runtimeEnvironmentReceiptVersion, runtimeEnvironmentIds: target.scope.runtimeEnvironmentIds,
      store: createWebsiteProductionStagingStore({ client: input.client, isCurrent: current }),
      accessToken: custody.accessToken, userId: custody.userId, accountId: target.scope.accountId,
      platformAccountId: input.platformVercelAccountId, projectId: target.scope.projectId, repositoryId: target.scope.repositoryId,
      repositoryOwner: custody.repositoryOwner, repositoryName: custody.repositoryName, productionBranch: custody.productionBranch,
      isCurrent: current, fetcher: input.fetcher });
    if (!await current()) throw new Error();
    if (staged.status !== 'staged' || !staged.liveUrl) return { ...staged, operationId: input.operationId };
    await verifyOwnedDeployedRuntime({ projectId: input.projectId, environment: 'production', liveUrl: staged.liveUrl,
      files: source.files, isCurrent: current, fetcher: input.fetcher });
    if (!await current()) throw new Error();
    await verifyOwnedDeployedBehavior({ projectId: input.projectId, liveUrl: staged.liveUrl,
      files: source.files, isCurrent: current, fetcher: input.fetcher });
    if (!await current()) throw new Error();
    return recordWebsiteProductionRuntimeAttestation({ client: input.client, isCurrent: current, scope: target.scope,
      deploymentId: staged.deploymentId, liveUrl: staged.liveUrl, sourceDigest: source.sourceDigest,
      runtimeDigest: identity.runtimeDigest });
  } catch { throw new Error('Production candidate staging unavailable.'); }
}
