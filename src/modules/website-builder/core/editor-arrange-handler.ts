import type * as React from 'react';
import { arrangeCanvasElements,settledCanvasElementRect } from '../core/editor-arrangement';
import type { Device,WebsiteElement,WebsiteSection } from '../core/types';
import type { WebsitePage,WebsiteSymbol } from '../core/website-builder-model';
import { clampElementNumber,sectionDomId } from '../core/website-builder-rendering';

interface createArrangeSelectedElementsHandlerDependencies {
  activePageId: string;
  canvasArrangementRef: React.MutableRefObject<{ key: string; appliedAt: number; } | null>;
  device: Device;
  remember: (current: WebsiteSection[], label?: string) => void;
  sections: WebsiteSection[];
  selectedElements: WebsiteElement[];
  selectedSection: WebsiteSection | null;
  setPages: React.Dispatch<React.SetStateAction<WebsitePage[]>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  setSymbols: React.Dispatch<React.SetStateAction<WebsiteSymbol[]>>;
}

export function createArrangeSelectedElementsHandler({
  activePageId,
  canvasArrangementRef,
  device,
  remember,
  sections,
  selectedElements,
  selectedSection,
  setPages,
  setSaved,
  setSections,
  setSymbols,
}: createArrangeSelectedElementsHandlerDependencies) {
  return function arrangeSelectedElements(action: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-horizontal' | 'distribute-vertical') {
    if (!selectedSection || selectedElements.length < 2) return;
    if ((action === 'distribute-horizontal' || action === 'distribute-vertical') && selectedElements.length < 3) return;
    const arrangementKey = `${activePageId}:${selectedSection.id}:${device}:${action}:${selectedElements.map((element) => element.id).sort().join(',')}`;
    const previousArrangement = canvasArrangementRef.current;
    if (previousArrangement?.key === arrangementKey && performance.now() - previousArrangement.appliedAt < 250) return;

    const sectionHost = document.getElementById(sectionDomId(selectedSection));
    if (!sectionHost) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const measured = Array.from(sectionHost.querySelectorAll<HTMLElement>('[data-tayar-canvas-element-id]'))
      .filter((node) => selectedIds.has(node.dataset.tayarCanvasElementId || ''))
      .map((node) => ({
        id: node.dataset.tayarCanvasElementId || '',
        rect: settledCanvasElementRect(node),
        x: clampElementNumber(node.dataset.tayarCanvasPositionX, 0, -4000, 4000),
        y: clampElementNumber(node.dataset.tayarCanvasPositionY, 0, -4000, 4000),
      }));
    if (measured.length !== selectedElements.length) return;

    const zoomHost = sectionHost.closest<HTMLElement>('[data-zoom]');
    const canvasScale = Math.min(1.5, Math.max(0.5, Number(zoomHost?.dataset.zoom || 100) / 100));
    // The DOM carries the committed document offsets. Reading them here avoids
    // calculating a second rapid command from a stale React event closure.
    const positions = arrangeCanvasElements(measured, action, canvasScale);
    if (!positions.size) return;
    const committedPositions = new Map(measured.map(({ id, x, y }) => [id, { x, y }]));
    const preArrangementSections = sections.map((section) => section.id !== selectedSection.id ? section : {
      ...section,
      elements: section.elements.map((element) => {
        const committed = committedPositions.get(element.id);
        return committed ? {
          ...element,
          responsive: {
            ...element.responsive,
            [device]: {
              ...(element.responsive?.[device] || {}),
              positionX: committed.x,
              positionY: committed.y,
            },
          },
        } : element;
      }),
    });
    // Ignore an immediate duplicate command until React has committed these offsets.
    canvasArrangementRef.current = { key: arrangementKey, appliedAt: performance.now() };

    const symbolPositions = new Map<string, { x?: number; y?: number }>();
    selectedElements.forEach((element) => {
      const position = positions.get(element.id);
      if (position && element.symbolId && !symbolPositions.has(element.symbolId)) symbolPositions.set(element.symbolId, position);
    });
    const updatePosition = (element: WebsiteElement, position: { x?: number; y?: number }): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          ...(position.x === undefined ? {} : { positionX: position.x }),
          ...(position.y === undefined ? {} : { positionY: position.y }),
        },
      },
    });
    const arrangeSection = (section: WebsiteSection, linkedOnly = false): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const position = element.symbolId ? symbolPositions.get(element.symbolId) : linkedOnly ? undefined : positions.get(element.id);
        return position ? updatePosition(element, position) : element;
      }),
    });

    remember(preArrangementSections, action.startsWith('distribute') ? 'Distribute selected elements' : 'Align selected elements');
    setSections((current) => current.map((section) => arrangeSection(section)));
    if (symbolPositions.size) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map((section) => arrangeSection(section, true)),
      }));
      setSymbols((current) => current.map((symbol) => {
        const position = symbolPositions.get(symbol.id);
        return position ? {
          ...symbol,
          element: updatePosition(symbol.element, position),
          updatedAt: new Date().toISOString(),
        } : symbol;
      }));
    }
    setSaved(false);
  };
}
