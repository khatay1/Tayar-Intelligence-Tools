import { CVDocument, normalizeCVDocument, serializeCVDocument } from './cv-document';

const STORAGE_PREFIX = 'tayar:cv-builder:draft:';

export interface CVDraftSnapshot {
  savedAt: string;
  document: CVDocument;
}

function storageKey(userId: string, cvId?: string | null): string {
  return `${STORAGE_PREFIX}${userId}:${cvId ?? 'new'}`;
}

export function saveLocalCVDraft(userId: string, document: CVDocument, cvId?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const snapshot: CVDraftSnapshot = {
      savedAt: new Date().toISOString(),
      document: normalizeCVDocument(serializeCVDocument(document)),
    };
    window.localStorage.setItem(storageKey(userId, cvId), JSON.stringify(snapshot));
    return true;
  } catch {
    // Storage can be unavailable, private, full, or blocked. Recovery is best-effort
    // and must never break the editor or remote autosave path.
    return false;
  }
}

export function loadLocalCVDraft(userId: string, cvId?: string | null): CVDraftSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, cvId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CVDraftSnapshot>;
    if (!parsed.document || typeof parsed.savedAt !== 'string') return null;
    const savedAt = new Date(parsed.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
    return { savedAt: savedAt.toISOString(), document: normalizeCVDocument(parsed.document) };
  } catch {
    return null;
  }
}

export function clearLocalCVDraft(userId: string, cvId?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(storageKey(userId, cvId));
    return true;
  } catch {
    return false;
  }
}
