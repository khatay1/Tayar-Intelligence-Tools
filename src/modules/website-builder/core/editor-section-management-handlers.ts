import type * as React from 'react';
import { createSection } from './defaults';
import { createSectionFromTemplate } from './website-builder-rendering';
import type { SectionType, WebsiteSection } from './types';
import type { PageTemplateDefinition, SectionTemplateDefinition } from './website-builder-rendering';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
interface SectionManagementContext {
  sections: WebsiteSection[];
  selectedId: string | null;
  activePageId: string;
  setSections: Setter<WebsiteSection[]>;
  setSaved: Setter<boolean>;
  setDraggedId: Setter<string | null>;
  setDragOverId: Setter<string | null>;
  setDragOverSectionPosition: Setter<'before' | 'after' | null>;
  draggedSectionRef: React.MutableRefObject<string | null>;
  draggedSectionPageRef: React.MutableRefObject<string | null>;
  remember: (current: WebsiteSection[], label?: string) => void;
  clearEditorDragState: () => void;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
}

export function createSectionManagementHandlers({
  sections,
  selectedId,
  activePageId,
  setSections,
  setSaved,
  setDraggedId,
  setDragOverId,
  setDragOverSectionPosition,
  draggedSectionRef,
  draggedSectionPageRef,
  remember,
  clearEditorDragState,
  selectEditorTarget,
}: SectionManagementContext) {
  function addSection(type: SectionType) {
    remember(sections);
    const section = createSection(type);
    setSections((current) => [...current, section]);
    selectEditorTarget(section.id, section.elements[0]?.id ?? null);
    setSaved(false);
  }

  function insertSectionAfter(afterSectionId: string, type: SectionType) {
    remember(sections);
    const section = createSection(type);
    setSections((current) => {
      const index = current.findIndex((item) => item.id === afterSectionId);
      if (index === -1) return [...current, section];
      const next = [...current];
      next.splice(index + 1, 0, section);
      return next;
    });
    selectEditorTarget(section.id, section.elements[0]?.id ?? null);
    setSaved(false);
  }


  function applyPageTemplate(template: PageTemplateDefinition) {
    remember(sections);
    const nextSections = template.sectionTypes.map((type, index) => {
      const section = createSection(type);
      if (index !== 0 || type !== 'hero') return section;
      return {
        ...section,
        title: template.heroTitle,
        description: template.heroText,
        buttonText: template.heroButton,
        elements: section.elements.map((element) => {
          if (element.type === 'heading') return { ...element, content: template.heroTitle };
          if (element.type === 'text') return { ...element, content: template.heroText };
          if (element.type === 'button') return { ...element, content: template.heroButton };
          return element;
        }),
      };
    });
    clearEditorDragState();
    setSections(nextSections);
    selectEditorTarget(
      nextSections[0]?.id ?? null,
      nextSections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function addSectionTemplate(template: SectionTemplateDefinition) {
    remember(sections);
    const section = createSectionFromTemplate(template);
    setSections((current) => [...current, section]);
    selectEditorTarget(section.id, section.elements[0]?.id ?? null);
    setSaved(false);
  }

  function deleteSection(id: string) {
    if (sections.length <= 1) return;

    const index = sections.findIndex((section) => section.id === id);
    if (index < 0) return;

    remember(sections);
    const next = sections.filter((section) => section.id !== id);

    setSections(next);

    if (id === selectedId) {
      const fallbackSection =
        next[Math.min(Math.max(0, index - 1), next.length - 1)] ||
        next[0] ||
        null;

      selectEditorTarget(
        fallbackSection?.id ?? null,
        fallbackSection?.elements[0]?.id ?? null,
      );
    }

    setSaved(false);
  }

  function moveSection(id: string, direction: 'up' | 'down') {
    remember(sections);
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      if (index === -1) return current;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    setSaved(false);
  }

  function handleDragStart(id: string, e: React.DragEvent) {
    remember(sections);
    draggedSectionRef.current = id;
    draggedSectionPageRef.current = activePageId;
    setDraggedId(id);
    setDragOverId(null);
    setDragOverSectionPosition(null);
    selectEditorTarget(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const sourceId = draggedSectionRef.current;
    if (
      !sourceId ||
      draggedSectionPageRef.current !== activePageId ||
      sourceId === targetId
    ) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverId(targetId);
    setDragOverSectionPosition(position);

    setSections((current) => {
      const source = current.find((section) => section.id === sourceId);
      if (!source) return current;
      const withoutSource = current.filter((section) => section.id !== sourceId);
      const targetIndex = withoutSource.findIndex((section) => section.id === targetId);
      if (targetIndex === -1) return current;
      const insertAt = targetIndex + (position === 'after' ? 1 : 0);
      const currentSourceIndex = current.findIndex((section) => section.id === sourceId);
      if (currentSourceIndex === insertAt) return current;
      const next = [...withoutSource];
      next.splice(Math.min(insertAt, next.length), 0, source);
      return next;
    });
    setSaved(false);
  }

  function handleDrop(e: React.DragEvent, _targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedSectionRef.current || e.dataTransfer.getData('text/plain');
    if (sourceId && draggedSectionPageRef.current === activePageId) {
      selectEditorTarget(sourceId);
    }
    handleDragEnd();
  }

  function handleDragEnd() {
    draggedSectionRef.current = null;
    draggedSectionPageRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSectionPosition(null);
  }
  return { addSection, insertSectionAfter, applyPageTemplate, addSectionTemplate, deleteSection, moveSection, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}
