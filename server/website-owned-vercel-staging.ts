import { verifyOwnedVercelProject } from './website-owned-vercel-project';
import { readProductionSourceCandidate, type ProductionSourceCandidate } from './website-production-source-candidate';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deployment = /^dpl_[A-Za-z0-9]{8,128}$/;
const providerId = /^[A-Za-z0-9_-]{3,128}$/;
const environmentName = /^[A-Z][A-Z0-9_]{1,99}$/;
type Target = Parameters<typeof verifyOwnedVercelProject>[0];

export interface OwnedVercelStagingScope {
  candidate: ProductionSourceCandidate;
  accountId: string; projectId: string; repositoryId: string; sourceBranch: string;
  runtimeEnvironmentReceiptVersion: number; runtimeEnvironmentIds: Record<string, string>;
}

/** Implementations must persist the complete immutable scope and claim before
 * issueCreate=true. A retry of a claimed operation must never issueCreate again.
 * Conflicting scopes must be rejected, and record must reconcile response loss.
 * No HTTP/UI entry is enabled until the private durable adapter is installed. */
export interface OwnedVercelStagingStore {
  claim(scope: OwnedVercelStagingScope): Promise<{ issueCreate: boolean; deploymentId: string | null }>;
  record(scope: OwnedVercelStagingScope, deploymentId: string): Promise<void>;
}

/** Stages a Production-target Git build with domain assignment disabled.
 * Only a durable claimant can create once; uncertainty is observation-only.
 * "staged" proves provider build identity and absence of assigned aliases,
 * not application runtime, behavior, provider integration or delivery readiness. */
