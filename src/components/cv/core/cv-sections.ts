import { DEFAULT_SECTIONS, SectionConfig, SectionType } from '@/lib/cv-types';

export function createDefaultSections(): SectionConfig[] {
  return DEFAULT_SECTIONS.map(section => ({ ...section }));
}

export function toggleCVSection(sections: SectionConfig[], id: SectionType): SectionConfig[] {
  return sections.map(section => section.id === id ? { ...section, visible: !section.visible } : section);
}

export function moveCVSection(sections: SectionConfig[], fromIndex: number, toIndex: number): SectionConfig[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= sections.length || toIndex >= sections.length) {
    return sections;
  }
  const next = sections.map(section => ({ ...section }));
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function normalizeCVSections(sections?: SectionConfig[] | null): SectionConfig[] {
  const incoming = new Map((sections ?? []).map(section => [section.id, section]));
  const normalized = DEFAULT_SECTIONS.map(defaultSection => ({
    ...defaultSection,
    ...incoming.get(defaultSection.id),
  }));
  const known = new Set(normalized.map(section => section.id));
  for (const section of sections ?? []) {
    if (!known.has(section.id)) normalized.push({ ...section });
  }
  return normalized;
}
