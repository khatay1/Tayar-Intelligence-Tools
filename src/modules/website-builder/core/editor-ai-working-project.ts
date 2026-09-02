import type {
  EditorPageLike,
  EditorProjectLike,
  EditorSymbolLike,
} from './editor-model';
import type { EditorNativeOperation } from './editor-native-operation';
import {
  applyEditorNativeProjectPatch,
  type ApplyEditorNativeProjectPatchResult,
} from './editor-native-project-patch';
import type { ApplyEditorNativePatchOptions } from './editor-native-patch';
import { cloneEditorValue } from './editor-transaction';

export interface EditorAIWorkingProjectState {
  pages: EditorPageLike[];
  homePageId?: string;
  theme?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  headerConfig?: Record<string, unknown>;
  symbols?: EditorSymbolLike[];
}

export interface ApplyEditorAIWorkingNativeResult
  extends ApplyEditorNativeProjectPatchResult<EditorProjectLike> {
  working: EditorAIWorkingProjectState;
}

function createWorkingProject(
  state: EditorAIWorkingProjectState,
): EditorProjectLike {
  return {
    pages: cloneEditorValue(state.pages),
    ...(state.homePageId !== undefined
      ? { homePageId: state.homePageId }
      : {}),
    ...(state.theme
      ? { theme: cloneEditorValue(state.theme) }
      : {}),
    ...(state.seo
      ? { seo: cloneEditorValue(state.seo) }
      : {}),
    ...(state.headerConfig
      ? { headerConfig: cloneEditorValue(state.headerConfig) }
      : {}),
    ...(state.symbols
      ? { symbols: cloneEditorValue(state.symbols) }
      : {}),
  };
}

function projectToWorkingState(
  project: EditorProjectLike,
): EditorAIWorkingProjectState {
  return {
    pages: cloneEditorValue(project.pages),
    ...(typeof project.homePageId === 'string'
      ? { homePageId: project.homePageId }
      : {}),
    ...(project.theme && typeof project.theme === 'object'
      ? { theme: cloneEditorValue(project.theme) }
      : {}),
    ...(project.seo && typeof project.seo === 'object'
      ? { seo: cloneEditorValue(project.seo) }
      : {}),
    ...(project.headerConfig &&
    typeof project.headerConfig === 'object'
      ? {
          headerConfig:
            cloneEditorValue(project.headerConfig),
        }
      : {}),
    ...(Array.isArray(project.symbols)
      ? { symbols: cloneEditorValue(project.symbols) }
      : {}),
  };
}

export function applyEditorAIWorkingNativeOperations(
  state: EditorAIWorkingProjectState,
  operations: EditorNativeOperation[],
  options: ApplyEditorNativePatchOptions<EditorProjectLike> = {},
): ApplyEditorAIWorkingNativeResult {
  const result =
    applyEditorNativeProjectPatch(
      createWorkingProject(state),
      operations,
      {
        ...options,
        source: options.source || 'ai',
        maxOperations:
          options.maxOperations ??
          Math.max(1, operations.length),
      },
    );

  return {
    ...result,
    working: projectToWorkingState(result.project),
  };
}

export function applyEditorAIWorkingNativeOperation(
  state: EditorAIWorkingProjectState,
  operation: EditorNativeOperation,
  options: ApplyEditorNativePatchOptions<EditorProjectLike> = {},
): ApplyEditorAIWorkingNativeResult {
  return applyEditorAIWorkingNativeOperations(
    state,
    [operation],
    {
      ...options,
      maxOperations: 1,
    },
  );
}
