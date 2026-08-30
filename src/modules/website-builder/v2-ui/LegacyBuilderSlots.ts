import type { ReactNode } from 'react';
import type { EditorInspectorTab, EditorLeftPanel } from '../core/editor-layout';
import type { EditorShellContract } from '../core/editor-shell-contract';

export interface LegacyBuilderSlots {
  brand?: ReactNode;
  topbarCenter?: ReactNode;
  topbarTrailing?: ReactNode;
  canvas: ReactNode;
  canvasOverlay?: ReactNode;
  aiPanel?: ReactNode;
  pagesPanel?: ReactNode;
  layersPanel?: ReactNode;
  insertPanel?: ReactNode;
  mediaPanel?: ReactNode;
  historyPanel?: ReactNode;
  contentInspector?: ReactNode;
  designInspector?: ReactNode;
  responsiveInspector?: ReactNode;
  settingsInspector?: ReactNode;
}

export function renderLegacyLeftPanel(slots: LegacyBuilderSlots, panel: EditorLeftPanel): ReactNode {
  switch (panel) {
    case 'ai': return slots.aiPanel;
    case 'pages': return slots.pagesPanel;
    case 'layers': return slots.layersPanel;
    case 'insert': return slots.insertPanel;
    case 'media': return slots.mediaPanel;
    case 'history': return slots.historyPanel;
  }
}

export function renderLegacyInspector(
  slots: LegacyBuilderSlots,
  _target: EditorShellContract['view']['inspectorTarget'],
  tab: EditorInspectorTab,
): ReactNode {
  switch (tab) {
    case 'content': return slots.contentInspector;
    case 'design': return slots.designInspector;
    case 'responsive': return slots.responsiveInspector;
    case 'settings': return slots.settingsInspector;
  }
}
