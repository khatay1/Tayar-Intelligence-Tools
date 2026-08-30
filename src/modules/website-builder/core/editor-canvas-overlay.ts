import type { EditorSelection } from './editor-selection';

export type EditorCanvasTargetKind = 'section' | 'element' | 'container';

export interface EditorCanvasTargetRect {
  id: string;
  kind: EditorCanvasTargetKind;
  pageId: string;
  sectionId?: string;
  elementId?: string;
  containerId?: string;
  label?: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface EditorCanvasOverlayItem extends EditorCanvasTargetRect {
  selected: boolean;
  active: boolean;
}

function matchesSelection(target: EditorCanvasTargetRect, selection: EditorSelection) {
  if (target.pageId !== selection.pageId) return false;
  if (target.kind === 'element') return Boolean(target.elementId && target.elementId === selection.elementId);
  if (target.kind === 'container') return Boolean(target.containerId && target.containerId === selection.containerId);
  return Boolean(target.sectionId && target.sectionId === selection.sectionId && !selection.elementId && !selection.containerId);
}

export function buildEditorCanvasOverlay(
  targets: EditorCanvasTargetRect[],
  selection: EditorSelection = {},
  activeTargetId?: string,
): EditorCanvasOverlayItem[] {
  return targets
    .filter((target) => target.rect.width >= 0 && target.rect.height >= 0)
    .map((target) => ({
      ...target,
      selected: matchesSelection(target, selection),
      active: target.id === activeTargetId,
    }));
}

export function selectionForEditorCanvasTarget(target: EditorCanvasTargetRect): EditorSelection {
  if (target.kind === 'element') {
    return { pageId: target.pageId, sectionId: target.sectionId, elementId: target.elementId };
  }
  if (target.kind === 'container') {
    return { pageId: target.pageId, sectionId: target.sectionId, containerId: target.containerId };
  }
  return { pageId: target.pageId, sectionId: target.sectionId };
}
