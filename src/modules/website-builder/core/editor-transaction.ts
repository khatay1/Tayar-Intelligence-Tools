export type EditorChangeSource = 'manual' | 'ai' | 'system';

export interface EditorValidationResult {
  ok: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface EditorTransactionMeta {
  id: string;
  label: string;
  source: EditorChangeSource;
  startedAt: number;
  finishedAt: number;
}

export interface EditorTransactionSuccess<T> {
  ok: true;
  changed: boolean;
  before: T;
  after: T;
  warnings: string[];
  meta: EditorTransactionMeta;
}

export interface EditorTransactionFailure<T> {
  ok: false;
  changed: false;
  before: T;
  after: T;
  errors: string[];
  warnings: string[];
  meta: EditorTransactionMeta;
}

export type EditorTransactionResult<T> =
  | EditorTransactionSuccess<T>
  | EditorTransactionFailure<T>;

export interface EditorTransactionOptions<T> {
  label: string;
  source?: EditorChangeSource;
  now?: () => number;
  idFactory?: () => string;
  clone?: (value: T) => T;
  equals?: (left: T, right: T) => boolean;
  validate?: (candidate: T, previous: T) => EditorValidationResult;
}

function defaultNow() {
  return Date.now();
}

function defaultIdFactory() {
  const random = Math.random().toString(36).slice(2, 10);
  return `editor-tx-${Date.now().toString(36)}-${random}`;
}

export function cloneEditorValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultEquals<T>(left: T, right: T) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function normalizeMessages(messages: unknown): string[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message): message is string => typeof message === 'string')
    .map((message) => message.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function applyEditorTransaction<T>(
  current: T,
  mutate: (draft: T) => void | T,
  options: EditorTransactionOptions<T>,
): EditorTransactionResult<T> {
  const now = options.now || defaultNow;
  const idFactory = options.idFactory || defaultIdFactory;
  const clone = options.clone || cloneEditorValue;
  const equals = options.equals || defaultEquals;
  const startedAt = now();
  const before = clone(current);
  const draft = clone(current);

  const metaBase = {
    id: idFactory(),
    label: options.label.trim() || 'Editor change',
    source: options.source || 'manual',
    startedAt,
  } satisfies Omit<EditorTransactionMeta, 'finishedAt'>;

  let after: T;
  try {
    const returned = mutate(draft);
    after = clone(returned === undefined ? draft : returned);
  } catch (error) {
    const finishedAt = now();
    return {
      ok: false,
      changed: false,
      before,
      after: before,
      errors: [error instanceof Error ? error.message : 'Editor transaction failed'],
      warnings: [],
      meta: { ...metaBase, finishedAt },
    };
  }

  const validation = options.validate?.(after, before) || { ok: true };
  const warnings = normalizeMessages(validation.warnings);
  if (!validation.ok) {
    const finishedAt = now();
    return {
      ok: false,
      changed: false,
      before,
      after: before,
      errors: normalizeMessages(validation.errors).length
        ? normalizeMessages(validation.errors)
        : ['Editor transaction failed validation'],
      warnings,
      meta: { ...metaBase, finishedAt },
    };
  }

  const finishedAt = now();
  return {
    ok: true,
    changed: !equals(before, after),
    before,
    after,
    warnings,
    meta: { ...metaBase, finishedAt },
  };
}

export function combineEditorValidation(
  ...results: EditorValidationResult[]
): EditorValidationResult {
  const errors = results.flatMap((result) => normalizeMessages(result.errors));
  const warnings = results.flatMap((result) => normalizeMessages(result.warnings));
  return {
    ok: results.every((result) => result.ok) && errors.length === 0,
    errors,
    warnings,
  };
}
