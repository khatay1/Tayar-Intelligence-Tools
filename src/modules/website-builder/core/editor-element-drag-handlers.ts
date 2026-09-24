import type * as React from 'react';
import type { WebsiteElement, WebsiteSection } from './types';
import type { WebsitePage, WebsiteSymbol } from './website-builder-model';
import { createPrepareElementFreeDragHandler } from './editor-drag-prepare-handler';
import { createUpdateElementFreeDragHandler } from './editor-drag-update-handler';

type PrepareDragContext = Parameters<typeof createPrepareElementFreeDragHandler>[0];

interface ElementDragContext {
  activePageId: string;
  sections: WebsiteSection[];
  freeElementDragRef: PrepareDragContext['freeElementDragRef'];
  draggedElementRef: PrepareDragContext['draggedElementRef'];
  draggedElementSectionRef: PrepareDragContext['draggedElementSectionRef'];
  setCanvasSnapGuide: PrepareDragContext['setCanvasSnapGuide'];
  setDraggedElementId: PrepareDragContext['setDraggedElementId'];
  setDragOverElementId: PrepareDragContext['setDragOverElementId'];
  setDragOverElementPosition: PrepareDragContext['setDragOverElementPosition'];
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  setPages: React.Dispatch<React.SetStateAction<WebsitePage[]>>;
  setSymbols: React.Dispatch<React.SetStateAction<WebsiteSymbol[]>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  prepareElementFreeDrag: ReturnType<typeof createPrepareElementFreeDragHandler>;
  updateElementFreeDrag: ReturnType<typeof createUpdateElementFreeDragHandler>;
  remember: (sections: WebsiteSection[], label?: string) => void;
  selectEditorTarget: PrepareDragContext['selectEditorTarget'];
}

