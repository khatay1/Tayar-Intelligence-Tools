export type EditorPublishEnvironment = 'staging' | 'production';
export type EditorPublishMode = 'full' | 'selective';

export interface EditorPublishRedirect {
  id: string;
  from: string;
  to: string;
  status: 301 | 302 | 307 | 308;
  enabled: boolean;
}

export interface EditorPublishPlan {
  environment: EditorPublishEnvironment;
  mode: EditorPublishMode;
  pageIds: string[];
  scheduledAt?: string;
  releaseNote: string;
}

export interface EditorPublishRevision {
  id: string;
  environment: EditorPublishEnvironment;
  publishedUrl: string;
  releaseNote: string;
  createdAt: string;
  editorFingerprint: string;
  pageIds?: string[];
}

const cleanPath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/{2,}/g, '/');
};

export function normalizeEditorPublishRedirect(input: Partial<EditorPublishRedirect>): EditorPublishRedirect {
  const allowed = new Set([301, 302, 307, 308]);
  const status = Number(input.status);
  return {
    id: String(input.id || globalThis.crypto?.randomUUID?.() || `redirect-${Date.now()}`),
    from: cleanPath(String(input.from || '/')),
    to: String(input.to || '/').trim() || '/',
    status: (allowed.has(status) ? status : 301) as EditorPublishRedirect['status'],
    enabled: input.enabled !== false,
  };
}

export function validateEditorPublishRedirects(redirects: EditorPublishRedirect[]): string[] {
  const errors: string[] = [];
  const sources = new Set<string>();
  for (const redirect of redirects.filter(item => item.enabled)) {
    const normalized = normalizeEditorPublishRedirect(redirect);
    if (sources.has(normalized.from)) errors.push(`Duplicate redirect source: ${normalized.from}`);
    sources.add(normalized.from);
    if (normalized.from === normalized.to) errors.push(`Redirect cannot point to itself: ${normalized.from}`);
    if (/^javascript:/i.test(normalized.to)) errors.push(`Unsafe redirect target: ${normalized.from}`);
  }
  return errors;
}

export function normalizeEditorPublishPlan(input: Partial<EditorPublishPlan>, allPageIds: string[]): EditorPublishPlan {
  const environment: EditorPublishEnvironment = input.environment === 'staging' ? 'staging' : 'production';
  const mode: EditorPublishMode = input.mode === 'selective' ? 'selective' : 'full';
  const allowed = new Set(allPageIds);
  const selected = Array.from(new Set((input.pageIds || []).filter(id => allowed.has(id))));
  const pageIds = mode === 'full' ? [...allPageIds] : selected;
  const scheduledAt = input.scheduledAt?.trim();
  return { environment, mode, pageIds, ...(scheduledAt ? { scheduledAt } : {}), releaseNote: String(input.releaseNote || '').trim().slice(0, 500) };
}

export function validateEditorPublishPlan(plan: EditorPublishPlan, now = new Date()): string[] {
  const errors: string[] = [];
  if (!plan.pageIds.length) errors.push('Select at least one page to publish.');
  if (plan.scheduledAt) {
    const timestamp = Date.parse(plan.scheduledAt);
    if (!Number.isFinite(timestamp)) errors.push('Scheduled publish time is invalid.');
    else if (timestamp <= now.getTime()) errors.push('Scheduled publish time must be in the future.');
  }
  return errors;
}

export function canRollbackEditorRevision(revision: EditorPublishRevision, environment: EditorPublishEnvironment) {
  return revision.environment === environment && Boolean(revision.id && revision.editorFingerprint);
}
