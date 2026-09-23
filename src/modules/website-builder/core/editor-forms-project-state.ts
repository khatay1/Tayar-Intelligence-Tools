export interface EditorFormsProjectState {
  submissionsView?: {
    status?: 'all' | 'new' | 'read' | 'archived';
    formId?: string;
  };
}

const EMPTY_FORMS_PROJECT_STATE: EditorFormsProjectState = {};

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().slice(0, max);
  return cleaned || undefined;
}

export function normalizeEditorFormsProjectState(value: unknown): EditorFormsProjectState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_FORMS_PROJECT_STATE;
  const source = value as EditorFormsProjectState;
  const status = source.submissionsView?.status;
  const normalizedStatus = status === 'new' || status === 'read' || status === 'archived' || status === 'all'
    ? status
    : undefined;
  const formId = cleanText(source.submissionsView?.formId, 120);
  if (!normalizedStatus && !formId) return EMPTY_FORMS_PROJECT_STATE;
  return { submissionsView: { status: normalizedStatus, formId } };
}

/**
 * Form definitions intentionally do not live here.
 * Fields, validation, conditions, success behavior, spam protection and automations
 * are owned by WebsiteSection and therefore already participate in page history,
 * save/load, publish generation and native editor operations.
 */
export function editorFormsDefinitionsLiveInSections(): true {
  return true;
}
