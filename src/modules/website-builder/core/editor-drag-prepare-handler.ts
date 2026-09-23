import type * as React from 'react';
import type { CanvasAlignmentTargets,CanvasBounds,CanvasSnapGuides } from '../core/editor-canvas-geometry';
import type { Device,WebsiteElement,WebsiteSection } from '../core/types';
import { clampElementNumber,effectiveStyle } from '../core/website-builder-rendering';

interface createPrepareElementFreeDragHandlerDependencies {
  activePageId: string;
  device: Device;
  draggedElementRef: React.MutableRefObject<string | null>;
  draggedElementSectionRef: React.MutableRefObject<string | null>;
  freeElementDragRef: React.MutableRefObject<{ pageId: string; device: Device; sectionId: string; elementId: string; symbolId?: string; startClientX: number; startClientY: number; canvasScale: number; startX: number; startY: number; currentX: number; currentY: number; groupTargets: Array<{ id: string; symbolId?: string; startX: number; startY: number; currentX: number; currentY: number; }>; elementBounds?: CanvasBounds; sectionBounds?: CanvasBounds; alignmentTargets?: CanvasAlignmentTargets; snapHorizontal: boolean; snapVertical: boolean; started: boolean; snapHorizontalPosition?: number; snapVerticalPosition?: number; } | null>;
  remember: (current: WebsiteSection[], label?: string) => void;
  sections: WebsiteSection[];
  selectedElementIds: string[];
  selectedElements: WebsiteElement[];
  selectedId: string | null;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  setCanvasSnapGuide: React.Dispatch<React.SetStateAction<({ sectionId: string; } & CanvasSnapGuides) | null>>;
  setDraggedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setDragOverElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setDragOverElementPosition: React.Dispatch<React.SetStateAction<"before" | "after" | null>>;
}

export function createPrepareElementFreeDragHandler({
  activePageId,
  device,
  draggedElementRef,
  draggedElementSectionRef,
  freeElementDragRef,
  remember,
  sections,
  selectedElementIds,
  selectedElements,
  selectedId,
  selectEditorTarget,
  setCanvasSnapGuide,
  setDraggedElementId,
  setDragOverElementId,
  setDragOverElementPosition,
}: createPrepareElementFreeDragHandlerDependencies) {
  return function prepareElementFreeDrag(
    sectionId: string,
    id: string,
    clientX: number,
    clientY: number,
    target: HTMLElement,
    started: boolean,
  ) {
    const sourceSection = sections.find((section) => section.id === sectionId);
    const sourceElement = sourceSection?.elements.find((element) => element.id === id);
    if (!sourceSection || !sourceElement) return false;
    const groupElements = !started && selectedId === sectionId && selectedElementIds.includes(id) && selectedElements.length > 1
      ? selectedElements
      : [sourceElement];
    const groupElementIds = new Set(groupElements.map((element) => element.id));
    if (started) remember(sections, 'Move element');
    draggedElementRef.current = id;
    draggedElementSectionRef.current = sectionId;
    const sourceStyle = effectiveStyle(sourceElement, device);
    const zoomHost = target.closest<HTMLElement>('[data-zoom]');
    const canvasScale = Math.min(1.5, Math.max(0.5, Number(zoomHost?.dataset.zoom || 100) / 100));
    const sectionHost = target.closest<HTMLElement>('[data-tayar-section-canvas="true"]');
    const sectionRect = sectionHost?.getBoundingClientRect();
    const canvasElementNodes = sectionHost
      ? Array.from(sectionHost.querySelectorAll<HTMLElement>('[data-tayar-canvas-element-id]'))
      : [];
    const movingBounds = canvasElementNodes
      .filter((node) => groupElementIds.has(node.dataset.tayarCanvasElementId || ''))
      .map((node) => node.getBoundingClientRect());
    const targetRect = target.getBoundingClientRect();
    const elementRect = movingBounds.length > 1
      ? movingBounds.reduce((bounds, rect) => ({
          left: Math.min(bounds.left, rect.left),
          top: Math.min(bounds.top, rect.top),
          right: Math.max(bounds.right, rect.right),
          bottom: Math.max(bounds.bottom, rect.bottom),
        }), { left: targetRect.left, top: targetRect.top, right: targetRect.right, bottom: targetRect.bottom })
      : { left: targetRect.left, top: targetRect.top, right: targetRect.right, bottom: targetRect.bottom };
    const siblingBounds = sectionHost
      ? canvasElementNodes
          .filter((node) => !groupElementIds.has(node.dataset.tayarCanvasElementId || ''))
          .map((node) => node.getBoundingClientRect())
      : [];
    const alignmentTargets: CanvasAlignmentTargets = {
      x: siblingBounds.flatMap((bounds) => [
        bounds.left / canvasScale,
        (bounds.left + (bounds.width / 2)) / canvasScale,
        bounds.right / canvasScale,
      ]),
      y: siblingBounds.flatMap((bounds) => [
        bounds.top / canvasScale,
        (bounds.top + (bounds.height / 2)) / canvasScale,
        bounds.bottom / canvasScale,
      ]),
    };
    freeElementDragRef.current = {
      pageId: activePageId,
      device,
      sectionId,
      elementId: id,
      symbolId: sourceElement.symbolId,
      startClientX: clientX,
      startClientY: clientY,
      canvasScale,
      startX: clampElementNumber(sourceStyle.positionX, 0, -4000, 4000),
      startY: clampElementNumber(sourceStyle.positionY, 0, -4000, 4000),
      currentX: clampElementNumber(sourceStyle.positionX, 0, -4000, 4000),
      currentY: clampElementNumber(sourceStyle.positionY, 0, -4000, 4000),
      groupTargets: groupElements.map((element) => {
        const style = effectiveStyle(element, device);
        const startX = clampElementNumber(style.positionX, 0, -4000, 4000);
        const startY = clampElementNumber(style.positionY, 0, -4000, 4000);
        return { id: element.id, symbolId: element.symbolId, startX, startY, currentX: startX, currentY: startY };
      }),
      elementBounds: {
        left: elementRect.left / canvasScale,
        top: elementRect.top / canvasScale,
        width: (elementRect.right - elementRect.left) / canvasScale,
        height: (elementRect.bottom - elementRect.top) / canvasScale,
      },
      sectionBounds: sectionRect ? {
        left: sectionRect.left / canvasScale,
        top: sectionRect.top / canvasScale,
        width: sectionRect.width / canvasScale,
        height: sectionRect.height / canvasScale,
      } : undefined,
      alignmentTargets,
      snapHorizontal: false,
      snapVertical: false,
      started,
    };
    setCanvasSnapGuide(null);
    setDraggedElementId(started ? id : null);
    setDragOverElementId(null);
    setDragOverElementPosition(null);
    if (groupElements.length === 1) selectEditorTarget(sectionId, id);
    return true;
  };
}
