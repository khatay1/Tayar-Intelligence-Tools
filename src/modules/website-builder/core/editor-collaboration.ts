export type EditorCollaboratorRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';
export type EditorReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved';
export type EditorCommentStatus = 'open' | 'resolved';
export type EditorActivityKind = 'comment' | 'mention' | 'edit' | 'review_requested' | 'approved' | 'changes_requested' | 'version_created' | 'version_restored';

export interface EditorCollaborator {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role: EditorCollaboratorRole;
}

export interface EditorCommentAnchor {
  pageId: string;
  sectionId?: string;
  elementId?: string;
  containerId?: string;
  formFieldId?: string;
}

export interface EditorComment {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  anchor: EditorCommentAnchor;
  status: EditorCommentStatus;
  mentionUserIds: string[];
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface EditorReview {
  id: string;
  projectId: string;
  requestedBy: string;
  reviewerIds: string[];
  status: EditorReviewStatus;
  note?: string;
  versionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditorActivity {
  id: string;
  projectId: string;
  actorId: string;
  kind: EditorActivityKind;
  createdAt: string;
  pageId?: string;
  sectionId?: string;
  elementId?: string;
  versionId?: string;
  commentId?: string;
  reviewId?: string;
  summary?: string;
}

export interface EditorVersionSnapshot<TProject = unknown> {
  id: string;
  projectId: string;
  createdBy: string;
  createdAt: string;
  label?: string;
  note?: string;
  source: 'manual' | 'autosave' | 'publish' | 'restore';
  project: TProject;
}

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
export function compareEditorVersionValues(before: unknown, after: unknown, path = '$', changes: EditorVersionChange[] = []): EditorVersionChange[] {
  if (Object.is(before, after)) return changes;
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null || Array.isArray(before) !== Array.isArray(after)) {
    changes.push({ path, before, after }); return changes;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) compareEditorVersionValues(before[index], after[index], `${path}[${index}]`, changes);
    return changes;
  }
  const left = before as Record<string, unknown>; const right = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  keys.forEach(key => compareEditorVersionValues(left[key], right[key], `${path}.${key}`, changes));
  return changes;
}
