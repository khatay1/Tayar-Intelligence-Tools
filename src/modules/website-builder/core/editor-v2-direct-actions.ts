import type { Dispatch, SetStateAction } from 'react';
import { cloneSectionWithFreshIds } from './website-builder-rendering';
import type { WebsiteSection } from './types';

interface V2DirectActionsContext {
  sections: WebsiteSection[];
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  remember: (sections: WebsiteSection[], label?: string) => void;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
}

export function createV2DirectActions({ sections, setSections, setSaved, remember, selectEditorTarget }: V2DirectActionsContext) {
  function v2DuplicateSectionDirect(
    sectionId: string,
  ) {
    const source =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    if (!source) return;

    const duplicate =
      cloneSectionWithFreshIds(
        source,
        sections,
      );

    remember(sections);

    setSections((current) => {
      const index = current.findIndex(
        (section) => section.id === sectionId,
      );
      if (index < 0) return current;

      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });

    selectEditorTarget(
      duplicate.id,
      duplicate.elements[0]?.id ?? null,
    );

    setSaved(false);
  }

  function v2MoveElementDirect(
    sectionId: string,
    elementId: string,
    direction: 'up' | 'down',
  ) {
    const targetSection =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    if (!targetSection) return;

    remember(sections);

    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;

        const index = section.elements.findIndex(
          (element) => element.id === elementId,
        );
        if (index < 0) return section;

        const targetIndex =
          direction === 'up'
            ? index - 1
            : index + 1;
        if (
          targetIndex < 0 ||
          targetIndex >= section.elements.length
        ) {
          return section;
        }

        const elements = [...section.elements];
        [elements[index], elements[targetIndex]] = [
          elements[targetIndex],
          elements[index],
        ];

        return {
          ...section,
          elements,
        };
      }),
    );

    selectEditorTarget(sectionId, elementId);
    setSaved(false);
  }

  return { v2DuplicateSectionDirect, v2MoveElementDirect };
}
