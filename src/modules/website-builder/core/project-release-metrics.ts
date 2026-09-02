export interface ProjectSnapshotCounts {
  pageCount: number;
  sectionCount: number;
  elementCount: number;
}

export function countProjectSnapshot(
  snapshot: Record<string, unknown>,
): ProjectSnapshotCounts {
  const snapshotPages = Array.isArray(snapshot.pages) ? snapshot.pages : [];
  const pageCount = snapshotPages.length;

  const sectionCount = snapshotPages.reduce((sum: number, page: unknown) => {
    if (!page || typeof page !== 'object') return sum;
    const pageSections = (page as { sections?: unknown }).sections;
    return sum + (Array.isArray(pageSections) ? pageSections.length : 0);
  }, 0);

  const elementCount = snapshotPages.reduce((sum: number, page: unknown) => {
    if (!page || typeof page !== 'object') return sum;
    const pageSections = (page as { sections?: unknown }).sections;
    if (!Array.isArray(pageSections)) return sum;

    return sum + pageSections.reduce((sectionSum: number, section: unknown) => {
      if (!section || typeof section !== 'object') return sectionSum;
      const elements = (section as { elements?: unknown }).elements;
      return sectionSum + (Array.isArray(elements) ? elements.length : 0);
    }, 0);
  }, 0);

  return { pageCount, sectionCount, elementCount };
}

export function buildProjectSnapshotDiffSummary(
  currentSnapshot: Record<string, unknown>,
  previousSnapshot: Record<string, unknown>,
): string {
  const current = countProjectSnapshot(currentSnapshot);
  const previous = countProjectSnapshot(previousSnapshot);
  const delta = (value: number) =>
    value === 0 ? '0' : value > 0 ? `+${value}` : String(value);

  return [
    `${delta(current.pageCount - previous.pageCount)} pages`,
    `${delta(current.sectionCount - previous.sectionCount)} sections`,
    `${delta(current.elementCount - previous.elementCount)} elements`,
  ].join(' · ');
}
