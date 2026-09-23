import type * as React from 'react';
import type { WebsiteSection } from '../core/types';

interface createV2DeleteElementHandlerDependencies {
  remember: (current: WebsiteSection[], label?: string) => void;
  sections: WebsiteSection[];
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
}

export function createV2DeleteElementHandler({
  remember,
  sections,
  selectEditorTarget,
  setSaved,
  setSections,
}: createV2DeleteElementHandlerDependencies) {
  return function v2DeleteElementDirect(
    sectionId: string,
    elementId: string,
  ) {
    const targetSection =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    if (
      !targetSection ||
      targetSection.elements.length <= 1
    ) {
      return;
    }

    const index =
      targetSection.elements.findIndex(
        (element) =>
          element.id === elementId,
      );

    if (index < 0) return;

    const remaining =
      targetSection.elements.filter(
        (element) =>
          element.id !== elementId,
      );

    const nextElement =
      remaining[
        Math.min(
          index,
          remaining.length - 1,
        )
      ];

    remember(sections);

    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;
        if (section.elements.length <= 1) return section;

        const elements = section.elements.filter(
          (element) => element.id !== elementId,
        );
        return elements.length === section.elements.length
          ? section
          : { ...section, elements };
      }),
    );

    selectEditorTarget(
      sectionId,
      nextElement?.id ?? null,
    );

    setSaved(false);
  };
}
