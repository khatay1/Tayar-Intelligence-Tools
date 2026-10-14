import { ISOLATED_CODE_LIMITS } from './isolated-code-execution';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);

/** Resolve only inert source embedded in the requested immutable application release.
 * Callers must authorize the request before loading the release. */
export function resolvePublishedCustomOperationArtifact(input: {
  release: unknown;
  ownerId: string;
  projectId: string;
  releaseId: string;
  operationId: string;
}): { releaseId: string; operationId: string; source: string } | null {
  const { release, ownerId, projectId, releaseId, operationId } = input;
  if (!safeId(ownerId) || !safeId(projectId) || !safeId(releaseId) || !safeId(operationId) || !record(release)) return null;
  if (release.id !== releaseId || release.project_id !== projectId || release.user_id !== ownerId
    || release.storage_bucket !== 'website-application-releases' || !record(release.snapshot)
    || !record(release.snapshot.application) || !record(release.snapshot.application.requirements)
    || !record(release.snapshot.application.requirements.specification)
    || !Array.isArray(release.snapshot.application.requirements.specification.operations)) return null;

  const matches = release.snapshot.application.requirements.specification.operations.filter((operation: unknown) =>
    record(operation) && operation.id === operationId);
  if (matches.length !== 1) return null;
  const operation = matches[0];
  if (!record(operation) || operation.execution !== 'custom' || typeof operation.source !== 'string'
    || !operation.source.trim() || new TextEncoder().encode(operation.source).byteLength > ISOLATED_CODE_LIMITS.maxSourceBytes) return null;
  return { releaseId, operationId, source: operation.source };
}
