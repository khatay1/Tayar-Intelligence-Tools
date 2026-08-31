export type EditorLeftPanel = 'ai' | 'pages' | 'layers' | 'insert' | 'media' | 'components' | 'site' | 'settings' | 'history';
export type EditorInspectorTab = 'content' | 'design' | 'responsive' | 'settings';
export type EditorPreviewDevice = 'desktop' | 'tablet' | 'mobile';

export interface EditorLayoutState {
  leftSidebarOpen: boolean;
  leftPanel: EditorLeftPanel;
  inspectorOpen: boolean;
  inspectorTab: EditorInspectorTab;
  focusMode: boolean;
  previewDevice: EditorPreviewDevice;
}

export function createEditorLayoutState(): EditorLayoutState {
  return {
    leftSidebarOpen: true,
    leftPanel: 'ai',
    inspectorOpen: true,
    inspectorTab: 'content',
    focusMode: false,
    previewDevice: 'desktop',
  };
}

export function setEditorLeftPanel(
  state: EditorLayoutState,
  panel: EditorLeftPanel,
): EditorLayoutState {
  return { ...state, leftSidebarOpen: true, leftPanel: panel, focusMode: false };
}

export function setEditorInspectorTab(
  state: EditorLayoutState,
  tab: EditorInspectorTab,
): EditorLayoutState {
  return { ...state, inspectorOpen: true, inspectorTab: tab, focusMode: false };
}

export function toggleEditorFocusMode(state: EditorLayoutState): EditorLayoutState {
  const focusMode = !state.focusMode;
  return {
    ...state,
    focusMode,
    leftSidebarOpen: focusMode ? false : true,
    inspectorOpen: focusMode ? false : true,
  };
}

export function setEditorPreviewDevice(
  state: EditorLayoutState,
  previewDevice: EditorPreviewDevice,
): EditorLayoutState {
  return { ...state, previewDevice };
}
