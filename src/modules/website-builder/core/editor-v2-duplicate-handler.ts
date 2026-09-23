import type * as React from 'react';
import type { WebsiteElement,WebsiteSection } from '../core/types';

interface createV2DuplicateElementHandlerDependencies {
  remember: (current: WebsiteSection[], label?: string) => void;
  sections: WebsiteSection[];
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
}

export function createV2DuplicateElementHandler({
  remember,
  sections,
  selectEditorTarget,
  setSaved,
  setSections,
}: createV2DuplicateElementHandlerDependencies) {
  return function v2DuplicateElementDirect(
    sectionId: string,
    elementId: string,
  ) {
    const targetSection =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    const source =
      targetSection?.elements.find(
        (element) =>
          element.id === elementId,
      );

    if (
      !targetSection ||
      !source
    ) {
      return;
    }

    const duplicate: WebsiteElement = {
      ...source,

      id:
        `${source.type}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      style: {
        ...source.style,
      },

      responsive:
        source.responsive
          ? JSON.parse(
              JSON.stringify(
                source.responsive,
              ),
            )
          : undefined,

      symbolId:
        undefined,
    };

    remember(sections);

    setSections((current) =>
      current.map((section) => {
        if (
          section.id !== sectionId
        ) {
          return section;
        }

        const index = section.elements.findIndex(
          (element) => element.id === elementId,
        );
        if (index < 0) return section;

        const elements = [...section.elements];
        elements.splice(index + 1, 0, duplicate);

        return {
          ...section,
          elements,
        };
      }),
    );

    selectEditorTarget(
      sectionId,
      duplicate.id,
    );

    setSaved(false);
  };
}
