import type { InfrastructureConnection } from '../core/application-infrastructure-connections';
import { planGitHubExport, type ObservedGitHubTarget, type GitHubExportCursor } from '../core/application-github-target';

const api = 'https://api.github.com';
const sha = /^[0-9a-f]{40}$/i;
const digest = /^[0-9a-f]{64}$/i;
const numeric = /^[1-9][0-9]{0,19}$/;
const fullName = /^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/;
const safePath = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*(?:\/[\p{L}\p{N}_.-]+)*$/u;
export interface GitHubSourceFile { path: string; content: string }

type Input = {
  connection: InfrastructureConnection;
  cursor: GitHubExportCursor;
  repositoryFullName: string;
  token: string;
  sourceDigest: string;
  files: GitHubSourceFile[];
  /** The trusted worker checks saved project revision and connection ownership here,
   * including immediately before the ref mutation and after every awaited write. */
  isCurrent(): Promise<boolean>;
  fetcher?: typeof fetch;
};

export function validateGitHubSourceManifest(files: GitHubSourceFile[]): void {
  if (!Array.isArray(files) || files.length < 1 || files.length > 400) throw new Error('GitHub source manifest is unavailable.');
  let bytes = 0;
  const paths = new Set<string>();
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || file.path.length > 240 || !safePath.test(file.path)
      || file.path.includes('//') || file.path.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))
      || /(?:^|\/)(?:node_modules|project-backup\.json|\.env(?:\..*)?|.*(?:secret|credential|private.key|service.role).*)$/i.test(file.path)
      || typeof file.content !== 'string' || file.content.includes('\0')) throw new Error('GitHub source manifest is unavailable.');
    const path = file.path.toLowerCase();
    if (paths.has(path)) throw new Error('GitHub source manifest is unavailable.');
    paths.add(path);
    bytes += new TextEncoder().encode(file.content).length;
    if (bytes > 4_000_000) throw new Error('GitHub source manifest is unavailable.');
  }
}

