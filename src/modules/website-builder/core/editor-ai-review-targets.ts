import type { WebsiteSection } from './types';
import { normalizeSlug } from './project-identifiers';
import type { AIWebsitePatchReview, AIWebsitePatchReviewItem } from './editor-ai-patch-review';

export interface AIWebsiteReviewPage {
  id: string;
  slug: string;
  sections: WebsiteSection[];
}

export function aiWebsitePatchReviewItemIsGlobal(operation: AIWebsitePatchReviewItem): boolean {
  return !operation.pageId && !operation.pageSlug && !operation.sectionId && !operation.elementId && !operation.containerId;
}

export function aiWebsitePatchReviewItemTargetsPage(
  operation: AIWebsitePatchReviewItem,
  page: AIWebsiteReviewPage,
): boolean {
  if (operation.pageId) return operation.pageId === page.id;
  if (operation.pageSlug) return normalizeSlug(operation.pageSlug) === normalizeSlug(page.slug);
  if (operation.sectionId && page.sections.some((section) => section.id === operation.sectionId)) return true;
  if (operation.elementId && page.sections.some((section) => section.elements.some((element) => element.id === operation.elementId))) return true;
  if (operation.containerId && page.sections.some((section) => (section.containers || []).some((container) => container.id === operation.containerId))) return true;
  return false;
}

export function aiWebsitePatchReviewItemTargetPage<T extends AIWebsiteReviewPage>(
  operation: AIWebsitePatchReviewItem,
  pages: T[],
): T | undefined {
  if (operation.pageId) {
    const page = pages.find((candidate) => candidate.id === operation.pageId);
    if (page) return page;
  }
  if (operation.pageSlug) {
    const slug = normalizeSlug(operation.pageSlug);
    const page = pages.find((candidate) => normalizeSlug(candidate.slug) === slug);
    if (page) return page;
  }
  return pages.find((page) => aiWebsitePatchReviewItemTargetsPage(operation, page));
}

export function reconcileAIWebsitePatchReviewTargets(
  review: AIWebsitePatchReview,
  baselinePages: AIWebsiteReviewPage[],
  candidatePages: AIWebsiteReviewPage[],
): AIWebsitePatchReview {
  const baselinePageIds = new Set(baselinePages.map((page) => page.id));
  const baselineSectionIds = new Set(baselinePages.flatMap((page) => page.sections.map((section) => section.id)));
  const baselineElementIds = new Set(baselinePages.flatMap((page) => page.sections.flatMap((section) => section.elements.map((element) => element.id))));
  const baselineContainerIds = new Set(baselinePages.flatMap((page) => page.sections.flatMap((section) => (section.containers || []).map((container) => container.id))));
  const claimedPageIds = new Set<string>();
  const claimedSectionIds = new Set<string>();
  const claimedElementIds = new Set<string>();
  const claimedContainerIds = new Set<string>();

  const nextUnclaimed = <T extends { id: string },>(items: T[], claimed: Set<string>) => {
    const match = items.find((item) => !claimed.has(item.id));
    if (match) claimed.add(match.id);
    return match;
  };

  const operations = review.operations.map((operation) => {
    if (operation.kind !== 'add') return operation;

    if (operation.action === 'add_page' || operation.action === 'duplicate_page') {
      const addedPage = nextUnclaimed(
        candidatePages.filter((page) => !baselinePageIds.has(page.id)),
        claimedPageIds,
      );
      return addedPage
        ? { ...operation, pageId: addedPage.id, pageSlug: addedPage.slug, sectionId: undefined, elementId: undefined, containerId: undefined }
        : operation;
    }

    const targetPage = aiWebsitePatchReviewItemTargetPage(operation, candidatePages);
    const pageCandidates = targetPage ? [targetPage] : candidatePages;

    if (operation.action === 'add_section' || operation.action === 'duplicate_section') {
      const addedSection = nextUnclaimed(
        pageCandidates.flatMap((page) => page.sections).filter((section) => !baselineSectionIds.has(section.id)),
        claimedSectionIds,
      );
      const ownerPage = addedSection
        ? candidatePages.find((page) => page.sections.some((section) => section.id === addedSection.id))
        : undefined;
      return addedSection
        ? { ...operation, pageId: ownerPage?.id ?? operation.pageId, pageSlug: ownerPage?.slug ?? operation.pageSlug, sectionId: addedSection.id, elementId: undefined, containerId: undefined }
        : operation;
    }

    if (operation.action === 'add_element' || operation.action === 'duplicate_element' || operation.action === 'insert_symbol') {
      const addedElement = nextUnclaimed(
        pageCandidates.flatMap((page) => page.sections.flatMap((section) => section.elements)).filter((element) => !baselineElementIds.has(element.id)),
        claimedElementIds,
      );
      const ownerPage = addedElement
        ? candidatePages.find((page) => page.sections.some((section) => section.elements.some((element) => element.id === addedElement.id)))
        : undefined;
      const ownerSection = ownerPage?.sections.find((section) => section.elements.some((element) => element.id === addedElement?.id));
      return addedElement
        ? { ...operation, pageId: ownerPage?.id ?? operation.pageId, pageSlug: ownerPage?.slug ?? operation.pageSlug, sectionId: ownerSection?.id ?? operation.sectionId, elementId: addedElement.id, containerId: addedElement.containerId }
        : operation;
    }

    if (operation.action === 'add_container') {
      const addedContainer = nextUnclaimed(
        pageCandidates.flatMap((page) => page.sections.flatMap((section) => section.containers || [])).filter((container) => !baselineContainerIds.has(container.id)),
        claimedContainerIds,
      );
      const ownerPage = addedContainer
        ? candidatePages.find((page) => page.sections.some((section) => (section.containers || []).some((container) => container.id === addedContainer.id)))
        : undefined;
      const ownerSection = ownerPage?.sections.find((section) => (section.containers || []).some((container) => container.id === addedContainer?.id));
      return addedContainer
        ? { ...operation, pageId: ownerPage?.id ?? operation.pageId, pageSlug: ownerPage?.slug ?? operation.pageSlug, sectionId: ownerSection?.id ?? operation.sectionId, elementId: undefined, containerId: addedContainer.id }
        : operation;
    }

    return operation;
  });

  return {
    ...review,
    operations,
    destructiveCount: operations.filter((operation) => operation.kind === 'remove').length,
  };
}
