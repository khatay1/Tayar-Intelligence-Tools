/** Restore editable text only; saved JSON must not replace the editor's schema. */
export function restoreAdminContentDraft<T extends Record<string, { sections: { id: string; value: string }[] }>>(defaults: T, saved: unknown): T {
  const result = structuredClone(defaults);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
  const record = saved as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const candidate = record[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const sections = (candidate as { sections?: unknown }).sections;
    if (!Array.isArray(sections)) continue;
    for (const section of result[key].sections) {
      const restored = sections.find(value => value && typeof value === 'object' && value.id === section.id);
      if (restored && typeof restored.value === 'string') section.value = restored.value;
    }
  }
  return result;
}
