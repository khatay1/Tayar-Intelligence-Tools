import { DEFAULT_SECTIONS, SectionConfig, SectionType } from '@/lib/cv-types';

export function createDefaultSections(): SectionConfig[] {
  return DEFAULT_SECTIONS.map(section => ({ ...section }));
}

export function toggleCVSection(sections: SectionConfig[], id: SectionType): SectionConfig[] {
  let changed = false;
  const next = sections.map(section => {
    if (section.id !== id) return section;
    changed = true;
    return { ...section, visible: !section.visible };
  });
  return changed ? next : sections;
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
  const defaults = new Map(DEFAULT_SECTIONS.map(section => [section.id, section]));
  const seen = new Set<SectionType>();
  const normalized: SectionConfig[] = [];

  // Keep the user's persisted order, while dropping duplicate/unknown entries.
  for (const section of sections ?? []) {
    const base = defaults.get(section.id);
    if (!base || seen.has(section.id)) continue;
    seen.add(section.id);
    normalized.push({ ...base, ...section, id: base.id });
  }

  // Append any sections introduced by newer versions of the builder.
  for (const section of DEFAULT_SECTIONS) {
    if (!seen.has(section.id)) normalized.push({ ...section });
  }
  return normalized;
}
