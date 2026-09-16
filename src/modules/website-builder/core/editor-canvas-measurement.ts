import type { CanvasAlignmentTargets, CanvasBounds } from './editor-canvas-geometry';
import type { EditorCanvasTargetKind, EditorCanvasTargetRect } from './editor-canvas-overlay';

export interface EditorCanvasMeasurementInput {
  root: Element;
  pageId: string;
  scrollX?: number;
  scrollY?: number;
}

function number(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function measureEditorCanvasTargets(input: EditorCanvasMeasurementInput): EditorCanvasTargetRect[] {
  const rootRect = input.root.getBoundingClientRect();
  const sx = number(input.scrollX || 0);
  const sy = number(input.scrollY || 0);
  const nodes = Array.from(input.root.querySelectorAll<HTMLElement>('[data-tayar-editor-kind][data-tayar-editor-id]'));
  const targets: EditorCanvasTargetRect[] = [];
  for (const node of nodes) {
    const kind = node.dataset.tayarEditorKind as EditorCanvasTargetKind | undefined;
    const id = node.dataset.tayarEditorId;
    if (!id || (kind !== 'section' && kind !== 'element' && kind !== 'container')) continue;
    const rect = node.getBoundingClientRect();
    const sectionId = node.dataset.tayarSectionId || (kind === 'section' ? id : undefined);
    const elementId = kind === 'element' ? id : undefined;
    const containerId = kind === 'container' ? id : undefined;
    targets.push({
      id: `${kind}:${id}`,
      kind,
      pageId: node.dataset.tayarPageId || input.pageId,
      sectionId,
      elementId,
      containerId,
      parentContainerId: node.dataset.tayarParentContainerId,
      label: node.dataset.tayarEditorLabel,
      rect: {
        x: rect.left - rootRect.left + sx,
        y: rect.top - rootRect.top + sy,
        width: Math.max(0, rect.width),
        height: Math.max(0, rect.height),
      },
    });
  }
  return targets;
}

function targetBounds(target: EditorCanvasTargetRect): CanvasBounds {
  return { left: target.rect.x, top: target.rect.y, width: target.rect.width, height: target.rect.height };
}

export function buildCanvasAlignmentTargets(targets: EditorCanvasTargetRect[], movingTargetId: string): CanvasAlignmentTargets {
  const moving = targets.find((target) => target.id === movingTargetId);
  if (!moving) return { x: [], y: [], bounds: [] };
  const siblings = targets.filter((target) =>
    target.id !== moving.id &&
    target.kind === moving.kind &&
    target.pageId === moving.pageId &&
    target.sectionId === moving.sectionId &&
    target.parentContainerId === moving.parentContainerId,
  );
  const bounds = siblings.map(targetBounds);
  return {
    x: bounds.flatMap((item) => [item.left, item.left + (item.width / 2), item.left + item.width]),
    y: bounds.flatMap((item) => [item.top, item.top + (item.height / 2), item.top + item.height]),
    bounds,
  };
}

export function editorCanvasMeasurementAttributes(target: {
  kind: EditorCanvasTargetKind;
  id: string;
  pageId?: string;
  sectionId?: string;
  parentContainerId?: string;
  label?: string;
}) {
  return {
    'data-tayar-editor-kind': target.kind,
    'data-tayar-editor-id': target.id,
    'data-tayar-page-id': target.pageId,
    'data-tayar-section-id': target.sectionId,
    'data-tayar-parent-container-id': target.parentContainerId,
    'data-tayar-editor-label': target.label,
  };
}
