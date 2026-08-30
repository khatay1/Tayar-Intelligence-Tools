import {
  redoEditorController,
  setEditorControllerLayout,
  setEditorControllerSelection,
  undoEditorController,
  type EditorControllerState,
} from './editor-controller';
import {
  setEditorInspectorTab,
  setEditorLeftPanel,
  setEditorPreviewDevice,
  toggleEditorFocusMode,
  type EditorInspectorTab,
  type EditorLeftPanel,
  type EditorPreviewDevice,
} from './editor-layout';
import type { EditorProjectLike } from './editor-model';
import type { EditorSelection } from './editor-selection';

export type EditorUiAction =
  | { type: 'select'; selection: EditorSelection }
  | { type: 'open-left-panel'; panel: EditorLeftPanel }
  | { type: 'open-inspector-tab'; tab: EditorInspectorTab }
  | { type: 'set-preview-device'; device: EditorPreviewDevice }
  | { type: 'toggle-focus-mode' }
  | { type: 'toggle-left-sidebar' }
  | { type: 'toggle-inspector' }
  | { type: 'undo' }
  | { type: 'redo' };

export interface EditorUiActionResult<P extends EditorProjectLike> {
  state: EditorControllerState<P>;
  changed: boolean;
}

export function reduceEditorUiAction<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  action: EditorUiAction,
): EditorUiActionResult<P> {
  switch (action.type) {
    case 'select': {
      const next = setEditorControllerSelection(state, action.selection);
      return { state: next, changed: next.selection !== state.selection };
    }
    case 'open-left-panel': {
      const layout = setEditorLeftPanel(state.layout, action.panel);
      return { state: setEditorControllerLayout(state, layout), changed: layout !== state.layout };
    }
    case 'open-inspector-tab': {
      const layout = setEditorInspectorTab(state.layout, action.tab);
      return { state: setEditorControllerLayout(state, layout), changed: layout !== state.layout };
    }
    case 'set-preview-device': {
      if (state.layout.previewDevice === action.device) return { state, changed: false };
      const layout = setEditorPreviewDevice(state.layout, action.device);
      return { state: setEditorControllerLayout(state, layout), changed: true };
    }
    case 'toggle-focus-mode': {
      const layout = toggleEditorFocusMode(state.layout);
      return { state: setEditorControllerLayout(state, layout), changed: true };
    }
    case 'toggle-left-sidebar': {
      const layout = { ...state.layout, leftSidebarOpen: !state.layout.leftSidebarOpen, focusMode: false };
      return { state: setEditorControllerLayout(state, layout), changed: true };
    }
    case 'toggle-inspector': {
      const layout = { ...state.layout, inspectorOpen: !state.layout.inspectorOpen, focusMode: false };
      return { state: setEditorControllerLayout(state, layout), changed: true };
    }
    case 'undo': {
      const result = undoEditorController(state);
      return { state: result.state, changed: result.changed };
    }
    case 'redo': {
      const result = redoEditorController(state);
      return { state: result.state, changed: result.changed };
    }
  }
}
