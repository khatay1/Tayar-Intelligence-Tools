import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Device, WebsiteElement, WebsiteSection } from './types';
import type { WebsitePage, WebsiteSymbol } from './website-builder-model';
import { clampElementNumber, effectiveStyle } from './website-builder-rendering';

interface ElementArrangementContext {
  activePageId: string;
  device: Device;
  sections: WebsiteSection[];
  selectedSection: WebsiteSection | null;
  selectedElement: WebsiteElement | null;
  selectedElements: WebsiteElement[];
  canvasNudgeSessionRef: MutableRefObject<string | null>;
  remember: (sections: WebsiteSection[], label?: string) => void;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setPages: Dispatch<SetStateAction<WebsitePage[]>>;
  setSymbols: Dispatch<SetStateAction<WebsiteSymbol[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setSelectedContainerId: Dispatch<SetStateAction<string | null>>;
}

export function createElementArrangementHandlers({
  activePageId, device, sections, selectedSection, selectedElement, selectedElements,
  canvasNudgeSessionRef, remember, setSections, setPages, setSymbols, setSaved, setSelectedContainerId,
}: ElementArrangementContext) {
  function nudgeSelectedElement(deltaX: number, deltaY: number) {
    if (!selectedSection || !selectedElement) return;
    const targets = selectedElements.length > 1 ? selectedElements : [selectedElement];
    const directIds = new Set(targets.filter((element) => !element.symbolId).map((element) => element.id));
    const symbolIds = new Set(targets.flatMap((element) => element.symbolId ? [element.symbolId] : []));
    const canMove = targets.some((element) => {
      const style = effectiveStyle(element, device);
      const currentX = clampElementNumber(style.positionX, 0, -4000, 4000);
      const currentY = clampElementNumber(style.positionY, 0, -4000, 4000);
      return Math.max(-4000, Math.min(4000, currentX + deltaX)) !== currentX ||
        Math.max(-4000, Math.min(4000, currentY + deltaY)) !== currentY;
    });
    if (!canMove) return;

    const selectionKey = targets.map((element) => element.id).sort().join(',');
    const nudgeSessionKey = `${activePageId}:${selectedSection.id}:${selectionKey}:${device}`;
    if (canvasNudgeSessionRef.current !== nudgeSessionKey) {
      remember(sections, targets.length > 1 ? 'Move selected elements' : 'Move element');
      canvasNudgeSessionRef.current = nudgeSessionKey;
    }
    const moveElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          positionX: Math.max(-4000, Math.min(4000, clampElementNumber(effectiveStyle(element, device).positionX, 0, -4000, 4000) + deltaX)),
          positionY: Math.max(-4000, Math.min(4000, clampElementNumber(effectiveStyle(element, device).positionY, 0, -4000, 4000) + deltaY)),
        },
      },
    });
    const moveSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = directIds.has(element.id) || Boolean(element.symbolId && symbolIds.has(element.symbolId));
        return matches ? moveElement(element) : element;
      }),
    });

    setSections((current) => current.map(moveSection));
    if (symbolIds.size) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(moveSection),
      }));
      setSymbols((current) => current.map((symbol) => symbolIds.has(symbol.id) ? {
        ...symbol,
        element: moveElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSaved(false);
  }

  function normalizeSelectedElementFrames(action: 'match-width' | 'match-appearance' | 'reset-position' | 'show' | 'hide') {
    if (!selectedSection || !selectedElements.length || !selectedElement) return;
    if ((action === 'match-width' || action === 'match-appearance' || action === 'reset-position') && selectedElements.length < 2) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const selectedSymbolIds = new Set(selectedElements.flatMap((element) => element.symbolId ? [element.symbolId] : []));
    const referenceStyle = effectiveStyle(selectedElement, device);
    const referenceWidth = clampElementNumber(referenceStyle.width, 100, 10, 100);
    const referenceAppearance = { ...referenceStyle };
    (['width', 'maxWidth', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'positionX', 'positionY', 'order', 'hidden', 'alignSelf', 'columnSpan'] as const)
      .forEach((key) => delete referenceAppearance[key]);
    const styleChanges = action === 'match-width'
      ? { width: referenceWidth }
      : action === 'match-appearance'
        ? referenceAppearance
        : action === 'reset-position'
          ? { positionX: 0, positionY: 0, rotate: 0 }
          : { hidden: action === 'hide' };
    const updateElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          ...styleChanges,
        },
      },
    });
    const updateSection = (section: WebsiteSection, linkedOnly = false): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = element.symbolId
          ? selectedSymbolIds.has(element.symbolId)
          : !linkedOnly && selectedIds.has(element.id);
        return matches ? updateElement(element) : element;
      }),
    });

    const historyLabels = {
      'match-width': 'Match selected element widths',
      'match-appearance': 'Match selected element appearance',
      'reset-position': 'Reset selected element transforms',
      show: 'Show selected elements',
      hide: 'Hide selected elements',
    } as const;
    remember(sections, historyLabels[action]);
    setSections((current) => current.map((section) => updateSection(section)));
    if (selectedSymbolIds.size) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map((section) => updateSection(section, true)),
      }));
      setSymbols((current) => current.map((symbol) => selectedSymbolIds.has(symbol.id) ? {
        ...symbol,
        element: updateElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSaved(false);
  }

  function moveSelectedElementsLayer(destination: 'front' | 'forward' | 'backward' | 'back') {
    if (!selectedSection || !selectedElements.length) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const historyLabels = {
      front: 'Bring selected elements to front',
      forward: 'Bring selected elements forward',
      backward: 'Send selected elements backward',
      back: 'Send selected elements to back',
    } as const;
    remember(sections, historyLabels[destination]);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const ordered = section.elements
        .map((element, index) => ({ element, index, order: clampElementNumber(effectiveStyle(element, device).order, 0, -50, 50) }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ element }) => element);
      const moving = ordered.filter((element) => selectedIds.has(element.id));
      const remaining = ordered.filter((element) => !selectedIds.has(element.id));
      let next = destination === 'front' ? [...remaining, ...moving] : destination === 'back' ? [...moving, ...remaining] : [...ordered];
      if (destination === 'forward') {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (selectedIds.has(next[index].id) && !selectedIds.has(next[index + 1].id)) {
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
          }
        }
      }
      if (destination === 'backward') {
        for (let index = 1; index < next.length; index += 1) {
          if (selectedIds.has(next[index].id) && !selectedIds.has(next[index - 1].id)) {
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
          }
        }
      }
      const orderOffset = Math.floor(next.length / 2);
      next = next.map((element, index) => ({
        ...element,
        responsive: {
          ...element.responsive,
          [device]: {
            ...(element.responsive?.[device] || {}),
            order: Math.max(-50, Math.min(50, index - orderOffset)),
          },
        },
      }));
      return { ...section, elements: next };
    }));
    setSaved(false);
  }

  function ungroupSelectedElements() {
    if (!selectedSection || selectedElements.length < 2) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const affectedContainerIds = new Set(selectedElements.flatMap((element) => element.containerId ? [element.containerId] : []));
    if (!affectedContainerIds.size) return;
    remember(sections, 'Ungroup selected elements');
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const elements = section.elements.map((element) => selectedIds.has(element.id) ? { ...element, containerId: undefined } : element);
      const usedContainerIds = new Set(elements.flatMap((element) => element.containerId ? [element.containerId] : []));
      const containers = (section.containers || []).filter((container) =>
        !affectedContainerIds.has(container.id) || usedContainerIds.has(container.id));
      return { ...section, elements, containers };
    }));
    setSelectedContainerId(null);
    setSaved(false);
  }

  return { nudgeSelectedElement, normalizeSelectedElementFrames, moveSelectedElementsLayer, ungroupSelectedElements };
}
