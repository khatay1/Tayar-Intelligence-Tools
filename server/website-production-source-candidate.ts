import type { SupabaseClient } from '@supabase/supabase-js';
import type { SourceReader } from '../src/modules/website-builder/services/websiteGithubExportSourceService';
import { websiteProjectReleaseDigest } from '../src/modules/website-builder/core/website-project-release-digest';

type Client = Pick<SupabaseClient, 'rpc'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[a-f0-9]{64}$/, sha = /^[a-f0-9]{40}$/;
export interface ProductionSourceCandidate {
  status: 'source-prepared'; operationId: string; projectId: string; ownerId: string;
  previewOperationId: string; githubConnectionId: string;
  previewSourceDigest: string; snapshotDigest: string; runtimeDigest: string; sourceDigest: string; headSha: string;
}
const keys = ['status', 'operationId', 'projectId', 'ownerId', 'previewOperationId', 'githubConnectionId',
  'previewSourceDigest', 'snapshotDigest', 'runtimeDigest', 'sourceDigest', 'headSha'].sort().join(',');
function parse(value: unknown): ProductionSourceCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== keys || row.status !== 'source-prepared'
    || !['operationId', 'projectId', 'ownerId', 'previewOperationId', 'githubConnectionId'].every(key => typeof row[key] === 'string' && uuid.test(row[key] as string))
    || !['previewSourceDigest', 'snapshotDigest', 'runtimeDigest', 'sourceDigest'].every(key => typeof row[key] === 'string' && digest.test(row[key] as string))
    || typeof row.headSha !== 'string' || !sha.test(row.headSha) || row.operationId === row.previewOperationId) throw new Error();
  return row as unknown as ProductionSourceCandidate;
}

/** Metadata handoff, never a deployment/runtime/behavioral approval. Database
 * reads independently reject changed source, bindings, connections or Preview. */
export async function recordWebsiteProductionSourceCandidate(input: {
  client: Client; reader: SourceReader; candidate: ProductionSourceCandidate;
  isCurrent(): Promise<boolean>;
}): Promise<ProductionSourceCandidate> {
  try {
    if (typeof window !== 'undefined' || !await input.isCurrent()) throw new Error();
    const expected = structuredClone(parse(input.candidate));
    if (expected.sourceDigest === expected.previewSourceDigest) throw new Error();
    const matches = (value: unknown) => {
      const candidate = parse(value);
      if (Object.keys(expected).some(key => candidate[key as keyof ProductionSourceCandidate] !== expected[key as keyof ProductionSourceCandidate])) throw new Error();
      return candidate;
    };
    const read = async () => {
      if (!await input.isCurrent()) throw new Error();
      const result = await input.client.rpc('website_read_production_source_candidate', {
        p_operation_id: expected.operationId, p_project_id: expected.projectId, p_owner_id: expected.ownerId,
      });
      if (result.error || !await input.isCurrent()) throw new Error();
      return result.data === null ? null : matches(result.data);
    };
    const prior = await read(); if (prior) return prior;
    const saved = await input.reader.readSavedProject(expected.projectId, expected.ownerId);
    if (!saved || saved.projectId !== expected.projectId || saved.ownerId !== expected.ownerId
      || await websiteProjectReleaseDigest(saved.snapshot) !== expected.snapshotDigest || !await input.isCurrent()) throw new Error();
    try {
      const result = await input.client.rpc('website_record_production_source_candidate', {
        p_operation_id: expected.operationId, p_project_id: expected.projectId, p_owner_id: expected.ownerId,
        p_preview_operation_id: expected.previewOperationId, p_github_connection_id: expected.githubConnectionId,
        p_preview_source_digest: expected.previewSourceDigest, p_snapshot_digest: expected.snapshotDigest,
        p_runtime_digest: expected.runtimeDigest, p_source_digest: expected.sourceDigest, p_head_sha: expected.headSha,
        p_snapshot: saved.snapshot,
      });
      if (result.error || !await input.isCurrent()) throw new Error();
      return matches(result.data);
    } catch {
      const recovered = await read(); if (!recovered) throw new Error(); return recovered;
    }
  } catch { throw new Error('Production source checkpoint is unavailable.'); }
}
