import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Device, WebsiteElement, WebsiteSection } from './types';
import type { WebsiteClipboard, WebsiteClipboardContext, WebsiteSymbol } from './website-builder-model';
import { clampElementNumber, cloneSectionWithFreshIds } from './website-builder-rendering';

interface EditorClipboardContext {
  device: Device;
  symbols: WebsiteSymbol[];
  sections: WebsiteSection[];
  selectedSection: WebsiteSection | null;
  selectedElement: WebsiteElement | null;
  selectedElements: WebsiteElement[];
  selectedElementId: string | null;
  cloudProjectId: string | null;
  activeProjectOwnerId: string | null;
  projectLoadSequenceRef: MutableRefObject<number>;
  editorClipboard: WebsiteClipboard | null;
  setEditorClipboard: Dispatch<SetStateAction<WebsiteClipboard | null>>;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedContainerId: Dispatch<SetStateAction<string | null>>;
  setSelectedFormFieldId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  remember: (sections: WebsiteSection[], label?: string) => void;
}

export function createEditorClipboardHandlers({
  device, symbols, sections, selectedSection, selectedElement, selectedElements, selectedElementId,
  cloudProjectId, activeProjectOwnerId, projectLoadSequenceRef, editorClipboard, setEditorClipboard,
  setSections, setSelectedId, setSelectedElementIds, setSelectedElementId,
  setSelectedContainerId, setSelectedFormFieldId, setSaved, selectEditorTarget, remember,
}: EditorClipboardContext) {
  function cloneElementForInsertion(source: WebsiteElement, targetSection: WebsiteSection): WebsiteElement {
    const copied = JSON.parse(JSON.stringify(source)) as WebsiteElement;
    const targetHasContainer = Boolean(
      copied.containerId && targetSection.containers?.some((container) => container.id === copied.containerId),
    );
    const targetHasSymbol = Boolean(copied.symbolId && symbols.some((symbol) => symbol.id === copied.symbolId));
    const offsetPosition = (style: WebsiteElement['style']): WebsiteElement['style'] => ({
      ...style,
      ...(typeof style.positionX === 'number' ? { positionX: clampElementNumber(style.positionX + 16, 0, -4000, 4000) } : {}),
      ...(typeof style.positionY === 'number' ? { positionY: clampElementNumber(style.positionY + 16, 0, -4000, 4000) } : {}),
    });
    const responsive = copied.responsive
      ? JSON.parse(JSON.stringify(copied.responsive)) as NonNullable<WebsiteElement['responsive']>
      : undefined;
    if (responsive?.[device]) responsive[device] = offsetPosition(responsive[device] || {});

    return {
      ...copied,
      id: `${copied.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      style: offsetPosition(copied.style),
      responsive,
      containerId: targetHasContainer ? copied.containerId : undefined,
      symbolId: targetHasSymbol ? copied.symbolId : undefined,
    };
  }

  function clipboardContext(): WebsiteClipboardContext {
    return {
      projectId: cloudProjectId,
      ownerId: activeProjectOwnerId,
      loadSequence: projectLoadSequenceRef.current,
    };
  }

  function copySelectedTarget() {
    if (selectedElements.length > 1) {
      setEditorClipboard({
        ...clipboardContext(),
        kind: 'elements',
        elements: JSON.parse(JSON.stringify(selectedElements)) as WebsiteElement[],
      });
      return;
    }
    if (selectedElement) {
      setEditorClipboard({
        ...clipboardContext(),
        kind: 'element',
        element: JSON.parse(JSON.stringify(selectedElement)) as WebsiteElement,
      });
      return;
    }
    if (!selectedSection) return;
    setEditorClipboard({
      ...clipboardContext(),
      kind: 'section',
      section: JSON.parse(JSON.stringify(selectedSection)) as WebsiteSection,
    });
  }

  function canPasteCopiedTarget() {
    if (!editorClipboard || !selectedSection) return false;
    return editorClipboard.projectId === cloudProjectId &&
      editorClipboard.ownerId === activeProjectOwnerId &&
      editorClipboard.loadSequence === projectLoadSequenceRef.current;
  }

  function cutSelectedTarget() {
    if (!selectedSection) return;
    if (!selectedElement && sections.length <= 1) return;
    if (selectedElements.length && selectedElements.length >= selectedSection.elements.length) return;
    copySelectedTarget();

    if (selectedElements.length) {
      const selectedIds = new Set(selectedElements.map((element) => element.id));
      const remaining = selectedSection.elements.filter((element) => !selectedIds.has(element.id));
      remember(sections, selectedElements.length > 1 ? 'Cut selected elements' : 'Cut element');
      setSections((current) => current.map((section) =>
        section.id === selectedSection.id ? { ...section, elements: remaining } : section
      ));
      selectEditorTarget(selectedSection.id, remaining[0]?.id ?? null);
      setSaved(false);
      return;
    }

    const sectionIndex = sections.findIndex((section) => section.id === selectedSection.id);
    if (sectionIndex < 0) return;
    const remaining = sections.filter((section) => section.id !== selectedSection.id);
    const fallback = remaining[Math.min(sectionIndex, remaining.length - 1)] || remaining[0];
    remember(sections, 'Cut section');
    setSections(remaining);
    selectEditorTarget(fallback?.id ?? null, null);
    setSaved(false);
  }

  function pasteCopiedTarget() {
    if (!canPasteCopiedTarget() || !editorClipboard || !selectedSection) return;

    if (editorClipboard.kind === 'section') {
      const pastedSection = cloneSectionWithFreshIds(editorClipboard.section, sections);
      const selectedIndex = sections.findIndex((section) => section.id === selectedSection.id);
      remember(sections, 'Paste section');
      setSections((current) => {
        const next = [...current];
        next.splice(selectedIndex >= 0 ? selectedIndex + 1 : next.length, 0, pastedSection);
        return next;
      });
      selectEditorTarget(pastedSection.id, pastedSection.elements[0]?.id ?? null);
      setSaved(false);
      return;
    }

    const sourceElements = editorClipboard.kind === 'elements'
      ? editorClipboard.elements
      : [editorClipboard.element];
    const pasted = sourceElements.map((element) => cloneElementForInsertion(element, selectedSection));
    remember(sections, pasted.length > 1 ? 'Paste selected elements' : 'Paste element');
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const elements = [...section.elements];
      const selectedIndex = selectedElementId
        ? elements.findIndex((element) => element.id === selectedElementId)
        : -1;
      elements.splice(selectedIndex >= 0 ? selectedIndex + 1 : elements.length, 0, ...pasted);
      return { ...section, elements };
    }));
    setSelectedId(selectedSection.id);
    setSelectedElementIds(pasted.map((element) => element.id));
    setSelectedElementId(pasted[pasted.length - 1]?.id ?? null);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
    setSaved(false);
  }

  return { cloneElementForInsertion, copySelectedTarget, canPasteCopiedTarget, cutSelectedTarget, pasteCopiedTarget };
}
