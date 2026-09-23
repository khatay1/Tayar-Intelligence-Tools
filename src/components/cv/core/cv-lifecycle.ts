import { CVDocument } from './cv-document';
import { CVDraftSnapshot } from './cv-draft-recovery';

export type CVLoadSource = 'remote' | 'local-draft' | 'new';

export interface CVLoadCandidate {
  source: CVLoadSource;
  document: CVDocument;
  updatedAt?: string | null;
}

export function chooseCVLoadCandidate(
  remote: CVLoadCandidate | null,
  local: CVDraftSnapshot | null,
  empty: CVDocument,
): CVLoadCandidate {
  if (!local) return remote ?? { source: 'new', document: empty };
  if (!remote) return { source: 'local-draft', document: local.document, updatedAt: local.savedAt };

  const localTime = Date.parse(local.savedAt);
  const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : Number.NaN;
  if (Number.isFinite(localTime) && (!Number.isFinite(remoteTime) || localTime > remoteTime)) {
    return { source: 'local-draft', document: local.document, updatedAt: local.savedAt };
  }
  return remote;
}

export function shouldWarnBeforeCVExit(status: string): boolean {
  return status === 'dirty' || status === 'saving' || status === 'error';
}
