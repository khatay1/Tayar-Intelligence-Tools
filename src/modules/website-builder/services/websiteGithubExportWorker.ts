import type { SupabaseClient } from '@supabase/supabase-js';
import type { GitHubSourceFile } from './websiteGithubExportTransport';
import { observeWebsiteGitHubExportBranch, verifyWebsiteGitHubExportRecovery,
  writeWebsiteGitHubExport } from './websiteGithubExportTransport';
import { captureWebsiteGitHubExportSource, type SourceReader } from './websiteGithubExportSourceService';
import { mintWebsiteGitHubRepositoryToken } from './websiteGithubInstallationTokenService';
import { commitWebsiteGitHubExportCursor, initializeWebsiteGitHubExportCursor,
  readWebsiteGitHubExportCursor } from './websiteGithubExportCursorService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Environment = 'preview' | 'production';

/** Trusted orchestration only. compile must be a complete, reviewed BYO source
 * compiler, never the legacy ZIP or an HTTP request body. No HTTP route invokes
 * this worker until the user-owned runtime/compiler and connection are verified. */
export async function exportWebsiteProjectToOwnedGitHub(input: {
  projectId: string;
  ownerId: string;
  connectionId: string;
  environment: Environment;
  operationId: string;
  reader: SourceReader;
  compile(snapshot: Record<string, unknown>): Promise<GitHubSourceFile[]>;
  client: Pick<SupabaseClient, 'rpc'>;
  appClientId: string;
  appPrivateKeyPkcs8: string;
  fetcher?: typeof fetch;
}): Promise<{ status: 'unchanged' | 'exported' | 'recovery-required'; headSha: string }> {
  if (typeof window !== 'undefined' || !uuid.test(input.projectId) || !uuid.test(input.ownerId)
    || !uuid.test(input.connectionId) || !uuid.test(input.operationId)
    || !['preview', 'production'].includes(input.environment)) throw new Error('GitHub export scope changed.');
  const source = await captureWebsiteGitHubExportSource(input);
  const connection = source.connection;
  if (connection.environment !== input.environment || !connection.targetId || !await source.isCurrent()) {
    throw new Error('GitHub export scope changed.');
  }
  const token = await mintWebsiteGitHubRepositoryToken({ clientId: input.appClientId,
    privateKeyPkcs8: input.appPrivateKeyPkcs8, accountId: connection.accountId,
    repositoryId: connection.targetId, fetcher: input.fetcher });
  if (!await source.isCurrent()) throw new Error('GitHub export scope changed.');
  const scope = { client: input.client, connectionId: input.connectionId, projectId: input.projectId,
    ownerId: input.ownerId, isCurrentOwner: () => currentOwner };
  let currentOwner = true;
  const cursorCandidate = { projectId: input.projectId, connectionVersion: connection.version,
    repositoryId: connection.targetId, branch: `tayar/${input.projectId}/${input.environment}`,
    lastHeadSha: null, lastSourceDigest: null };
  const observedHead = await observeWebsiteGitHubExportBranch({ connection, repositoryFullName: token.repositoryFullName,
    token: token.token, cursor: cursorCandidate, fetcher: input.fetcher });
  if (!await source.isCurrent()) throw new Error('GitHub export scope changed.');
  let cursor = await readWebsiteGitHubExportCursor(scope);
  if (!cursor) {
    if (observedHead !== null) throw new Error('GitHub branch exists without a verified export cursor.');
    cursor = await initializeWebsiteGitHubExportCursor({ ...scope, connectionVersion: connection.version,
      repositoryId: connection.targetId, environment: input.environment, branchIsAbsent: true });
  }
  if (cursor.environment !== input.environment || cursor.connectionVersion !== connection.version
    || cursor.repositoryId !== connection.targetId || cursor.branch !== cursorCandidate.branch
    || !await source.isCurrent()) {
    throw new Error('GitHub export target changed.');
  }
  if (cursor.lastHeadSha !== observedHead) {
    if (!observedHead || !await verifyWebsiteGitHubExportRecovery({ connection, cursor,
      repositoryFullName: token.repositoryFullName, token: token.token, sourceDigest: source.sourceDigest,
      files: source.files, isCurrent: source.isCurrent, observedHead, fetcher: input.fetcher })) {
      throw new Error('GitHub branch changed since the last verified export.');
    }
    try {
      if (!await source.isCurrent()) throw new Error();
      currentOwner = await source.isCurrent();
      await commitWebsiteGitHubExportCursor({ ...scope, cursor, newHeadSha: observedHead,
        sourceDigest: source.sourceDigest, operationId: input.operationId });
      if (!await source.isCurrent()) throw new Error();
      return { status: 'exported', headSha: observedHead };
    } catch { return { status: 'recovery-required', headSha: observedHead }; }
  }
  const result = await writeWebsiteGitHubExport({ connection, cursor,
    repositoryFullName: token.repositoryFullName, token: token.token, sourceDigest: source.sourceDigest,
    files: source.files, isCurrent: source.isCurrent, fetcher: input.fetcher });
  if (result.status === 'unchanged') return { status: 'unchanged', headSha: result.headSha };
  // Remote ref verification has completed. A DB timeout/owner change does not
  // turn this into publish success; recovery must reconcile the remote branch.
  try {
    if (!await source.isCurrent()) throw new Error();
    currentOwner = await source.isCurrent();
    await commitWebsiteGitHubExportCursor({ ...scope, cursor, newHeadSha: result.headSha,
      sourceDigest: source.sourceDigest, operationId: input.operationId });
    if (!await source.isCurrent()) throw new Error();
    return { status: 'exported', headSha: result.headSha };
  } catch { return { status: 'recovery-required', headSha: result.headSha }; }
}
