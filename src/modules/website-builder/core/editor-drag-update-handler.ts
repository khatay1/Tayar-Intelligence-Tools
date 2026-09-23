import type * as React from 'react';
import type { CanvasAlignmentTargets,CanvasBounds,CanvasSnapGuides } from '../core/editor-canvas-geometry';
import { resolveCanvasDragPosition } from '../core/editor-canvas-geometry';
import type { Device,WebsiteSection } from '../core/types';

interface createUpdateElementFreeDragHandlerDependencies {
  activePageId: string;
  freeElementDragRef: React.MutableRefObject<{ pageId: string; device: Device; sectionId: string; elementId: string; symbolId?: string; startClientX: number; startClientY: number; canvasScale: number; startX: number; startY: number; currentX: number; currentY: number; groupTargets: Array<{ id: string; symbolId?: string; startX: number; startY: number; currentX: number; currentY: number; }>; elementBounds?: CanvasBounds; sectionBounds?: CanvasBounds; alignmentTargets?: CanvasAlignmentTargets; snapHorizontal: boolean; snapVertical: boolean; started: boolean; snapHorizontalPosition?: number; snapVerticalPosition?: number; } | null>;
  setCanvasSnapGuide: React.Dispatch<React.SetStateAction<({ sectionId: string; } & CanvasSnapGuides) | null>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
}

export function createUpdateElementFreeDragHandler({
  activePageId,
  freeElementDragRef,
  setCanvasSnapGuide,
  setSaved,
  setSections,
}: createUpdateElementFreeDragHandlerDependencies) {
  return function updateElementFreeDrag(
    sectionId: string,
    id: string,
    clientX: number,
    clientY: number,
    precisionMode: boolean,
  ) {
    const drag = freeElementDragRef.current;
    if (
      !drag ||
      !drag.started ||
      drag.pageId !== activePageId ||
      drag.sectionId !== sectionId ||
      drag.elementId !== id
    ) {
      return;
    }

    const nextPosition = resolveCanvasDragPosition({
      startX: drag.startX,
      startY: drag.startY,
      deltaX: (clientX - drag.startClientX) / drag.canvasScale,
      deltaY: (clientY - drag.startClientY) / drag.canvasScale,
      precisionMode,
      elementBounds: drag.elementBounds,
      sectionBounds: drag.sectionBounds,
      alignmentTargets: drag.alignmentTargets,
    });
    const nextX = nextPosition.x;
    const nextY = nextPosition.y;
    if (
      nextPosition.guides.horizontal !== drag.snapHorizontal ||
      nextPosition.guides.vertical !== drag.snapVertical ||
      nextPosition.guides.horizontalPosition !== drag.snapHorizontalPosition ||
      nextPosition.guides.verticalPosition !== drag.snapVerticalPosition
    ) {
      drag.snapHorizontal = nextPosition.guides.horizontal;
      drag.snapVertical = nextPosition.guides.vertical;
      drag.snapHorizontalPosition = nextPosition.guides.horizontalPosition;
      drag.snapVerticalPosition = nextPosition.guides.verticalPosition;
      setCanvasSnapGuide(
        nextPosition.guides.horizontal || nextPosition.guides.vertical
          ? {
              sectionId,
              ...nextPosition.guides,
              horizontalPosition: nextPosition.guides.horizontalPosition === undefined || !drag.sectionBounds
                ? undefined
                : nextPosition.guides.horizontalPosition - drag.sectionBounds.top,
              verticalPosition: nextPosition.guides.verticalPosition === undefined || !drag.sectionBounds
                ? undefined
                : nextPosition.guides.verticalPosition - drag.sectionBounds.left,
            }
          : null,
      );
    }
    if (nextX === drag.currentX && nextY === drag.currentY) return;
    drag.currentX = nextX;
    drag.currentY = nextY;
    const deltaX = nextX - drag.startX;
    const deltaY = nextY - drag.startY;
    const targetById = new Map(drag.groupTargets.map((target) => {
      target.currentX = Math.max(-4000, Math.min(4000, target.startX + deltaX));
      target.currentY = Math.max(-4000, Math.min(4000, target.startY + deltaY));
      return [target.id, target] as const;
    }));
    const targetBySymbol = new Map(drag.groupTargets.flatMap((target) => target.symbolId ? [[target.symbolId, target] as const] : []));

    setSections((current) => current.map((section) => ({
      ...section,
      elements: section.elements.map((element) => {
        const groupTarget = element.symbolId
          ? targetBySymbol.get(element.symbolId)
          : section.id === sectionId ? targetById.get(element.id) : undefined;
        if (!groupTarget) return element;
        return {
          ...element,
          responsive: {
            ...element.responsive,
            [drag.device]: {
              ...(element.responsive?.[drag.device] || {}),
              positionX: groupTarget.currentX,
              positionY: groupTarget.currentY,
            },
          },
        };
      }),
    })));
    setSaved(false);
  };
}
