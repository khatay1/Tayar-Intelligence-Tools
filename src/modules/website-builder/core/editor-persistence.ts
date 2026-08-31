export interface EditorPersistedEnvelope<T> {
  schemaVersion: number;
  savedAt: number;
  checksum: string;
  payload: T;
}

export interface EditorPersistenceResult<T> {
  ok: boolean;
  value?: T;
  savedAt?: number;
  error?: string;
}

function checksumText(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function serializeEditorSnapshot<T>(
  payload: T,
  schemaVersion: number,
  savedAt = Date.now(),
): string {
  const normalizedVersion = Math.max(1, Math.floor(schemaVersion));
  const payloadText = JSON.stringify(payload);
  const envelope: EditorPersistedEnvelope<T> = {
    schemaVersion: normalizedVersion,
    savedAt,
    checksum: checksumText(payloadText),
    payload,
  };
  return JSON.stringify(envelope);
}

export function parseEditorSnapshot<T>(
  raw: string | null | undefined,
  expectedSchemaVersion: number,
): EditorPersistenceResult<T> {
  if (!raw) return { ok: false, error: 'No saved editor snapshot' };

  try {
    const parsed = JSON.parse(raw) as Partial<EditorPersistedEnvelope<T>>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Invalid editor snapshot' };
    }
    if (parsed.schemaVersion !== expectedSchemaVersion) {
      return { ok: false, error: 'Editor snapshot schema mismatch' };
    }
    if (!Number.isFinite(parsed.savedAt)) {
      return { ok: false, error: 'Editor snapshot timestamp is invalid' };
    }
    if (typeof parsed.checksum !== 'string') {
      return { ok: false, error: 'Editor snapshot checksum is missing' };
    }

    const payloadText = JSON.stringify(parsed.payload);
    if (checksumText(payloadText) !== parsed.checksum) {
      return { ok: false, error: 'Editor snapshot checksum failed' };
    }

    return {
      ok: true,
      value: parsed.payload as T,
      savedAt: parsed.savedAt,
    };
  } catch {
    return { ok: false, error: 'Editor snapshot could not be parsed' };
  }
}

export function writeEditorSnapshot<T>(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  payload: T,
  schemaVersion: number,
): EditorPersistenceResult<T> {
  try {
    const savedAt = Date.now();
    const raw = serializeEditorSnapshot(payload, schemaVersion, savedAt);
    storage.setItem(key, raw);
    return { ok: true, value: payload, savedAt };
  } catch {
    return { ok: false, error: 'Editor snapshot could not be saved' };
  }
}

export function readEditorSnapshot<T>(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  schemaVersion: number,
): EditorPersistenceResult<T> {
  try {
    return parseEditorSnapshot<T>(storage.getItem(key), schemaVersion);
  } catch {
    return { ok: false, error: 'Editor storage is unavailable' };
  }
}
