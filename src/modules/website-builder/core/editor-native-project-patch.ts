import {
  applyEditorNativePatch,
  type ApplyEditorNativePatchOptions,
} from './editor-native-patch';
import type { EditorProjectLike } from './editor-model';
import type { EditorNativeOperation } from './editor-native-operation';
import { createEditorSession } from './editor-session';

export interface ApplyEditorNativeProjectPatchResult<
  P extends EditorProjectLike,
> {
  ok: boolean;
  changed: boolean;
  project: P;
  errors: string[];
  warnings: string[];
}

export function applyEditorNativeProjectPatch<
  P extends EditorProjectLike,
>(
  project: P,
  operations: EditorNativeOperation[],
  options: ApplyEditorNativePatchOptions<P> = {},
): ApplyEditorNativeProjectPatchResult<P> {
  const session = createEditorSession(project, options.clone);
  const result = applyEditorNativePatch(
    session,
    operations,
    options,
  );

  return {
    ok: result.ok,
    changed: result.changed,
    project: result.state.project,
    errors: result.errors,
    warnings: result.warnings,
  };
}
