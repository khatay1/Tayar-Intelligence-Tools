export type EditorProjectRole = 'owner' | 'admin' | 'editor' | 'viewer' | null;

export interface EditorProjectAccess {
  ownerId: string | null;
  workspaceId: string | null;
  role: EditorProjectRole;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  canPublish: boolean;
}

export interface EditorProjectOwnerRef {
  id: string;
  user_id: string;
  workspace_id?: string | null;
}

export const DEFAULT_EDITOR_PROJECT_ACCESS: EditorProjectAccess = {
  ownerId: null,
  workspaceId: null,
  role: 'owner',
  canView: true,
  canEdit: true,
  canManage: true,
  canPublish: true,
};

function isEditorProjectRole(value: unknown): value is Exclude<EditorProjectRole, null> {
  return value === 'owner' || value === 'admin' || value === 'editor' || value === 'viewer';
}

export function createEditorProjectAccessFallback(
  project: EditorProjectOwnerRef | null | undefined,
  currentUserId: string | null | undefined,
): EditorProjectAccess {
  if (!project || !currentUserId) return DEFAULT_EDITOR_PROJECT_ACCESS;

  const isOwner = project.user_id === currentUserId;
  return {
    ownerId: project.user_id,
    workspaceId: project.workspace_id || null,
    role: isOwner ? 'owner' : null,
    canView: isOwner,
    canEdit: isOwner,
    canManage: isOwner,
    canPublish: isOwner,
  };
}

export function normalizeEditorProjectAccess(
  raw: unknown,
  fallback: EditorProjectAccess = DEFAULT_EDITOR_PROJECT_ACCESS,
): EditorProjectAccess {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;

  return {
    ownerId: typeof value.ownerId === 'string' ? value.ownerId : fallback.ownerId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : fallback.workspaceId,
    role: isEditorProjectRole(value.role) ? value.role : fallback.role,
    canView: value.canView === undefined ? fallback.canView : value.canView === true,
    canEdit: value.canEdit === undefined ? fallback.canEdit : value.canEdit === true,
    canManage: value.canManage === undefined ? fallback.canManage : value.canManage === true,
    canPublish: value.canPublish === undefined ? fallback.canPublish : value.canPublish === true,
  };
}

export function resolveEditorProjectOwnerId(options: {
  currentUserId?: string | null;
  projectId?: string | null;
  activeProjectId?: string | null;
  activeOwnerId?: string | null;
  projects?: EditorProjectOwnerRef[];
}): string {
  const currentUserId = options.currentUserId || '';
  const projectId = options.projectId || '';
  if (!projectId) return currentUserId;

  const projectOwnerId = (options.projects || []).find((project) => project.id === projectId)?.user_id;
  if (projectOwnerId) return projectOwnerId;

  if (options.activeProjectId === projectId && options.activeOwnerId) {
    return options.activeOwnerId;
  }

  return currentUserId;
}
