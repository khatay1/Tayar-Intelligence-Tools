export const STORAGE_KEY = 'tayar.website-builder.project.v5';
export const ACTIVE_PROJECT_STORAGE_KEY = 'tayar.website-builder.active-project.v1';
export const RECOVERY_STORAGE_KEY = 'tayar.website-builder.recovery.v1';
export const PREVIOUS_STORAGE_KEY = 'tayar.website-builder.project.v4';
export const V3_STORAGE_KEY = 'tayar.website-builder.project.v3';
export const V2_STORAGE_KEY = 'tayar.website-builder.project.v2';
export const LEGACY_STORAGE_KEY = 'tayar.website-builder.project';

const LOCAL_PROJECT_KEYS = [
  STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  V3_STORAGE_KEY,
  V2_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
] as const;

export interface EditorRecoverySnapshot<TProject = unknown> {
  savedAt: string;
  reason: string;
  project: TProject;
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function hasProjectShape(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const project = value as { pages?: unknown; sections?: unknown };
  return Array.isArray(project.pages) || Array.isArray(project.sections);
}

export function loadLocalWebsiteProject(): unknown | null {
  const storage = browserStorage();
  if (!storage) return null;

  for (const key of LOCAL_PROJECT_KEYS) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    return JSON.parse(raw);
  }

  return null;
}

export function saveLocalWebsiteProject(project: unknown): boolean {
  const storage = browserStorage();
  if (!storage) return false;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalWebsiteProjects(): void {
  const storage = browserStorage();
  if (!storage) return;

  for (const key of LOCAL_PROJECT_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

export function loadActiveWebsiteProjectId(): string | null {
  const storage = browserStorage();
  if (!storage) return null;

  try {
    const value = storage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function saveActiveWebsiteProjectId(projectId: string | null): boolean {
  const storage = browserStorage();
  if (!storage) return false;

  try {
    if (projectId) storage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
    else storage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasRecoveryWebsiteProject(): boolean {
  const storage = browserStorage();
  if (!storage) return false;

  try {
    return Boolean(storage.getItem(RECOVERY_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveRecoveryWebsiteProject(
  project: unknown,
  reason: string,
): boolean {
  const storage = browserStorage();
  if (!storage) return false;

  try {
    storage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        reason: reason.slice(0, 120),
        project,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadRecoveryWebsiteProject<TProject = unknown>(): EditorRecoverySnapshot<TProject> | null {
  const storage = browserStorage();
  if (!storage) return null;

  const raw = storage.getItem(RECOVERY_STORAGE_KEY);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Partial<EditorRecoverySnapshot<TProject>>;
  if (!hasProjectShape(parsed.project)) {
    throw new Error('Invalid recovery snapshot');
  }

  return {
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    project: parsed.project as TProject,
  };
}

export function cloudErrorIsRetryable(message: string): boolean {
  return !/permission|policy|not authorized|forbidden|limit reached|invalid|duplicate|violates|read-only|abort|cancel/i.test(
    message || '',
  );
}

export async function retryCloudOperation<
  T extends { error: { message?: string } | null; data?: unknown },
>(
  operation: () => PromiseLike<T>,
  attempts = 3,
): Promise<T> {
  let result = await operation();

  for (let attempt = 1; result.error && attempt < attempts; attempt += 1) {
    const online = typeof navigator === 'undefined' || navigator.onLine;
    if (!cloudErrorIsRetryable(result.error.message || '') || !online) break;

    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 350 * Math.pow(2, attempt - 1));
    });
    result = await operation();
  }

  return result;
}