export function createElementDragHandlers({
  activePageId, sections, freeElementDragRef, draggedElementRef, draggedElementSectionRef,
  setCanvasSnapGuide, setDraggedElementId, setDragOverElementId, setDragOverElementPosition,
  setSections, setPages, setSymbols, setSaved, prepareElementFreeDrag, updateElementFreeDrag,
  remember, selectEditorTarget,
}: ElementDragContext) {
  function handleElementDragStart(sectionId: string, id: string, e: React.DragEvent) {
    if (!prepareElementFreeDrag(sectionId, id, e.clientX, e.clientY, e.currentTarget as HTMLElement, true)) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-tayar-element', id);
    e.dataTransfer.setData('application/x-tayar-section', sectionId);
  }

  function handleElementDragMove(sectionId: string, id: string, e: React.DragEvent) {
    const drag = freeElementDragRef.current;
    if (
      !drag ||
      drag.pageId !== activePageId ||
      drag.sectionId !== sectionId ||
      drag.elementId !== id
    ) {
      return;
    }
    if (!e.clientX && !e.clientY) return;
    if (e.shiftKey) {
      if (drag.snapHorizontal || drag.snapVertical) {
        drag.snapHorizontal = false;
        drag.snapVertical = false;
        drag.snapHorizontalPosition = undefined;
        drag.snapVerticalPosition = undefined;
        setCanvasSnapGuide(null);
      }
      return;
    }

    updateElementFreeDrag(sectionId, id, e.clientX, e.clientY, e.altKey);
  }

  function handleElementPointerDragStart(sectionId: string, id: string, e: React.PointerEvent<HTMLElement>) {
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    if (!prepareElementFreeDrag(sectionId, id, e.clientX, e.clientY, target, false)) return;

    const finishPointerDrag = (finishEvent?: Event) => {
      if (finishEvent instanceof PointerEvent && finishEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointerDrag);
      window.removeEventListener('pointercancel', finishPointerDrag);
      window.removeEventListener('blur', finishPointerDrag);
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
      handleElementDragEnd();
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const drag = freeElementDragRef.current;
      if (!drag || drag.pageId !== activePageId || drag.elementId !== id) {
        finishPointerDrag(moveEvent);
        return;
      }
      if (!drag.started) {
        const distance = Math.hypot(
          moveEvent.clientX - drag.startClientX,
          moveEvent.clientY - drag.startClientY,
        );
        if (distance < 3) return;
        drag.started = true;
        remember(sections, drag.groupTargets.length > 1 ? 'Move selected elements' : 'Move element');
        setDraggedElementId(id);
      }
      moveEvent.preventDefault();
      updateElementFreeDrag(sectionId, id, moveEvent.clientX, moveEvent.clientY, moveEvent.altKey);
    };

    target.setPointerCapture?.(pointerId);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishPointerDrag);
    window.addEventListener('pointercancel', finishPointerDrag);
    window.addEventListener('blur', finishPointerDrag, { once: true });
  }

  function handleElementDragOver(targetSectionId: string, targetId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (!e.shiftKey) {
      setDragOverElementId(null);
      setDragOverElementPosition(null);
      return;
    }

    const sourceId = draggedElementRef.current;
    const sourceSectionId = draggedElementSectionRef.current;
    const drag = freeElementDragRef.current;
    if (
      !sourceId ||
      !sourceSectionId ||
      !drag ||
      drag.pageId !== activePageId ||
      sourceId === targetId
    ) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverElementId(targetId);
    setDragOverElementPosition(position);

    setSections((current) => {
      const sourceSection = current.find((section) => section.id === sourceSectionId);
      const targetSection = current.find((section) => section.id === targetSectionId);
      if (!sourceSection || !targetSection) return current;

      const sourceElement = sourceSection.elements.find((element) => element.id === sourceId);
      if (!sourceElement) return current;

      // Build the target list without the dragged element first so the insertion index is stable.
      const targetWithoutSource = targetSection.elements.filter((element) => element.id !== sourceId);
      const targetIndex = targetWithoutSource.findIndex((element) => element.id === targetId);
      if (targetIndex === -1) return current;
      const insertAt = targetIndex + (position === 'after' ? 1 : 0);

      if (sourceSectionId === targetSectionId) {
        const originalIndex = sourceSection.elements.findIndex((element) => element.id === sourceId);
        const currentWithoutSource = sourceSection.elements.filter((element) => element.id !== sourceId);
        const currentInsertAt = Math.min(insertAt, currentWithoutSource.length);
        if (originalIndex === currentInsertAt) return current;

        const nextElements = [...currentWithoutSource];
        nextElements.splice(currentInsertAt, 0, sourceElement);
        return current.map((section) => section.id === sourceSectionId ? { ...section, elements: nextElements } : section);
      }

      const movedElement: WebsiteElement = {
        ...sourceElement,
        containerId: undefined,
        layoutColumn: undefined,
      };
      const nextTargetElements = [...targetWithoutSource];
      nextTargetElements.splice(Math.min(insertAt, nextTargetElements.length), 0, movedElement);
      return current.map((section) => {
        if (section.id === sourceSectionId) return { ...section, elements: section.elements.filter((element) => element.id !== sourceId) };
        if (section.id === targetSectionId) return { ...section, elements: nextTargetElements };
        return section;
      });
    });

    if (sourceSectionId !== targetSectionId) {
      draggedElementSectionRef.current = targetSectionId;
      drag.sectionId = targetSectionId;
      selectEditorTarget(targetSectionId, sourceId);
    }

    setSaved(false);
  }

  function handleElementDrop(targetSectionId: string, targetId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedElementRef.current || e.dataTransfer.getData('application/x-tayar-element');
    const drag = freeElementDragRef.current;
    if (
      sourceId &&
      e.shiftKey &&
      drag?.pageId === activePageId
    ) {
      selectEditorTarget(targetSectionId, sourceId);
      setDragOverElementId(targetId);
    }
    handleElementDragEnd();
  }

  function handleElementDragEnd() {
    const drag = freeElementDragRef.current;
    if (drag?.started && drag.pageId === activePageId) {
      const symbolTargets = new Map(drag.groupTargets.flatMap((target) => target.symbolId ? [[target.symbolId, target] as const] : []));
      if (symbolTargets.size) {
        setPages((current) => current.map((page) =>
          page.id === drag.pageId
            ? page
            : {
                ...page,
                sections: page.sections.map((section) => ({
                  ...section,
                  elements: section.elements.map((element) => {
                    const groupTarget = element.symbolId ? symbolTargets.get(element.symbolId) : undefined;
                    return groupTarget ? {
                      ...element,
                      responsive: {
                        ...element.responsive,
                        [drag.device]: {
                          ...(element.responsive?.[drag.device] || {}),
                          positionX: groupTarget.currentX,
                          positionY: groupTarget.currentY,
                        },
                      },
                    } : element;
                  }),
                })),
              }
        ));
        setSymbols((current) => current.map((symbol) => {
          const groupTarget = symbolTargets.get(symbol.id);
          return groupTarget ? {
            ...symbol,
            element: {
              ...symbol.element,
              responsive: {
                ...symbol.element.responsive,
                [drag.device]: {
                  ...(symbol.element.responsive?.[drag.device] || {}),
                  positionX: groupTarget.currentX,
                  positionY: groupTarget.currentY,
                },
              },
            },
            updatedAt: new Date().toISOString(),
          } : symbol;
        }));
      }
    }
    freeElementDragRef.current = null;
    setCanvasSnapGuide(null);
    draggedElementRef.current = null;
    draggedElementSectionRef.current = null;
    setDraggedElementId(null);
    setDragOverElementId(null);
    setDragOverElementPosition(null);
  }

  return { handleElementDragStart, handleElementDragMove, handleElementPointerDragStart, handleElementDragOver, handleElementDrop, handleElementDragEnd };
}
