import type { Dispatch, SetStateAction } from 'react';
import { ELEMENT_LABELS } from './defaults';
import { cloneSymbolElement, sectionColumnCount } from './website-builder-rendering';
import type { WebsiteElement, WebsiteElementContainer, WebsiteSection } from './types';
import type { WebsitePage, WebsiteSymbol } from './website-builder-model';

interface ReusableElementContext {
  sections: WebsiteSection[];
  selectedSection: WebsiteSection | null;
  selectedElement: WebsiteElement | null;
  selectedElements: WebsiteElement[];
  selectedElementId: string | null;
  selectedContainerId: string | null;
  selectedId: string | null;
  activePageId: string;
  symbols: WebsiteSymbol[];
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setPages: Dispatch<SetStateAction<WebsitePage[]>>;
  setSymbols: Dispatch<SetStateAction<WebsiteSymbol[]>>;
  setSelectedContainerId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  remember: (current: WebsiteSection[], label?: string) => void;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  getCurrentPages: () => WebsitePage[];
  switchPage: (pageId: string) => void;
  l: (text: string) => string;
}

export function createReusableElementHandlers({
  sections,
  selectedSection,
  selectedElement,
  selectedElements,
  selectedElementId,
  selectedContainerId,
  selectedId,
  activePageId,
  symbols,
  setSections,
  setPages,
  setSymbols,
  setSelectedContainerId,
  setSaved,
  remember,
  selectEditorTarget,
  getCurrentPages,
  switchPage,
  l,
}: ReusableElementContext) {
  function createContainerForSelected() {
    if (!selectedSection || !selectedElement) return;
    const targets = selectedElements.length > 1 ? selectedElements : [selectedElement];
    const targetIds = new Set(targets.map((element) => element.id));
    remember(sections, targets.length > 1 ? 'Group selected elements' : 'Create element container');
    const id = `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = `Container ${(selectedSection.containers?.length || 0) + 1}`;
    const container: WebsiteElementContainer = {
      id,
      name,
      layout: 'stack',
      gap: 16,
      align: 'center',
      backgroundColor: '#ffffff08',
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#ffffff18',
      shadow: 'none',
      layoutColumn: selectedElement.layoutColumn,
      columnSpan: 1,
    };
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      containers: [...(section.containers || []), container],
      elements: section.elements.map((element) => targetIds.has(element.id) ? { ...element, containerId: id } : element),
    } : section));
    setSelectedContainerId(id);
    setSaved(false);
  }

  function updateSelectedContainer(changes: Partial<WebsiteElementContainer>) {
    if (!selectedSection || !selectedElement?.containerId) return;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      containers: (section.containers || []).map((container) => container.id === selectedElement.containerId ? { ...container, ...changes } : container),
    } : section));
    setSaved(false);
  }

  function assignSelectedToContainer(containerId?: string) {
    if (!selectedSection || !selectedElement) return;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, containerId: containerId || undefined } : element),
    } : section));
    setSaved(false);
  }

  function deleteSelectedContainer() {
    if (!selectedSection || !selectedElement?.containerId) return;
    const containerId = selectedElement.containerId;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      containers: (section.containers || []).filter((container) => container.id !== containerId),
      elements: section.elements.map((element) => element.containerId === containerId ? { ...element, containerId: undefined } : element),
    } : section));
    setSaved(false);
  }

  function createSymbolFromSelected() {
    if (!selectedElement || !selectedSection || selectedElement.symbolId) return;

    if (symbols.length >= 50) {
      window.alert(l('You can keep up to 50 reusable components in one website. Delete an unused component before creating another.'));
      return;
    }

    remember(sections, 'Create reusable component');
    const baseName = (selectedElement.content?.slice(0, 40) || ELEMENT_LABELS[selectedElement.type] || 'Component').trim();
    const matching = symbols.filter((symbol) => symbol.name === baseName || symbol.name.startsWith(`${baseName} `)).length;
    const name = matching ? `${baseName} ${matching + 1}` : baseName;
    const symbolId = `symbol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const symbol: WebsiteSymbol = {
      id: symbolId,
      name: name.slice(0, 80),
      element: cloneSymbolElement(selectedElement),
      updatedAt: new Date().toISOString(),
    };
    setSymbols((current) => [symbol, ...current]);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, symbolId } : element),
    } : section));
    setSaved(false);
  }

  function insertSymbol(symbol: WebsiteSymbol) {
    if (!selectedSection) return;
    remember(sections, `Insert component: ${symbol.name}`);

    const columnCount = sectionColumnCount(selectedSection.layout);
    const targetContainerId =
      selectedElement?.containerId ||
      selectedContainerId ||
      undefined;

    const instance: WebsiteElement = {
      ...JSON.parse(JSON.stringify(symbol.element)) as WebsiteElement,
      id: `${symbol.element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbolId: symbol.id,
      layoutColumn: targetContainerId
        ? undefined
        : columnCount > 1
          ? selectedElement?.layoutColumn || 1
          : undefined,
      containerId: targetContainerId,
    };

    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;

      const elements = [...section.elements];
      const selectedIndex = selectedElementId
        ? elements.findIndex((element) => element.id === selectedElementId)
        : -1;
      const insertAt = selectedIndex >= 0
        ? selectedIndex + 1
        : elements.length;

      elements.splice(insertAt, 0, instance);
      return { ...section, elements };
    }));

    selectEditorTarget(selectedSection.id, instance.id);
    setSaved(false);
  }

  function detachSelectedSymbol() {
    if (!selectedSection || !selectedElement?.symbolId) return;
    remember(sections, 'Detach component');
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, symbolId: undefined } : element),
    } : section));
    setSaved(false);
  }

  function deleteSymbol(symbolId: string) {
    if (!window.confirm(l('Delete this component? Existing instances will become normal elements.'))) return;
    remember(sections, 'Delete reusable component');
    setSymbols((current) => current.filter((symbol) => symbol.id !== symbolId));
    const detach = (section: WebsiteSection) => ({
      ...section,
      elements: section.elements.map((element) => element.symbolId === symbolId ? { ...element, symbolId: undefined } : element),
    });
    setSections((current) => current.map(detach));
    setPages((current) => current.map((page) =>
      page.id === activePageId
        ? page
        : { ...page, sections: page.sections.map(detach) }
    ));
    setSaved(false);
  }

  function renameSymbol(symbolId: string, requestedName: string) {
    const name = requestedName.trim().slice(0, 80);
    if (!name) return;
    const existing = symbols.find((symbol) => symbol.id === symbolId);
    if (!existing || existing.name === name) return;
    if (symbols.some((symbol) => symbol.id !== symbolId && symbol.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      window.alert(l('A component with this name already exists.'));
      return;
    }
    remember(sections, 'Rename reusable component');
    setSymbols((current) => current.map((symbol) => symbol.id === symbolId
      ? { ...symbol, name, updatedAt: new Date().toISOString() }
      : symbol));
    setSaved(false);
  }

  function duplicateSymbol(symbolId: string) {
    if (symbols.length >= 50) {
      window.alert(l('You can keep up to 50 reusable components in one website. Delete an unused component before creating another.'));
      return;
    }
    const source = symbols.find((symbol) => symbol.id === symbolId);
    if (!source) return;
    const baseName = `${source.name} Copy`.slice(0, 72);
    let name = baseName;
    let suffix = 2;
    const usedNames = new Set(symbols.map((symbol) => symbol.name.trim().toLocaleLowerCase()));
    while (usedNames.has(name.toLocaleLowerCase())) {
      name = `${baseName} ${suffix}`.slice(0, 80);
      suffix += 1;
    }
    remember(sections, 'Duplicate reusable component');
    setSymbols((current) => [{
      ...JSON.parse(JSON.stringify(source)) as WebsiteSymbol,
      id: `symbol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      element: cloneSymbolElement(source.element),
      updatedAt: new Date().toISOString(),
    }, ...current]);
    setSaved(false);
  }

  function selectNextSymbolInstance(symbolId: string) {
    const currentPages = getCurrentPages();
    const instances = currentPages.flatMap((page) => page.sections.flatMap((section) =>
      section.elements
        .filter((element) => element.symbolId === symbolId)
        .map((element) => ({ pageId: page.id, sectionId: section.id, elementId: element.id }))));
    if (!instances.length) return;
    const currentIndex = instances.findIndex((instance) =>
      instance.pageId === activePageId &&
      instance.sectionId === selectedId &&
      instance.elementId === selectedElementId);
    const target = instances[(currentIndex + 1) % instances.length];
    if (target.pageId !== activePageId) {
      switchPage(target.pageId);
      window.requestAnimationFrame(() => selectEditorTarget(target.sectionId, target.elementId));
      return;
    }
    selectEditorTarget(target.sectionId, target.elementId);
  }

  return { createContainerForSelected, updateSelectedContainer, assignSelectedToContainer, deleteSelectedContainer, createSymbolFromSelected, insertSymbol, detachSelectedSymbol, deleteSymbol, renameSymbol, duplicateSymbol, selectNextSymbolInstance };
}
