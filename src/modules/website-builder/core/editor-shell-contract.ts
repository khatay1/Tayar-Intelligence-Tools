import type { EditorInspectorTab, EditorLeftPanel, EditorPreviewDevice } from './editor-layout';
import type { EditorShellViewModel } from './editor-shell-view-model';
import type { EditorSelection } from './editor-selection';

export interface EditorShellActions {
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onPreview(): void;
  onPublish(): void;
  onRunCheck(): void;
  onToggleFocus(): void;
  onToggleLeftSidebar(): void;
  onToggleInspector(): void;
  onOpenLeftPanel(panel: EditorLeftPanel): void;
  onOpenInspectorTab(tab: EditorInspectorTab): void;
  onSetPreviewDevice(device: EditorPreviewDevice): void;
  onSelect(selection: EditorSelection): void;
}

export interface EditorShellStatus {
  saving?: boolean;
  publishing?: boolean;
  checking?: boolean;
  saveError?: string;
  publishError?: string;
  lastSavedAt?: number;
  checkScore?: number;
  checkErrors?: number;
  checkWarnings?: number;
  lastCheckedAt?: number;
  publishedUrl?: string;
  publishedAt?: number;
  publishedOutdated?: boolean;
  liveVerification?: 'idle' | 'checking' | 'healthy' | 'failed';
}

export interface EditorShellContract {
  view: EditorShellViewModel;
  status: EditorShellStatus;
  actions: EditorShellActions;
}

export type EditorShellPanelId = EditorLeftPanel | 'inspector' | 'canvas' | 'topbar' | 'statusbar';

export interface EditorPanelRegistration {
  id: EditorShellPanelId;
  label: string;
  order: number;
  shortcut?: string;
  compactLabel?: string;
}

export const EDITOR_LEFT_PANEL_REGISTRY: EditorPanelRegistration[] = [
  { id: 'ai', label: 'Tayar AI', compactLabel: 'AI', order: 10, shortcut: '1' },
  { id: 'pages', label: 'Pages', order: 20, shortcut: '2' },
  { id: 'layers', label: 'Layers', order: 30, shortcut: '3' },
  { id: 'insert', label: 'Insert', order: 40, shortcut: '4' },
  { id: 'media', label: 'Media', order: 50, shortcut: '5' },
  { id: 'components', label: 'Components', order: 60, shortcut: '6' },
  { id: 'site', label: 'Site', order: 70, shortcut: '7' },
  { id: 'settings', label: 'Settings', order: 80, shortcut: '8' },
  { id: 'history', label: 'History', order: 90, shortcut: '9' },
];
