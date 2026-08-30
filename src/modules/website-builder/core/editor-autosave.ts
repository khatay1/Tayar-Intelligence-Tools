import {
  readEditorSnapshot,
  writeEditorSnapshot,
  type EditorPersistenceResult,
} from './editor-persistence';
import { cloneEditorValue } from './editor-transaction';

export interface EditorAutosavePayload<T> {
  revision: number;
  project: T;
}

export interface EditorAutosaveOptions<T> {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  key: string;
  schemaVersion: number;
  debounceMs?: number;
  clone?: (value: T) => T;
  onSaved?: (revision: number, savedAt: number) => void;
  onError?: (error: string) => void;
}

export class EditorAutosaveController<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: EditorAutosavePayload<T> | undefined;
  private disposed = false;
  private readonly clone: (value: T) => T;
  private readonly debounceMs: number;

  constructor(private readonly options: EditorAutosaveOptions<T>) {
    this.clone = options.clone || cloneEditorValue;
    const parsed = Number(options.debounceMs);
    this.debounceMs = Number.isFinite(parsed) ? Math.max(100, Math.min(60_000, parsed)) : 900;
  }

  queue(project: T, revision: number) {
    if (this.disposed) return;
    this.pending = { project: this.clone(project), revision };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, this.debounceMs);
  }

  flush(): EditorPersistenceResult<EditorAutosavePayload<T>> {
    if (this.disposed || !this.pending) {
      return { ok: false, error: this.disposed ? 'Autosave is disposed' : 'No autosave is pending' };
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    const payload = {
      revision: this.pending.revision,
      project: this.clone(this.pending.project),
    };
    const result = writeEditorSnapshot(
      this.options.storage,
      this.options.key,
      payload,
      this.options.schemaVersion,
    );

    if (result.ok) {
      const savedAt = result.savedAt || Date.now();
      this.pending = undefined;
      this.options.onSaved?.(payload.revision, savedAt);
    } else if (result.error) {
      this.options.onError?.(result.error);
    }
    return result;
  }

  restore() {
    return readEditorSnapshot<EditorAutosavePayload<T>>(
      this.options.storage,
      this.options.key,
      this.options.schemaVersion,
    );
  }

  discard() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
    try {
      this.options.storage.removeItem(this.options.key);
      return true;
    } catch {
      return false;
    }
  }

  hasPending() {
    return Boolean(this.pending);
  }

  dispose(flush = false) {
    if (flush && this.pending) this.flush();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
    this.disposed = true;
  }
}
