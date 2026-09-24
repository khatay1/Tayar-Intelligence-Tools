export interface CVShareSettings {
  enabled: boolean;
  allowDownload: boolean;
  expiresAt: string | null;
}

export interface CVShareRecord extends CVShareSettings {
  token: string;
  cvId: string;
  createdAt: string;
  revokedAt: string | null;
}

export const DEFAULT_CV_SHARE_SETTINGS: CVShareSettings = {
  enabled: false,
  allowDownload: false,
  expiresAt: null,
};

export function isCVShareActive(record: CVShareRecord, now = new Date()): boolean {
  if (!record.enabled || record.revokedAt) return false;
  if (!record.expiresAt) return true;
  const expires = Date.parse(record.expiresAt);
  return Number.isFinite(expires) && expires > now.getTime();
}

export function normalizeCVShareSettings(value?: Partial<CVShareSettings> | null): CVShareSettings {
  return {
    enabled: Boolean(value?.enabled),
    allowDownload: Boolean(value?.allowDownload),
    expiresAt: value?.expiresAt ?? null,
  };
}
