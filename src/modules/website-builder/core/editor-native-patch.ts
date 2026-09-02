import { executeEditorSessionBatch, type EditorSessionOptions, type EditorSessionState } from './editor-session';
import { adaptEditorNativeOperations, type EditorNativeOperation } from './editor-native-operation';
import { preflightEditorNativeOperations } from './editor-operation-policy';
import { combineEditorValidation, type EditorChangeSource, type EditorValidationResult } from './editor-transaction';
import { validateEditorProject } from './editor-validation';
import type { EditorProjectLike, EditorProjectLimits } from './editor-model';

export interface ApplyEditorNativePatchOptions<P extends EditorProjectLike>
  extends EditorSessionOptions<P> {
  label?: string;
  source?: EditorChangeSource;
  maxOperations?: number;
  maxDestructiveOperations?: number;
  limits?: EditorProjectLimits;
  validateProject?: (candidate: P, previous: P) => EditorValidationResult;
}

export interface ApplyEditorNativePatchResult<P extends EditorProjectLike> {
  ok: boolean;
  changed: boolean;
  state: EditorSessionState<P>;
  errors: string[];
  warnings: string[];
}

function resolvePatchSource(
  operations: EditorNativeOperation[],
  explicit?: EditorChangeSource,
): EditorChangeSource {
  if (explicit) return explicit;

  const sources = new Set(
    operations
      .map((operation) => operation.source)
      .filter((source): source is EditorChangeSource => Boolean(source)),
  );

  if (sources.size === 1) return [...sources][0];
  if (sources.size > 1) return 'system';

  // Native patches without an explicit source historically came from the AI
  // agent, so preserve that default for backwards compatibility.
  return 'ai';
}

export function applyEditorNativePatch<P extends EditorProjectLike>(
  state: EditorSessionState<P>,
  operations: EditorNativeOperation[],
  options: ApplyEditorNativePatchOptions<P> = {},
): ApplyEditorNativePatchResult<P> {
  const preflight = preflightEditorNativeOperations(operations, {
    maxOperations: options.maxOperations,
    maxDestructiveOperations: options.maxDestructiveOperations,
    project: state.project,
  });

  if (!preflight.ok) {
    return {
      ok: false,
      changed: false,
      state,
      errors: preflight.errors,
      warnings: preflight.warnings,
    };
  }

  const adapted = adaptEditorNativeOperations<P>(operations, options.maxOperations || 60);
  if (!adapted.ok) {
    return {
      ok: false,
      changed: false,
      state,
      errors: adapted.errors,
      warnings: preflight.warnings,
    };
  }

  const source = resolvePatchSource(operations, options.source);
  const result = executeEditorSessionBatch(state, adapted.commands, {
    label: options.label || (source === 'manual' ? 'Apply manual editor change' : 'Apply Tayar AI patch'),
    source,
    maxCommands: options.maxOperations || 60,
    maxHistoryEntries: options.maxHistoryEntries,
    clone: options.clone,
    now: options.now,
    validate: (candidate, previous) => combineEditorValidation(
      validateEditorProject(candidate, options.limits),
      options.validateProject?.(candidate, previous) || { ok: true },
    ),
  });

  const transactionWarnings = result.transaction?.warnings || [];
  if (!result.transaction?.ok) {
    return {
      ok: false,
      changed: false,
      state: result.state,
      errors: result.transaction?.errors || ['Native editor patch failed'],
      warnings: [...preflight.warnings, ...transactionWarnings],
    };
  }

  return {
    ok: true,
    changed: result.changed,
    state: result.state,
    errors: [],
    warnings: [...preflight.warnings, ...transactionWarnings],
  };
}
