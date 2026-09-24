import type { Dispatch, SetStateAction } from 'react';
import { effectiveSectionStyle, sectionColumnCount, sectionLayoutAlign, sectionLayoutGap } from './website-builder-rendering';
import type { Device, SectionLayout, SectionResponsiveStyle, WebsiteSection } from './types';

interface SectionEditingContext {
  selectedId: string | null;
  selectedSection: WebsiteSection | null;
  device: Device;
  sections: WebsiteSection[];
  remember: (sections: WebsiteSection[], label?: string) => void;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
}

export function createSectionEditingHandlers({ selectedId, selectedSection, device, sections, remember, setSections, setSaved }: SectionEditingContext) {
  function updateSelected(
    changes: Partial<Omit<WebsiteSection, 'id' | 'type'>>
  ) {
    if (!selectedId) return;

    remember(sections);
    setSections((current) =>
      current.map((section) => {
        if (section.id !== selectedId) return section;
        const next = { ...section, ...changes };
        const elements = section.elements.map((element) => {
          if (changes.title !== undefined && element.type === 'heading') return { ...element, content: changes.title };
          if (changes.description !== undefined && element.type === 'text') return { ...element, content: changes.description };
          if (element.type === 'button') {
            return {
              ...element,
              content: changes.buttonText !== undefined ? changes.buttonText : element.content,
              href: changes.buttonUrl !== undefined ? changes.buttonUrl : element.href,
              style: changes.accent !== undefined ? { ...element.style, backgroundColor: changes.accent } : element.style,
            };
          }
          return element;
        });
        return { ...next, elements };
      })
    );
    setSaved(false);
  }

  function updateSelectedSectionResponsive(changes: SectionResponsiveStyle) {
    if (!selectedId) return;
    if (device === 'desktop') {
      updateSelected(changes);
      return;
    }
    remember(sections, `Edit ${device} section layout`);
    setSections((current) => current.map((section) => section.id === selectedId ? {
      ...section,
      responsive: {
        ...section.responsive,
        [device]: {
          ...(section.responsive?.[device] || {}),
          ...changes,
        },
      },
    } : section));
    setSaved(false);
  }

  function resetSelectedSectionResponsive() {
    if (!selectedId || device === 'desktop') return;
    remember(sections, `Reset ${device} section layout`);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedId) return section;
      const responsive = { ...(section.responsive || {}) };
      delete responsive[device];
      return { ...section, responsive };
    }));
    setSaved(false);
  }

  function copySelectedSectionResponsiveFrom(sourceDevice: Device) {
    if (!selectedSection || sourceDevice === device) return;
    const source = effectiveSectionStyle(selectedSection, sourceDevice);
    updateSelectedSectionResponsive({
      minHeight: source.minHeight,
      sectionPaddingY: source.sectionPaddingY,
      sectionPaddingX: source.sectionPaddingX,
      layoutGap: source.layoutGap,
    });
  }

  function setSelectedSectionLayout(layout: SectionLayout) {
    if (!selectedSection) return;
    const previousColumns = sectionColumnCount(selectedSection.layout);
    const nextColumns = sectionColumnCount(layout);
    remember(sections);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      return {
        ...section,
        layout,
        layoutGap: sectionLayoutGap(section),
        layoutAlign: sectionLayoutAlign(section),
        elements: section.elements.map((element, index) => ({
          ...element,
          layoutColumn: nextColumns === 1
            ? undefined
            : previousColumns === 1
              ? ((index % nextColumns) + 1)
              : Math.min(nextColumns, Math.max(1, Number(element.layoutColumn) || ((index % nextColumns) + 1))),
        })),
      };
    }));
    setSaved(false);
  }

  return { updateSelected, updateSelectedSectionResponsive, resetSelectedSectionResponsive, copySelectedSectionResponsiveFrom, setSelectedSectionLayout };
}