async function request(fetcher: typeof fetch, token: string, path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown): Promise<{ status: number; value: Record<string, unknown> | null }> {
  const response = await fetcher(`${api}${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (response.status === 404 && method === 'GET') return { status: 404, value: null };
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 3_000_000) throw new Error('GitHub export request could not be verified.');
  const raw = await response.text();
  if (raw.length > 3_000_000) throw new Error('GitHub export request could not be verified.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GitHub export request could not be verified.');
  return { status: response.status, value: value as Record<string, unknown> };
}

function objectSha(value: Record<string, unknown> | null, field = 'sha'): string {
  const result = value?.[field];
  if (typeof result !== 'string' || !sha.test(result)) throw new Error('GitHub export response could not be verified.');
  return result;
}

/** Observe the exact repository and dedicated ref before cursor initialization.
 * The write path observes them again and refuses any intervening change. */
export async function observeWebsiteGitHubExportBranch(input: Pick<Input, 'connection' | 'repositoryFullName' | 'token' | 'cursor' | 'fetcher'>): Promise<string | null> {
  if (typeof window !== 'undefined' || !fullName.test(input.repositoryFullName)
    || typeof input.token !== 'string' || input.token.length < 20) throw new Error('GitHub export scope changed.');
  const fetcher = input.fetcher ?? fetch;
  const repoPath = `/repos/${input.repositoryFullName}`;
  const repo = (await request(fetcher, input.token, repoPath)).value;
  const owner = repo?.owner as Record<string, unknown> | undefined;
  if (String(repo?.id) !== input.connection.targetId || String(owner?.id) !== input.connection.accountId
    || repo?.full_name !== input.repositoryFullName || repo?.archived || repo?.disabled) throw new Error('GitHub repository changed.');
  const ref = await request(fetcher, input.token,
    `${repoPath}/git/ref/heads/${input.cursor.branch.split('/').map(encodeURIComponent).join('/')}`);
  return ref.status === 404 ? null : objectSha(ref.value?.object as Record<string, unknown> | null);
}

/** Reconcile an already advanced dedicated branch only when the full commit
 * message, parent and every generated blob match the captured source. */
export async function verifyWebsiteGitHubExportRecovery(input: Input & { observedHead: string }): Promise<boolean> {
  validateGitHubSourceManifest(input.files);
  if (typeof window !== 'undefined' || !fullName.test(input.repositoryFullName)
    || !sha.test(input.observedHead) || !digest.test(input.sourceDigest)
    || input.cursor.lastHeadSha === input.observedHead || !await input.isCurrent()) return false;
  const fetcher = input.fetcher ?? fetch;
  const root = `/repos/${input.repositoryFullName}`;
  const commit = (await request(fetcher, input.token, `${root}/git/commits/${input.observedHead}`)).value;
  const parents = commit?.parents;
  if (objectSha(commit) !== input.observedHead
    || commit?.message !== `Export Tayar application ${input.cursor.projectId} (${input.sourceDigest})`
    || !Array.isArray(parents) || parents.length !== 1
    || (input.cursor.lastHeadSha !== null && objectSha(parents[0] as Record<string, unknown>) !== input.cursor.lastHeadSha)) return false;
  const treeSha = objectSha(commit?.tree as Record<string, unknown> | null);
  const tree = (await request(fetcher, input.token, `${root}/git/trees/${treeSha}?recursive=1`)).value;
  if (objectSha(tree) !== treeSha || tree?.truncated !== false || !Array.isArray(tree.tree)) return false;
  const actual = (tree.tree as Array<Record<string, unknown>>).filter(entry => entry.type === 'blob');
  if (actual.length !== input.files.length || tree.tree.some((entry: Record<string, unknown>) => !['tree', 'blob'].includes(String(entry.type)))) return false;
  const expected = new Map<string, string>();
  const directories = new Set<string>();
  for (const file of input.files) {
    const parts = file.path.split('/');
    for (let index = 1; index < parts.length; index++) directories.add(parts.slice(0, index).join('/'));
    const bytes = new TextEncoder().encode(file.content);
    const prefix = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const buffer = new Uint8Array(prefix.length + bytes.length);
    buffer.set(prefix); buffer.set(bytes, prefix.length);
    const hashed = await crypto.subtle.digest('SHA-1', buffer);
    expected.set(file.path, Array.from(new Uint8Array(hashed), byte => byte.toString(16).padStart(2, '0')).join(''));
  }
  if (actual.some(entry => typeof entry.path !== 'string' || entry.mode !== '100644'
    || expected.get(entry.path) !== entry.sha)
    || tree.tree.some((entry: Record<string, unknown>) => entry.type === 'tree'
      && (typeof entry.path !== 'string' || !directories.has(entry.path) || entry.mode !== '040000'))) return false;
  return await input.isCurrent();
}

/** A source transport, not a project compiler or publish acknowledgement. The
 * caller must bind sourceDigest to a freshly read, saved application revision. */
export async function writeWebsiteGitHubExport(input: Input): Promise<{ status: 'unchanged' | 'written'; headSha: string; treeSha?: string }> {
  if (typeof window !== 'undefined' || !fullName.test(input.repositoryFullName)
    || !numeric.test(input.connection.accountId) || !numeric.test(String(input.connection.targetId))
    || typeof input.token !== 'string' || input.token.length < 20) throw new Error('GitHub export scope changed.');
  validateGitHubSourceManifest(input.files);
  const fetcher = input.fetcher ?? fetch;
  const repoPath = `/repos/${input.repositoryFullName}`;
  const refPath = `${repoPath}/git/ref/heads/${input.cursor.branch.split('/').map(encodeURIComponent).join('/')}`;
  const current = async () => { if (!await input.isCurrent()) throw new Error('GitHub export scope changed.'); };
  await current();
  const repo = (await request(fetcher, input.token, repoPath)).value;
  const owner = repo?.owner as Record<string, unknown> | undefined;
  if (String(repo?.id) !== input.connection.targetId || String(owner?.id) !== input.connection.accountId
    || repo?.full_name !== input.repositoryFullName || repo?.archived || repo?.disabled
    || typeof repo?.default_branch !== 'string' || !repo.default_branch) throw new Error('GitHub repository changed.');
  const ref = await request(fetcher, input.token, refPath);
  const branchHead = ref.status === 404 ? null : objectSha(ref.value?.object as Record<string, unknown> | null);
  const observed: ObservedGitHubTarget = { installationAccountId: input.connection.accountId,
    repositoryOwnerId: String(owner?.id), repositoryId: String(repo?.id), repositoryFullName: input.repositoryFullName,
    writable: true, archived: false, selectedByInstallation: true,
    branch: input.cursor.branch, headSha: branchHead };
  // A scoped installation token is minted by the separate service. Its permission
  // is checked there; this transport rechecks immutable remote identity and head.
  const plan = planGitHubExport({ connection: input.connection, observed, cursor: input.cursor, sourceDigest: input.sourceDigest });
  await current();
  if (plan === 'unchanged') return { status: 'unchanged', headSha: branchHead! };
  let parent = branchHead;
  if (!parent) {
    const base = await request(fetcher, input.token,
      `${repoPath}/git/ref/heads/${repo.default_branch.split('/').map(encodeURIComponent).join('/')}`);
    if (base.status === 404) throw new Error('GitHub repository is empty; initialize a default branch and retry.');
    parent = objectSha(base.value?.object as Record<string, unknown> | null);
  }
  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of input.files) {
    await current();
    const blob = await request(fetcher, input.token, `${repoPath}/git/blobs`, 'POST',
      { content: file.content, encoding: 'utf-8' });
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: objectSha(blob.value) });
  }
  await current();
  const tree = await request(fetcher, input.token, `${repoPath}/git/trees`, 'POST', { tree: treeEntries });
  const treeSha = objectSha(tree.value);
  await current();
  const commit = await request(fetcher, input.token, `${repoPath}/git/commits`, 'POST',
    { message: `Export Tayar application ${input.cursor.projectId} (${input.sourceDigest})`,
      tree: treeSha, parents: [parent] });
  const commitSha = objectSha(commit.value);
  if (objectSha(commit.value?.tree as Record<string, unknown> | null) !== treeSha) throw new Error('GitHub commit tree changed.');
  await current();
  // A lost ref response may have committed. Always read back, including after a
  // failed response, before reporting success or recording a cursor.
  let refError: unknown;
  try {
    if (branchHead) await request(fetcher, input.token, refPath, 'PATCH', { sha: commitSha, force: false });
    else await request(fetcher, input.token, `${repoPath}/git/refs`, 'POST',
      { ref: `refs/heads/${input.cursor.branch}`, sha: commitSha });
  } catch (error) { refError = error; }
  await current();
  const confirmedRef = await request(fetcher, input.token, refPath);
  if (confirmedRef.status === 404 || objectSha(confirmedRef.value?.object as Record<string, unknown> | null) !== commitSha) {
    throw new Error(refError ? 'GitHub ref write outcome is uncertain; inspect branch and retry safely.'
      : 'GitHub branch changed during export.');
  }
  const confirmedCommit = await request(fetcher, input.token, `${repoPath}/git/commits/${commitSha}`);
  if (objectSha(confirmedCommit.value) !== commitSha
    || objectSha(confirmedCommit.value?.tree as Record<string, unknown> | null) !== treeSha) {
    throw new Error('GitHub export commit verification failed.');
  }
  await current();
  return { status: 'written', headSha: commitSha, treeSha };
}