export async function stageOwnedVercelProductionDeployment(input: Target & {
  candidate: ProductionSourceCandidate; store: OwnedVercelStagingStore;
  runtimeEnvironmentReceiptVersion: number; runtimeEnvironmentIds: Record<string, string>;
}) {
  try {
    const candidate = structuredClone(readProductionSourceCandidate(input.candidate));
    const ids = Object.fromEntries(Object.entries(input.runtimeEnvironmentIds).sort(([a], [b]) => a.localeCompare(b)));
    if (typeof window !== 'undefined' || !uuid.test(candidate.operationId)
      || candidate.sourceDigest === candidate.previewSourceDigest || input.accessToken.length > 4096
      || !Number.isSafeInteger(input.runtimeEnvironmentReceiptVersion) || input.runtimeEnvironmentReceiptVersion < 1
      || !Object.keys(ids).length || Object.keys(ids).length > 64
      || Object.entries(ids).some(([key, value]) => !environmentName.test(key) || !providerId.test(value))
      || new Set(Object.values(ids)).size !== Object.keys(ids).length) throw new Error();
    const scope: OwnedVercelStagingScope = { candidate, accountId: input.accountId, projectId: input.projectId,
      repositoryId: input.repositoryId, sourceBranch: `tayar/${candidate.projectId}/production`,
      runtimeEnvironmentReceiptVersion: input.runtimeEnvironmentReceiptVersion, runtimeEnvironmentIds: ids };
    if (input.productionBranch === scope.sourceBranch) throw new Error();
    if (!await verifyOwnedVercelProject(input)) throw new Error();
    const fetcher = input.fetcher ?? fetch;
    const query = input.accountId !== input.userId ? `?teamId=${encodeURIComponent(input.accountId)}` : '';
    async function json(response: Response) {
      if (Number(response.headers.get('content-length') ?? 0) > 262_144 || !response.body) throw new Error();
      const reader = response.body.getReader(); let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength; if (size > 262_144) throw new Error(); chunks.push(part.value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value as Record<string, unknown>;
    }
    async function read(path: string) {
      if (!await input.isCurrent()) throw new Error();
      const response = await fetcher(`https://api.vercel.com${path}`, { method: 'GET', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' } });
      if (response.status !== 200) throw new Error(); return json(response);
    }
    const matches = (value: Record<string, unknown>) => {
      const meta = value.meta as Record<string, unknown> | undefined;
      return value.projectId === scope.projectId && value.ownerId === scope.accountId && value.target === 'production'
        && meta?.githubCommitSha === candidate.headSha && meta.githubCommitRef === scope.sourceBranch
        && meta.tayarProductionOperationId === candidate.operationId && meta.tayarSourceDigest === candidate.sourceDigest;
    };
    const verifyEnvironment = async () => {
      const suffix = input.accountId !== input.userId ? `&teamId=${encodeURIComponent(input.accountId)}` : '';
      const environment = await read(`/v10/projects/${input.projectId}/env?decrypt=false${suffix}`);
      if (!Array.isArray(environment.envs) || environment.envs.length > 1000) throw new Error();
      for (const [key, id] of Object.entries(ids)) {
        const found = environment.envs.filter(value => value && typeof value === 'object' && !Array.isArray(value)
          && value.key === key && Array.isArray(value.target) && value.target.includes('production'));
        if (found.length !== 1 || found[0].id !== id || found[0].gitBranch != null
          || found[0].customEnvironmentIds != null && (!Array.isArray(found[0].customEnvironmentIds) || found[0].customEnvironmentIds.length)) throw new Error();
      }
    };
    await verifyEnvironment();
    const selectedProject = await read(`/v9/projects/${input.projectId}${query}`);
    if (selectedProject.id !== input.projectId || selectedProject.accountId !== input.accountId
      || typeof selectedProject.name !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(selectedProject.name)) throw new Error();
    const projectName = selectedProject.name;
    // Caller-owned store objects never receive the mutable scope used below.
    const claim = await input.store.claim(structuredClone(scope));
    if (typeof claim.issueCreate !== 'boolean' || claim.deploymentId !== null && !deployment.test(claim.deploymentId)
      || claim.issueCreate && claim.deploymentId !== null || !await input.isCurrent()) throw new Error();
    let deploymentId = claim.deploymentId;
    if (claim.issueCreate) {
      if (!await verifyOwnedVercelProject(input)) throw new Error();
      await verifyEnvironment();
      // The claim is already durable. Every failure below is uncertain; this
      // function has no POST retry, even after 429/5xx or malformed responses.
      try {
        const response = await fetcher(`https://api.vercel.com/v13/deployments${query}`, {
          method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: projectName, project: input.projectId, target: 'production',
            autoAssignCustomDomains: false,
            gitSource: { type: 'github', repoId: input.repositoryId, ref: scope.sourceBranch, sha: candidate.headSha },
            meta: { tayarProductionOperationId: candidate.operationId, tayarSourceDigest: candidate.sourceDigest } }),
        });
        if (![200, 201].includes(response.status)) throw new Error();
        const created = await json(response);
        if (typeof created.id !== 'string' || !deployment.test(created.id) || !matches(created)) throw new Error();
        deploymentId = created.id;
      } catch { /* Recover only by observing the exact operation below. */ }
    }
    if (!deploymentId) {
      const filter = new URLSearchParams({ projectId: scope.projectId, target: 'production', limit: '20',
        branch: scope.sourceBranch, sha: candidate.headSha });
      if (input.accountId !== input.userId) filter.set('teamId', input.accountId);
      const result = await read(`/v6/deployments?${filter}`);
      if (!Array.isArray(result.deployments) || result.deployments.length > 20) throw new Error();
      if (result.pagination && typeof result.pagination === 'object' && !Array.isArray(result.pagination)
        && (result.pagination as Record<string, unknown>).next != null) throw new Error();
      const found = result.deployments.filter((value): value is Record<string, unknown> => !!value
        && typeof value === 'object' && !Array.isArray(value) && matches(value as Record<string, unknown>));
      if (found.length > 1) throw new Error();
      if (!found.length) {
        if (!await input.isCurrent()) throw new Error();
        return { status: 'observing' as const, deploymentId: null, sourceCommitSha: candidate.headSha, liveUrl: null };
      }
      const id = found[0].uid ?? found[0].id;
      if (typeof id !== 'string' || !deployment.test(id)) throw new Error(); deploymentId = id;
    }
    if (!await input.isCurrent()) throw new Error();
    await input.store.record(structuredClone(scope), deploymentId);
    const observe = async () => {
      const value = await read(`/v13/deployments/${deploymentId}${query}`);
      if (value.id !== deploymentId || !matches(value) || !Array.isArray(value.alias) || value.alias.length
        || value.aliasAssigned !== false && value.aliasAssigned !== null && value.aliasAssigned !== 0
        || !['QUEUED', 'INITIALIZING', 'ANALYZING', 'BUILDING', 'DEPLOYING', 'READY', 'ERROR', 'CANCELED'].includes(String(value.readyState))) throw new Error();
      let liveUrl: string | null = null;
      if (value.readyState === 'READY') {
        if (typeof value.url !== 'string' || !/^[a-z0-9-]+\.vercel\.app$/.test(value.url)) throw new Error();
        liveUrl = `https://${value.url}`;
      }
      return { state: value.readyState, liveUrl };
    };
    const first = await observe(), second = await observe();
    if (JSON.stringify(first) !== JSON.stringify(second) || !await input.isCurrent()) throw new Error();
    await verifyEnvironment();
    if (!await verifyOwnedVercelProject(input)) throw new Error();
    return { status: second.state === 'READY' ? 'staged' as const
      : second.state === 'ERROR' || second.state === 'CANCELED' ? 'deployment-failed' as const : 'observing' as const,
      deploymentId, sourceCommitSha: candidate.headSha, liveUrl: second.liveUrl };
  } catch { throw new Error('Production staging is unavailable.'); }
}
