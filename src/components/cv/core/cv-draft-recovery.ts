import { CVDocument, normalizeCVDocument } from './cv-document';

const STORAGE_PREFIX = 'tayar:cv-builder:draft:';

export interface CVDraftSnapshot {
  savedAt: string;
  document: CVDocument;
}

function storageKey(userId: string, cvId?: string | null): string {
  return `${STORAGE_PREFIX}${userId}:${cvId ?? 'new'}`;
}

export function saveLocalCVDraft(userId: string, document: CVDocument, cvId?: string | null): void {
  if (typeof window === 'undefined') return;
  const snapshot: CVDraftSnapshot = { savedAt: new Date().toISOString(), document };
  window.localStorage.setItem(storageKey(userId, cvId), JSON.stringify(snapshot));
}

export function loadLocalCVDraft(userId: string, cvId?: string | null): CVDraftSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, cvId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CVDraftSnapshot>;
    if (!parsed.document || typeof parsed.savedAt !== 'string') return null;
    return { savedAt: parsed.savedAt, document: normalizeCVDocument(parsed.document) };
  } catch {
    return null;
  }
}

export function clearLocalCVDraft(userId: string, cvId?: string | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(userId, cvId));
}
