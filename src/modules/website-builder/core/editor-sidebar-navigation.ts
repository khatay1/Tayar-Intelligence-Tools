import { EDITOR_LEFT_PANEL_REGISTRY } from './editor-shell-contract';
import type { EditorLeftPanel } from './editor-layout';

export function resolveEditorSidebarKey(
  current: EditorLeftPanel,
  key: string,
): EditorLeftPanel | undefined {
  const panels = EDITOR_LEFT_PANEL_REGISTRY.map((entry) => entry.id as EditorLeftPanel);
  const currentIndex = Math.max(0, panels.indexOf(current));
  if (key === 'ArrowDown' || key === 'ArrowRight') return panels[(currentIndex + 1) % panels.length];
  if (key === 'ArrowUp' || key === 'ArrowLeft') return panels[(currentIndex - 1 + panels.length) % panels.length];
  if (key === 'Home') return panels[0];
  if (key === 'End') return panels[panels.length - 1];
  const shortcut = EDITOR_LEFT_PANEL_REGISTRY.find((entry) => entry.shortcut === key);
  return shortcut?.id as EditorLeftPanel | undefined;
}
