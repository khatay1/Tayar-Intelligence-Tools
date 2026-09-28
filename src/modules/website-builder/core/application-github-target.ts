import type { InfrastructureConnection } from './application-infrastructure-connections';

const sha = /^[0-9a-f]{40}$/i;
const digest = /^[0-9a-f]{64}$/i;
const branchName = /^[a-zA-Z0-9_./-]{1,200}$/;
const fullName = /^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/;

/** Values observed through a trusted GitHub installation token. Never accept
 * a project snapshot as evidence of an installation or repository permission. */
export interface ObservedGitHubTarget {
  installationAccountId: string;
  repositoryId: string;
  repositoryOwnerId: string;
  repositoryFullName: string;
  writable: boolean;
  archived: boolean;
  selectedByInstallation: boolean;
  branch: string;
  headSha: string | null;
}

export interface GitHubExportCursor {
  projectId: string;
  connectionVersion: number;
  repositoryId: string;
  branch: string;
  lastHeadSha: string | null;
  lastSourceDigest: string | null;
}

export function verifyGitHubTarget(connection: InfrastructureConnection, observed: ObservedGitHubTarget): void {
  if (connection.provider !== 'github' || !['connected', 'ready'].includes(connection.status)
    || !connection.verifiedAt || !connection.permissions.includes('contents:write')
    || connection.accountId !== observed.installationAccountId
    || connection.accountId !== observed.repositoryOwnerId
    || connection.targetId !== observed.repositoryId
    || !observed.selectedByInstallation || !observed.writable || observed.archived
    || !fullName.test(observed.repositoryFullName)
    || !branchName.test(observed.branch) || observed.branch.startsWith('-')
    || observed.branch.startsWith('.') || observed.branch.endsWith('/') || observed.branch.endsWith('.')
    || observed.branch.includes('..') || observed.branch.includes('//')
    || observed.branch.split('/').some(part => part.startsWith('.') || part.endsWith('.lock'))
    || (observed.headSha !== null && !sha.test(observed.headSha))) {
    throw new Error('GitHub repository access is not verified.');
  }
}

/** A trusted worker reads the remote branch immediately before writing. The
 * eventual ref update must also use a non-force fast-forward guard and verify
 * the resulting commit/tree; this local plan alone is never publish success. */
export function planGitHubExport(input: {
  connection: InfrastructureConnection;
  observed: ObservedGitHubTarget;
  cursor: GitHubExportCursor;
  sourceDigest: string;
}): 'unchanged' | 'write' {
  verifyGitHubTarget(input.connection, input.observed);
  const { cursor, connection, observed, sourceDigest } = input;
  if (cursor.projectId !== connection.projectId || cursor.connectionVersion !== connection.version
    || cursor.repositoryId !== observed.repositoryId || cursor.branch !== observed.branch
    || (cursor.lastHeadSha !== null && !sha.test(cursor.lastHeadSha))
    || (cursor.lastSourceDigest !== null && !digest.test(cursor.lastSourceDigest)) || !digest.test(sourceDigest)) {
    throw new Error('GitHub export target changed.');
  }
  if (cursor.lastHeadSha !== observed.headSha) throw new Error('GitHub branch changed since the last verified export.');
  return cursor.lastHeadSha && cursor.lastSourceDigest === sourceDigest ? 'unchanged' : 'write';
}
