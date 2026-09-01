export interface EditorAIAsyncContext {
  loadSequence: number;
  userId: string | null;
  routeProjectId: string | null;
  projectId: string | null;
  ownerId: string | null;
  editableFingerprint: string;
  activePageId: string;
  sectionId: string | null;
  elementId: string | null;
  containerId: string | null;
  formFieldId: string | null;
  device: string;
}

export interface EditorAIContextMatchOptions {
  requireEditableFingerprint?: boolean;
  requireSelection?: boolean;
}

export function editorAIContextMatches(
  expected: EditorAIAsyncContext,
  current: EditorAIAsyncContext | null | undefined,
  options: EditorAIContextMatchOptions = {},
) {
  if (!current) return false;

  if (
    current.loadSequence !== expected.loadSequence ||
    current.userId !== expected.userId ||
    current.routeProjectId !== expected.routeProjectId ||
    current.projectId !== expected.projectId ||
    current.ownerId !== expected.ownerId
  ) {
    return false;
  }

  if (
    options.requireEditableFingerprint !== false &&
    current.editableFingerprint !== expected.editableFingerprint
  ) {
    return false;
  }

  if (options.requireSelection) {
    return (
      current.activePageId === expected.activePageId &&
      current.sectionId === expected.sectionId &&
      current.elementId === expected.elementId &&
      current.containerId === expected.containerId &&
      current.formFieldId === expected.formFieldId &&
      current.device === expected.device
    );
  }

  return true;
}

export function editorAIProjectIdentityMatches(
  expected: EditorAIAsyncContext,
  current: EditorAIAsyncContext | null | undefined,
) {
  return editorAIContextMatches(expected, current, {
    requireEditableFingerprint: false,
    requireSelection: false,
  });
}
