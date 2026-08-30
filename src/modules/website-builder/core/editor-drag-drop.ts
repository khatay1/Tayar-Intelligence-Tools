import type { EditorCanvasTargetRect } from './editor-canvas-overlay';
import type { EditorNativeOperation } from './editor-native-operation';
import type { EditorProjectLike } from './editor-model';
import { findEditorElement, findEditorSection } from './editor-model';

export type EditorDragKind = 'section' | 'element';
export interface EditorDragPayload { kind: EditorDragKind; pageId: string; sectionId: string; elementId?: string; }
export interface EditorDropIntent { axis: 'before' | 'after' | 'inside'; targetId: string; operation?: EditorNativeOperation; error?: string; }

function midpoint(target: EditorCanvasTargetRect) { return target.rect.y + target.rect.height / 2; }

export function resolveEditorDropIntent<P extends EditorProjectLike>(
  project: P,
  drag: EditorDragPayload,
  target: EditorCanvasTargetRect,
  pointerY: number,
): EditorDropIntent {
  const before = pointerY < midpoint(target);
  if (drag.kind === 'section') {
    if (target.kind !== 'section' || target.pageId !== drag.pageId || !target.sectionId) {
      return { axis: 'inside', targetId: target.id, error: 'Sections can only be reordered within the active page.' };
    }
    if (!findEditorSection(project, drag.pageId, drag.sectionId)) return { axis: before ? 'before' : 'after', targetId: target.id, error: 'Dragged section no longer exists.' };
    if (drag.sectionId === target.sectionId) return { axis: before ? 'before' : 'after', targetId: target.id };
    return {
      axis: before ? 'before' : 'after',
      targetId: target.id,
      operation: { action: 'move_section', pageId: drag.pageId, sectionId: drag.sectionId, position: before ? { beforeId: target.sectionId } : { afterId: target.sectionId } },
    };
  }

  if (!drag.elementId || !findEditorElement(project, drag.pageId, drag.sectionId, drag.elementId)) {
    return { axis: before ? 'before' : 'after', targetId: target.id, error: 'Dragged element no longer exists.' };
  }
  if (target.kind !== 'element' || target.pageId !== drag.pageId || target.sectionId !== drag.sectionId || !target.elementId) {
    return { axis: 'inside', targetId: target.id, error: 'Element reordering is limited to its current section in this safe V2 stage.' };
  }
  if (drag.elementId === target.elementId) return { axis: before ? 'before' : 'after', targetId: target.id };
  return {
    axis: before ? 'before' : 'after',
    targetId: target.id,
    operation: { action: 'move_element', pageId: drag.pageId, sectionId: drag.sectionId, elementId: drag.elementId, position: before ? { beforeId: target.elementId } : { afterId: target.elementId } },
  };
}
