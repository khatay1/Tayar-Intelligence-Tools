import { createEditorProjectIndex } from './editor-index';
import { buildEditorNavigationModel, resolveEditorInspectorTarget } from './editor-navigation-model';
import { checkEditorPublishReadiness } from './editor-publish-readiness';
import { isEditorSessionDirty } from './editor-session';
import { buildEditorHistoryView } from './editor-history-view';
import type { EditorControllerState } from './editor-controller';
import type { EditorProjectLike } from './editor-model';

export interface EditorShellViewModel {
  revision: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  focusMode: boolean;
  leftSidebarOpen: boolean;
  inspectorOpen: boolean;
  previewDevice: 'desktop' | 'tablet' | 'mobile';
  leftPanel: string;
  inspectorTab: string;
  counts: {
    pages: number;
    sections: number;
    elements: number;
    containers: number;
    formFields: number;
    symbols: number;
  };
  navigation: ReturnType<typeof buildEditorNavigationModel>;
  inspectorTarget: ReturnType<typeof resolveEditorInspectorTarget>;
  publish: ReturnType<typeof checkEditorPublishReadiness>;
  history: ReturnType<typeof buildEditorHistoryView>;
}

export function buildEditorShellViewModel<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
): EditorShellViewModel {
  const index = createEditorProjectIndex(state.session.project);
  return {
    revision: state.session.revision,
    dirty: isEditorSessionDirty(state.session),
    canUndo: state.session.history.past.length > 0,
    canRedo: state.session.history.future.length > 0,
    focusMode: state.layout.focusMode,
    leftSidebarOpen: state.layout.leftSidebarOpen,
    inspectorOpen: state.layout.inspectorOpen,
    previewDevice: state.layout.previewDevice,
    leftPanel: state.layout.leftPanel,
    inspectorTab: state.layout.inspectorTab,
    counts: index.counts,
    navigation: buildEditorNavigationModel(state.session.project, state.selection),
    inspectorTarget: resolveEditorInspectorTarget(state.selection || {}),
    publish: checkEditorPublishReadiness(state.session.project),
    history: buildEditorHistoryView(state.session.history),
  };
}
