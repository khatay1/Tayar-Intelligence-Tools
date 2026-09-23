export interface EditorCollaborationProjectState {
  requireReviewBeforePublish: boolean;
  notifyMentions: boolean;
  notifyReviewRequests: boolean;
}

export const EMPTY_EDITOR_COLLABORATION_PROJECT_STATE: EditorCollaborationProjectState = {
  requireReviewBeforePublish: false,
  notifyMentions: true,
  notifyReviewRequests: true,
};

export function normalizeEditorCollaborationProjectState(value: unknown): EditorCollaborationProjectState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_EDITOR_COLLABORATION_PROJECT_STATE;
  const input = value as Partial<EditorCollaborationProjectState>;
  return {
    requireReviewBeforePublish: input.requireReviewBeforePublish === true,
    notifyMentions: input.notifyMentions !== false,
    notifyReviewRequests: input.notifyReviewRequests !== false,
  };
}

/**
 * Comments, reviews, activities, collaborators and version snapshots intentionally
 * stay outside maxState. They are multi-user/backend records and must never be
 * overwritten by a stale project save.
 */
export function collaborationRuntimeRecordsStayExternal(): true {
  return true;
}
