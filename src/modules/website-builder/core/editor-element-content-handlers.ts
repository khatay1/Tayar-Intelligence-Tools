import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createElement } from './defaults';
import type { Device, WebsiteElement, WebsiteElementType, WebsiteSection } from './types';
import type { WebsitePage, WebsiteSymbol } from './website-builder-model';
import { cloneSymbolElement, effectiveStyle, elementColumn, sectionColumnCount } from './website-builder-rendering';

interface ElementContentContext {
  sections: WebsiteSection[];
  selectedSection: WebsiteSection | null;
  selectedElement: WebsiteElement | null;
  selectedElementId: string | null;
  updateSelectedElement: (changes: Partial<WebsiteElement>, responsive?: boolean) => void;
  activePageId: string;
  device: Device;
  canvasResizeSessionRef: MutableRefObject<string | null>;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setPages: Dispatch<SetStateAction<WebsitePage[]>>;
  setSymbols: Dispatch<SetStateAction<WebsiteSymbol[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  remember: (sections: WebsiteSection[], label?: string) => void;
}

export function createElementContentHandlers({
  sections, selectedSection, selectedElement, selectedElementId, activePageId, device, updateSelectedElement, canvasResizeSessionRef,
  setSections, setPages, setSymbols, setSelectedId, setSelectedElementId,
  setSaved, selectEditorTarget, remember,
}: ElementContentContext) {
  function addElementToSection(sectionId: string, type: WebsiteElementType) {
    const targetSection = sections.find((section) => section.id === sectionId);
    if (!targetSection) return;
    remember(sections);
    const columnCount = sectionColumnCount(targetSection.layout);
    const counts = Array.from({ length: columnCount }, (_, columnIndex) =>
      targetSection.elements.reduce((count, existingElement, index) =>
        count + (elementColumn(existingElement, index, columnCount) === columnIndex + 1 ? 1 : 0), 0)
    );
    const targetColumn = columnCount > 1 ? counts.indexOf(Math.min(...counts)) + 1 : undefined;
    const element = { ...createElement(type, targetSection.accent), layoutColumn: targetColumn };
    setSections((current) => current.map((section) =>
      section.id === sectionId ? { ...section, elements: [...section.elements, element] } : section
    ));
    selectEditorTarget(sectionId, element.id);
    setSaved(false);
  }

  function addElement(type: WebsiteElementType) {
    if (!selectedSection) return;
    addElementToSection(selectedSection.id, type);
  }

  function updateInlineElementContent(sectionId: string, elementId: string, content: string) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement || !content.trim() || targetElement.content === content) return;
    remember(sections);
    const symbolId = targetElement.symbolId;
    const updateSection = (section: WebsiteSection) => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? { ...element, content } : element;
      }),
    });
    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? updateSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : { ...page, sections: page.sections.map(updateSection) }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId
        ? { ...symbol, element: { ...symbol.element, content }, updatedAt: new Date().toISOString() }
        : symbol
      ));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function updateInlineElementSource(sectionId: string, elementId: string, src: string) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    const nextSource = src.trim();
    if (!targetSection || !targetElement || !nextSource || targetElement.src === nextSource) return;
    remember(sections);
    const symbolId = targetElement.symbolId;
    const updateSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? { ...element, src: nextSource } : element;
      }),
    });
    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? updateSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : { ...page, sections: page.sections.map(updateSection) }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId
        ? { ...symbol, element: { ...symbol.element, src: nextSource }, updatedAt: new Date().toISOString() }
        : symbol
      ));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function beginElementResize(sectionId: string, elementId: string) {
    selectEditorTarget(sectionId, elementId);
    const resizeSessionKey = `${activePageId}:${sectionId}:${elementId}:${device}`;
    if (canvasResizeSessionRef.current === resizeSessionKey) return;
    remember(sections, 'Resize element');
    canvasResizeSessionRef.current = resizeSessionKey;
  }

  function endElementResize() {
    canvasResizeSessionRef.current = null;
  }

  function resizeElementFrame(
    sectionId: string,
    elementId: string,
    frame: { width: number; positionX?: number },
  ) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement) return;
    const symbolId = targetElement.symbolId;
    const safeWidth = Math.max(10, Math.min(100, Math.round(frame.width)));
    const safePositionX = frame.positionX === undefined
      ? undefined
      : Math.max(-4000, Math.min(4000, Math.round(frame.positionX)));

    const resizeElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          width: safeWidth,
          ...(safePositionX === undefined ? {} : { positionX: safePositionX }),
        },
      },
    });

    const resizeSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? resizeElement(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? resizeSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(resizeSection),
      }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId ? {
        ...symbol,
        element: resizeElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function quickUpdateElement(sectionId: string, elementId: string, changes: Partial<WebsiteElement>) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement) return;
    remember(sections);
    const symbolId = targetElement.symbolId;

    const applyChanges = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      ...changes,
      id: element.id,
      containerId: element.containerId,
      layoutColumn: element.layoutColumn,
      symbolId: element.symbolId,
    });

    const updateSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? applyChanges(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? updateSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(updateSection),
      }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId ? {
        ...symbol,
        element: applyChanges(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function resetSelectedElementResponsive() {
    if (!selectedSection || !selectedElementId || !selectedElement) return;

    remember(sections);
    const selectedSymbolId = selectedElement.symbolId;

    const resetElement = (element: WebsiteElement): WebsiteElement => {
      const responsive = { ...(element.responsive || {}) };
      delete responsive[device];
      return { ...element, responsive };
    };

    const resetSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = selectedSymbolId
          ? element.symbolId === selectedSymbolId
          : element.id === selectedElementId;
        return matches ? resetElement(element) : element;
      }),
    });

    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id || selectedSymbolId
          ? resetSection(section)
          : section
      )
    );

    if (selectedSymbolId) {
      setPages((current) => current.map((page) =>
        page.id === activePageId
          ? page
          : {
              ...page,
              sections: page.sections.map(resetSection),
            }
      ));

      setSymbols((current) => current.map((symbol) =>
        symbol.id === selectedSymbolId
          ? {
              ...symbol,
              element: cloneSymbolElement(resetElement(symbol.element)),
              updatedAt: new Date().toISOString(),
            }
          : symbol
      ));
    }

    setSaved(false);
  }

  function copySelectedElementResponsiveFrom(sourceDevice: Device) {
    if (!selectedElement || sourceDevice === device) return;
    updateSelectedElement({
      style: {
        ...effectiveStyle(selectedElement, sourceDevice),
      },
    }, true);
  }

  function moveSelectedElement(direction: 'up' | 'down') {
    if (!selectedSection || !selectedElementId) return;
    if (!selectedSection.elements.some((element) => element.id === selectedElementId)) return;

    remember(sections);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;

      const index = section.elements.findIndex((element) => element.id === selectedElementId);
      if (index < 0) return section;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= section.elements.length) return section;

      const elements = [...section.elements];
      [elements[index], elements[target]] = [elements[target], elements[index]];
      return { ...section, elements };
    }));
    setSaved(false);
  }

  return { addElementToSection, addElement, updateInlineElementContent, updateInlineElementSource, beginElementResize, endElementResize, resizeElementFrame, quickUpdateElement, resetSelectedElementResponsive, copySelectedElementResponsiveFrom, moveSelectedElement };
}
