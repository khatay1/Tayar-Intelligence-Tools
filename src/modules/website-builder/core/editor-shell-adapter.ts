import {
  buildEditorShellViewModel,
  type EditorShellViewModel,
} from './editor-shell-view-model';
import type {
  EditorShellActions,
  EditorShellContract,
  EditorShellStatus,
} from './editor-shell-contract';
import type { EditorControllerState } from './editor-controller';
import type { EditorInspectorTab, EditorLeftPanel, EditorPreviewDevice } from './editor-layout';
import type { EditorProjectLike } from './editor-model';
import type { EditorSelection } from './editor-selection';

export interface EditorShellAdapterCallbacks {
  undo(): void;
  redo(): void;
  save(): void;
  preview(): void;
  publish(): void;
  runCheck(): void;
  toggleFocus(): void;
  toggleLeftSidebar(): void;
  toggleInspector(): void;
  openLeftPanel(panel: EditorLeftPanel): void;
  openInspectorTab(tab: EditorInspectorTab): void;
  setPreviewDevice(device: EditorPreviewDevice): void;
  select(selection: EditorSelection): void;
}

function bindActions(callbacks: EditorShellAdapterCallbacks): EditorShellActions {
  return {
    onUndo: callbacks.undo,
    onRedo: callbacks.redo,
    onSave: callbacks.save,
    onPreview: callbacks.preview,
    onPublish: callbacks.publish,
    onRunCheck: callbacks.runCheck,
    onToggleFocus: callbacks.toggleFocus,
    onToggleLeftSidebar: callbacks.toggleLeftSidebar,
    onToggleInspector: callbacks.toggleInspector,
    onOpenLeftPanel: callbacks.openLeftPanel,
    onOpenInspectorTab: callbacks.openInspectorTab,
    onSetPreviewDevice: callbacks.setPreviewDevice,
    onSelect: callbacks.select,
  };
}

export function createEditorShellContract<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  callbacks: EditorShellAdapterCallbacks,
  status: EditorShellStatus = {},
): EditorShellContract {
  return {
    view: buildEditorShellViewModel(state),
    status,
    actions: bindActions(callbacks),
  };
}

export function editorShellPublishBlocked(view: EditorShellViewModel) {
  return view.publish.blockers.length > 0;
}
