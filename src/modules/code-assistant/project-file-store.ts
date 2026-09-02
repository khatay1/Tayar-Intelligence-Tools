export type ProjectFileStoreKind = 'object' | 'array' | 'unsupported';

export interface ProjectFileStoreInfo {
  kind: ProjectFileStoreKind;
  fingerprint: string;
  count: number;
}

export interface FileWriteOperation {
  type: 'create' | 'replace';
  path: string;
  content: string;
}

export interface FileRollbackEntry {
  path: string;
  existed: boolean;
  previousValue?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintFileStore(value: unknown): string {
  return hashText(stableSerialize(value));
}

function entryPath(entry: Record<string, unknown>): string | null {
  for (const key of ['path', 'name', 'filename']) {
    if (typeof entry[key] === 'string' && String(entry[key]).trim()) return String(entry[key]).trim().replace(/^\.\//, '');
  }
  return null;
}

function contentField(entry: Record<string, unknown>): string | null {
  for (const key of ['content', 'text', 'code', 'source', 'value']) {
    if (typeof entry[key] === 'string') return key;
  }
  return null;
}

export function inspectProjectFileStore(content: Record<string, unknown>): ProjectFileStoreInfo {
  const files = content.files;
  if (Array.isArray(files)) {
    const valid = files.every((entry) => isRecord(entry) && Boolean(entryPath(entry)));
    return {
      kind: valid ? 'array' : 'unsupported',
      fingerprint: fingerprintFileStore(files),
      count: valid ? files.length : 0,
    };
  }
  if (isRecord(files)) {
    return {
      kind: 'object',
      fingerprint: fingerprintFileStore(files),
      count: Object.keys(files).length,
    };
  }
  return {
    kind: 'unsupported',
    fingerprint: fingerprintFileStore(files),
    count: 0,
  };
}

function replaceObjectValue(existing: unknown, content: string): unknown {
  if (typeof existing === 'string') return content;
  if (isRecord(existing)) {
    const field = contentField(existing) || 'content';
    return { ...existing, [field]: content };
  }
  return content;
}

export function applyFileOperations(
  content: Record<string, unknown>,
  operations: FileWriteOperation[],
): { content: Record<string, unknown>; rollback: FileRollbackEntry[] } {
  const info = inspectProjectFileStore(content);
  if (info.kind === 'unsupported') throw new Error('This project file-store shape is not supported for safe apply.');

  const rollback: FileRollbackEntry[] = [];

  if (info.kind === 'object') {
    const source = content.files as Record<string, unknown>;
    const nextFiles: Record<string, unknown> = { ...source };

    for (const operation of operations) {
      const existed = Object.prototype.hasOwnProperty.call(source, operation.path);
      if (operation.type === 'replace' && !existed) {
        throw new Error(`Cannot replace missing project file "${operation.path}".`);
      }
      if (operation.type === 'create' && existed) {
        throw new Error(`Cannot create existing project file "${operation.path}".`);
      }
      rollback.push({
        path: operation.path,
        existed,
        ...(existed ? { previousValue: source[operation.path] } : {}),
      });
      nextFiles[operation.path] = replaceObjectValue(source[operation.path], operation.content);
    }
    return { content: { ...content, files: nextFiles }, rollback };
  }

  const source = content.files as unknown[];
  const nextFiles = source.map((entry) => isRecord(entry) ? { ...entry } : entry);

  for (const operation of operations) {
    const index = nextFiles.findIndex((entry) => isRecord(entry) && entryPath(entry) === operation.path);
    const existed = index >= 0;
    if (operation.type === 'replace' && !existed) {
      throw new Error(`Cannot replace missing project file "${operation.path}".`);
    }
    if (operation.type === 'create' && existed) {
      throw new Error(`Cannot create existing project file "${operation.path}".`);
    }

    rollback.push({
      path: operation.path,
      existed,
      ...(existed ? { previousValue: nextFiles[index] } : {}),
    });

    if (existed) {
      const entry = nextFiles[index] as Record<string, unknown>;
      const field = contentField(entry) || 'content';
      nextFiles[index] = { ...entry, [field]: operation.content };
    } else {
      nextFiles.push({ path: operation.path, content: operation.content });
    }
  }

  return { content: { ...content, files: nextFiles }, rollback };
}

export function restoreFileOperations(
  content: Record<string, unknown>,
  rollback: FileRollbackEntry[],
): Record<string, unknown> {
  const info = inspectProjectFileStore(content);
  if (info.kind === 'unsupported') throw new Error('This project file-store shape is not supported for rollback.');

  if (info.kind === 'object') {
    const nextFiles: Record<string, unknown> = { ...(content.files as Record<string, unknown>) };
    for (const entry of rollback) {
      if (entry.existed) nextFiles[entry.path] = entry.previousValue;
      else delete nextFiles[entry.path];
    }
    return { ...content, files: nextFiles };
  }

  const nextFiles = (content.files as unknown[]).map((entry) => isRecord(entry) ? { ...entry } : entry);
  for (const rollbackEntry of rollback) {
    const index = nextFiles.findIndex((entry) => isRecord(entry) && entryPath(entry) === rollbackEntry.path);
    if (rollbackEntry.existed) {
      if (index >= 0) nextFiles[index] = rollbackEntry.previousValue;
      else nextFiles.push(rollbackEntry.previousValue);
    } else if (index >= 0) {
      nextFiles.splice(index, 1);
    }
  }
  return { ...content, files: nextFiles };
}
