export interface EditorTaskToken {
  id: number;
  key: string;
  label: string;
  startedAt: number;
}

export interface EditorTaskState {
  activeCount: number;
  latestByKey: Record<string, number>;
}

/**
 * Coordinates async editor work such as AI plan -> execute -> review chains.
 * It does not cancel network requests itself; it gives callers a cheap stale-result gate.
 */
export class EditorTaskCoordinator {
  private sequence = 0;
  private active = new Set<number>();
  private latestByKey = new Map<string, number>();

  begin(key: string, label: string): EditorTaskToken {
    const id = ++this.sequence;
    const token = {
      id,
      key: key.trim() || 'editor',
      label: label.trim() || 'Editor task',
      startedAt: Date.now(),
    };
    this.active.add(id);
    this.latestByKey.set(token.key, id);
    return token;
  }

  isCurrent(token: EditorTaskToken) {
    return this.active.has(token.id) && this.latestByKey.get(token.key) === token.id;
  }

  finish(token: EditorTaskToken) {
    this.active.delete(token.id);
    if (this.latestByKey.get(token.key) === token.id) {
      this.latestByKey.delete(token.key);
    }
  }

  supersede(key: string) {
    const normalized = key.trim() || 'editor';
    const activeId = this.latestByKey.get(normalized);
    if (activeId !== undefined) this.active.delete(activeId);
    this.latestByKey.delete(normalized);
  }

  state(): EditorTaskState {
    return {
      activeCount: this.active.size,
      latestByKey: Object.fromEntries(this.latestByKey.entries()),
    };
  }
}
