import { assertInfrastructureConnection, type InfrastructureConnection } from '../core/application-infrastructure-connections';
import { websiteProjectReleaseDigest } from '../core/website-project-release-digest';
import { validateGitHubSourceManifest, type GitHubSourceFile } from './websiteGithubExportTransport';

interface SavedProject {
  projectId: string;
  ownerId: string;
  snapshot: Record<string, unknown>;
}

export interface SourceReader {
  /** The trusted platform client reads the saved website project with its
   * owner and deletion/type guards, not an editor-side draft. */
  readSavedProject(projectId: string, ownerId: string): Promise<SavedProject | null>;
  /** Read the private registry again, with current owner/project scope. */
  readConnection(connectionId: string, projectId: string, ownerId: string): Promise<InfrastructureConnection | null>;
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Capture only server-compiled source from the persisted project. The compiler
 * is a trusted BYO component, never a caller-supplied HTTP manifest. This
 * capture is not sufficient to publish until its compiler emits a complete,
 * secret-free application runtime. */
export async function captureWebsiteGitHubExportSource(input: {
  projectId: string;
  ownerId: string;
  connectionId: string;
  reader: SourceReader;
  compile(snapshot: Record<string, unknown>): Promise<GitHubSourceFile[]>;
}): Promise<{ files: GitHubSourceFile[]; sourceDigest: string; connection: InfrastructureConnection;
  isCurrent(): Promise<boolean> }> {
  if (typeof window !== 'undefined') throw new Error('GitHub export requires a trusted server.');
  const { projectId, ownerId, connectionId, reader } = input;
  const [saved, connection] = await Promise.all([
    reader.readSavedProject(projectId, ownerId), reader.readConnection(connectionId, projectId, ownerId),
  ]);
  if (!saved || saved.projectId !== projectId || saved.ownerId !== ownerId || !connection
    || connection.id !== connectionId || connection.ownerId !== ownerId || connection.projectId !== projectId
    || connection.provider !== 'github' || !['connected', 'ready'].includes(connection.status)) {
    throw new Error('GitHub export source changed.');
  }
  assertInfrastructureConnection(connection);
  const snapshotDigest = await websiteProjectReleaseDigest(saved.snapshot);
  const files = await input.compile(structuredClone(saved.snapshot));
  validateGitHubSourceManifest(files);
  const captured = files.map(file => ({ path: file.path, content: file.content }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const manifestDigest = await hash(JSON.stringify(captured));
  const sourceDigest = await hash(`${snapshotDigest}:${manifestDigest}`);
  const capturedConnection = structuredClone(connection);
  const identity = { version: connection.version, accountId: connection.accountId, targetId: connection.targetId,
    environment: connection.environment, permissions: JSON.stringify([...connection.permissions].sort()),
    verifiedAt: connection.verifiedAt };
  async function isCurrent(): Promise<boolean> {
    try {
      const [latest, active] = await Promise.all([
        reader.readSavedProject(projectId, ownerId), reader.readConnection(connectionId, projectId, ownerId),
      ]);
      return !!latest && latest.projectId === projectId && latest.ownerId === ownerId && !!active
        && active.id === connectionId && active.ownerId === ownerId && active.projectId === projectId
        && ['connected', 'ready'].includes(active.status) && active.provider === 'github'
        && active.version === identity.version && active.accountId === identity.accountId
        && active.targetId === identity.targetId && active.environment === identity.environment
        && active.verifiedAt === identity.verifiedAt
        && JSON.stringify([...active.permissions].sort()) === identity.permissions
        && await hash(JSON.stringify(captured)) === manifestDigest
        && await websiteProjectReleaseDigest(latest.snapshot) === snapshotDigest;
    } catch { return false; }
  }
  if (!await isCurrent()) throw new Error('GitHub export source changed.');
  return { files: captured, sourceDigest, connection: capturedConnection, isCurrent };
}
