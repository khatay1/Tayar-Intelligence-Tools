export type EditorCollaboratorRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';
export type EditorReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved';
export type EditorCommentStatus = 'open' | 'resolved';
export type EditorActivityKind = 'comment' | 'mention' | 'edit' | 'review_requested' | 'approved' | 'changes_requested' | 'version_created' | 'version_restored';

export interface EditorCollaborator { id: string; displayName: string; email?: string; avatarUrl?: string; role: EditorCollaboratorRole; }
export interface EditorCommentAnchor { pageId: string; sectionId?: string; elementId?: string; containerId?: string; formFieldId?: string; }
export interface EditorComment { id: string; projectId: string; authorId: string; body: string; anchor: EditorCommentAnchor; status: EditorCommentStatus; mentionUserIds: string[]; parentId?: string; createdAt: string; updatedAt: string; resolvedAt?: string; resolvedBy?: string; }
export interface EditorReview { id: string; projectId: string; requestedBy: string; reviewerIds: string[]; status: EditorReviewStatus; note?: string; versionId?: string; createdAt: string; updatedAt: string; }
export interface EditorActivity { id: string; projectId: string; actorId: string; kind: EditorActivityKind; createdAt: string; pageId?: string; sectionId?: string; elementId?: string; versionId?: string; commentId?: string; reviewId?: string; summary?: string; }
export interface EditorVersionSnapshot<TProject = unknown> { id: string; projectId: string; createdBy: string; createdAt: string; label?: string; note?: string; source: 'manual' | 'autosave' | 'publish' | 'restore'; project: TProject; }

const ROLE_WEIGHT: Record<EditorCollaboratorRole, number> = { viewer: 0, reviewer: 1, editor: 2, admin: 3, owner: 4 };
export function editorRoleAtLeast(role: EditorCollaboratorRole, required: EditorCollaboratorRole) { return ROLE_WEIGHT[role] >= ROLE_WEIGHT[required]; }
export function canEditProject(role: EditorCollaboratorRole) { return editorRoleAtLeast(role, 'editor'); }
export function canReviewProject(role: EditorCollaboratorRole) { return editorRoleAtLeast(role, 'reviewer'); }
export function canManageCollaborators(role: EditorCollaboratorRole) { return editorRoleAtLeast(role, 'admin'); }
export function canRestoreVersion(role: EditorCollaboratorRole) { return editorRoleAtLeast(role, 'editor'); }

export function extractEditorMentions(body: string, collaborators: EditorCollaborator[]) {
  const normalized = body.toLocaleLowerCase();
  return collaborators.filter(user => normalized.includes(`@${user.displayName.toLocaleLowerCase()}`) || (!!user.email && normalized.includes(`@${user.email.toLocaleLowerCase()}`))).map(user => user.id);
}

export interface EditorVersionChange { path: string; before: unknown; after: unknown; }
export interface EditorVersionDiffSummary { added: number; removed: number; changed: number; total: number; topLevel: Record<string, number>; }
export function compareEditorVersionValues(before: unknown, after: unknown, path = '$', changes: EditorVersionChange[] = []): EditorVersionChange[] {
  if (Object.is(before, after)) return changes;
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null || Array.isArray(before) !== Array.isArray(after)) { changes.push({ path, before, after }); return changes; }
  if (Array.isArray(before) && Array.isArray(after)) { const length = Math.max(before.length, after.length); for (let index = 0; index < length; index += 1) compareEditorVersionValues(before[index], after[index], `${path}[${index}]`, changes); return changes; }
  const left = before as Record<string, unknown>; const right = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]); keys.forEach(key => compareEditorVersionValues(left[key], right[key], `${path}.${key}`, changes)); return changes;
}

export function summarizeEditorVersionChanges(changes: EditorVersionChange[]): EditorVersionDiffSummary {
  const summary: EditorVersionDiffSummary = { added: 0, removed: 0, changed: 0, total: changes.length, topLevel: {} };
  for (const change of changes) {
    if (change.before === undefined) summary.added += 1; else if (change.after === undefined) summary.removed += 1; else summary.changed += 1;
    const top = change.path.replace(/^\$\.?/, '').split(/[.[]/, 1)[0] || 'root'; summary.topLevel[top] = (summary.topLevel[top] || 0) + 1;
  }
  return summary;
}

function pathTokens(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  path.replace(/^\$\.?/, '').replace(/([^.[\]]+)|\[(\d+)\]/g, (_match, key: string | undefined, index: string | undefined) => {
    tokens.push(index === undefined ? key || '' : Number(index));
    return '';
  });
  return tokens.filter((token) => token !== '');
}

type MutablePathContainer = Record<string, unknown> | unknown[];

function isMutablePathContainer(value: unknown): value is MutablePathContainer {
  return Array.isArray(value) || (typeof value === 'object' && value !== null);
}

function getPathChild(value: unknown, token: string | number): unknown {
  if (Array.isArray(value)) return typeof token === 'number' ? value[token] : undefined;
  if (typeof value === 'object' && value !== null && typeof token === 'string') return (value as Record<string, unknown>)[token];
  return undefined;
}

function setPathChild(container: MutablePathContainer, token: string | number, value: unknown): boolean {
  if (Array.isArray(container) && typeof token === 'number') {
    container[token] = value;
    return true;
  }
  if (!Array.isArray(container) && typeof token === 'string') {
    container[token] = value;
    return true;
  }
  return false;
}

function deletePathChild(container: MutablePathContainer, token: string | number): void {
  if (Array.isArray(container) && typeof token === 'number') {
    container.splice(token, 1);
    return;
  }
  if (!Array.isArray(container) && typeof token === 'string') delete container[token];
}

export function restoreEditorVersionPaths<T>(current: T, snapshot: T, paths: string[]): T {
  const next = structuredClone(current);
  for (const path of paths) {
    const tokens = pathTokens(path);
    if (!tokens.length) return structuredClone(snapshot);
    if (!isMutablePathContainer(next)) return structuredClone(snapshot);

    let target: MutablePathContainer = next;
    let source: unknown = snapshot;
    let pathIsWritable = true;

    for (let index = 0; index < tokens.length - 1; index += 1) {
      const token = tokens[index];
      source = getPathChild(source, token);
      let child = getPathChild(target, token);
      if (!isMutablePathContainer(child)) {
        const created: MutablePathContainer = typeof tokens[index + 1] === 'number' ? [] : {};
        if (!setPathChild(target, token, created)) {
          pathIsWritable = false;
          break;
        }
        child = created;
      }
      target = child;
    }

    if (!pathIsWritable) continue;
    const leaf = tokens[tokens.length - 1];
    const value = getPathChild(source, leaf);
    if (value === undefined) deletePathChild(target, leaf);
    else setPathChild(target, leaf, structuredClone(value));
  }
  return next;
}
