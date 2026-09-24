import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { aiWebsitePatchReviewItemTargetPage } from './editor-ai-review-targets';
import type { AIWebsiteCandidatePreview, WebsitePage } from './website-builder-model';
import type { AIWebsitePatchReviewItem } from './editor-ai-patch-review';

interface CandidateReviewContext {
  aiCandidatePreview: AIWebsiteCandidatePreview | null;
  aiCandidatePreviewResolverRef: MutableRefObject<((approved: boolean) => void) | null>;
  aiCandidateReviewPages: Array<{ page: WebsitePage; status: 'added' | 'changed' | 'current' | 'removed'; operationCount: number }>;
  aiCandidateReviewedPageCount: number;
  aiCandidateReviewedOperationCount: number;
  aiCandidateTargetableOperations: AIWebsitePatchReviewItem[];
  l: (text: string) => string;
  setAiCandidatePreview: Dispatch<SetStateAction<AIWebsiteCandidatePreview | null>>;
}

export function createCandidateReviewHandlers({
  aiCandidatePreview,
  aiCandidatePreviewResolverRef,
  aiCandidateReviewPages,
  aiCandidateReviewedPageCount,
  aiCandidateReviewedOperationCount,
  aiCandidateTargetableOperations,
  l,
  setAiCandidatePreview,
}: CandidateReviewContext) {
  function resolveAICandidatePreview(approved: boolean) {
    aiCandidatePreviewResolverRef.current?.(approved);
  }

  function previewAICandidatePage(pageId: string) {
    setAiCandidatePreview((current) => {
      if (!current) return current;
      const existsAfter = current.pages.some((page) => page.id === pageId);
      const existsBefore = current.baselinePages.some((page) => page.id === pageId);
      if (!existsAfter && !existsBefore) return current;
      const reviewedPageIds = current.reviewedPageIds.includes(pageId)
        ? current.reviewedPageIds
        : [...current.reviewedPageIds, pageId];
      return {
        ...current,
        activePageId: pageId,
        viewMode: existsAfter ? (existsBefore ? current.viewMode : 'after') : 'before',
        reviewedPageIds,
        focusedOperationId: null,
      };
    });
  }

  function previewNextUnreviewedAICandidatePage() {
    const current = aiCandidatePreview;
    if (!current) return;
    const reviewedIds = new Set(current.reviewedPageIds);
    const activeIndex = Math.max(0, aiCandidateReviewPages.findIndex((item) => item.page.id === current.activePageId));
    const orderedPages = [
      ...aiCandidateReviewPages.slice(activeIndex + 1),
      ...aiCandidateReviewPages.slice(0, activeIndex + 1),
    ];
    const nextPage = orderedPages.find((item) => !reviewedIds.has(item.page.id));
    if (nextPage) previewAICandidatePage(nextPage.page.id);
  }

  function approveAICandidatePreview() {
    const criticalFindings = aiCandidatePreview?.agentReview?.findings?.filter((finding) => finding.severity === 'critical') ?? [];
    if (criticalFindings.length > 0) {
      const issueSummary = criticalFindings.map((finding) => `• ${finding.title}`).join('\n');
      if (!window.confirm(`${l('The AI review found critical issues:')}\n${issueSummary}\n\n${l('Keep result anyway?')}`)) return;
    }
    const unreviewedPageCount = aiCandidateReviewPages.length - aiCandidateReviewedPageCount;
    const unreviewedOperationCount = aiCandidateTargetableOperations.length - aiCandidateReviewedOperationCount;
    if (unreviewedPageCount > 0 || unreviewedOperationCount > 0) {
      const pendingReview = [
        unreviewedPageCount > 0 ? `${unreviewedPageCount} ${l('affected pages have not been reviewed.')}` : '',
        unreviewedOperationCount > 0 ? `${unreviewedOperationCount} ${l('targeted changes have not been reviewed.')}` : '',
      ].filter(Boolean).join('\n');
      if (!window.confirm(`${pendingReview}\n${l('Keep result anyway?')}`)) {
        if (unreviewedOperationCount > 0) previewNextUnreviewedAICandidateOperation();
        else previewNextUnreviewedAICandidatePage();
        return;
      }
    }
    resolveAICandidatePreview(true);
  }

  function previewNextUnreviewedAICandidateOperation() {
    const current = aiCandidatePreview;
    if (!current) return;
    const reviewedIds = new Set(current.reviewedOperationIds);
    const activeIndex = Math.max(0, aiCandidateTargetableOperations.findIndex(
      (operation) => operation.id === current.focusedOperationId,
    ));
    const orderedOperations = [
      ...aiCandidateTargetableOperations.slice(activeIndex + 1),
      ...aiCandidateTargetableOperations.slice(0, activeIndex + 1),
    ];
    const nextOperation = orderedOperations.find((operation) => !reviewedIds.has(operation.id));
    if (nextOperation) revealAICandidateOperation(nextOperation);
  }

  function revealAICandidateOperation(operation: AIWebsitePatchReviewItem) {
    const current = aiCandidatePreview;
    if (!current) return;
    const preferredPages = operation.kind === 'remove' ? current.baselinePages : current.pages;
    const fallbackPages = operation.kind === 'remove' ? current.pages : current.baselinePages;
    const targetPage = aiWebsitePatchReviewItemTargetPage(operation, preferredPages)
      ?? aiWebsitePatchReviewItemTargetPage(operation, fallbackPages);
    const nextPageId = targetPage?.id ?? current.activePageId;
    const existsAfter = current.pages.some((page) => page.id === nextPageId);
    const existsBefore = current.baselinePages.some((page) => page.id === nextPageId);
    const nextViewMode = operation.kind === 'remove' && existsBefore
      ? 'before'
      : operation.kind === 'add' && existsAfter
        ? 'after'
        : current.viewMode;

    setAiCandidatePreview((latest) => {
      if (!latest) return latest;
      return {
        ...latest,
        activePageId: nextPageId,
        viewMode: nextViewMode,
        reviewedPageIds: latest.reviewedPageIds.includes(nextPageId)
          ? latest.reviewedPageIds
          : [...latest.reviewedPageIds, nextPageId],
        reviewedOperationIds: latest.reviewedOperationIds.includes(operation.id)
          ? latest.reviewedOperationIds
          : [...latest.reviewedOperationIds, operation.id],
        focusedOperationId: operation.id,
      };
    });

    const targets: Array<{ attribute: string; id: string }> = [];
    if (operation.elementId) targets.push({ attribute: 'data-tayar-ai-target-element', id: operation.elementId });
    if (operation.containerId) targets.push({ attribute: 'data-tayar-ai-target-container', id: operation.containerId });
    if (operation.sectionId) targets.push({ attribute: 'data-tayar-ai-target-section', id: operation.sectionId });
    if (targets.length === 0) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        let canvasTarget: HTMLElement | undefined;
        for (const target of targets) {
          const matches = Array.from(document.querySelectorAll<HTMLElement>(`[${target.attribute}]`));
          canvasTarget = matches.find((element) => element.getAttribute(target.attribute) === target.id && element.getClientRects().length > 0)
            ?? matches.find((element) => element.getAttribute(target.attribute) === target.id);
          if (canvasTarget) break;
        }
        if (!canvasTarget) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        canvasTarget.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
        canvasTarget.focus({ preventScroll: true });
        if (!reducedMotion) {
          canvasTarget.animate(
            [
              { filter: 'brightness(1)' },
              { filter: 'brightness(1.35)' },
              { filter: 'brightness(1)' },
            ],
            { duration: 700, easing: 'ease-out' },
          );
        }
      });
    });
  }

  function revealAdjacentAICandidateOperation(direction: -1 | 1) {
    if (!aiCandidatePreview || aiCandidateTargetableOperations.length === 0) return;
    const currentIndex = aiCandidateTargetableOperations.findIndex(
      (operation) => operation.id === aiCandidatePreview.focusedOperationId,
    );
    const nextIndex = currentIndex < 0
      ? direction === 1 ? 0 : aiCandidateTargetableOperations.length - 1
      : (currentIndex + direction + aiCandidateTargetableOperations.length) % aiCandidateTargetableOperations.length;
    const nextOperation = aiCandidateTargetableOperations[nextIndex];
    if (nextOperation) revealAICandidateOperation(nextOperation);
  }

  function setAICandidatePreviewMode(viewMode: 'before' | 'after') {
    setAiCandidatePreview((current) => {
      if (!current || current.viewMode === viewMode) return current;
      const availablePages = viewMode === 'before' ? current.baselinePages : current.pages;
      if (!availablePages.some((page) => page.id === current.activePageId)) return current;
      return { ...current, viewMode };
    });
  }

  function moveAICandidatePreviewPage(direction: -1 | 1) {
    setAiCandidatePreview((current) => {
      if (!current) return current;
      const changedIds = new Set(current.changedPageIds);
      const removedIds = new Set(current.removedPageIds);
      const pageIds = [
        ...current.pages.filter((page) => changedIds.has(page.id) || page.id === current.activePageId).map((page) => page.id),
        ...current.baselinePages.filter((page) => removedIds.has(page.id)).map((page) => page.id),
      ];
      const uniquePageIds = [...new Set(pageIds)];
      if (uniquePageIds.length < 2) return current;
      const activeIndex = Math.max(0, uniquePageIds.indexOf(current.activePageId));
      const nextPageId = uniquePageIds[(activeIndex + direction + uniquePageIds.length) % uniquePageIds.length];
      const existsAfter = current.pages.some((page) => page.id === nextPageId);
      const existsBefore = current.baselinePages.some((page) => page.id === nextPageId);
      return {
        ...current,
        activePageId: nextPageId,
        viewMode: existsAfter ? (existsBefore ? current.viewMode : 'after') : 'before',
        reviewedPageIds: current.reviewedPageIds.includes(nextPageId)
          ? current.reviewedPageIds
          : [...current.reviewedPageIds, nextPageId],
        focusedOperationId: null,
      };
    });
  }

  function requestAICandidatePreview(preview: AIWebsiteCandidatePreview, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (approved: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        if (aiCandidatePreviewResolverRef.current === finish) aiCandidatePreviewResolverRef.current = null;
        setAiCandidatePreview(null);
        resolve(approved);
      };
      const handleAbort = () => finish(false);

      aiCandidatePreviewResolverRef.current = finish;
      setAiCandidatePreview(preview);
      signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  return {
    resolveAICandidatePreview,
    previewAICandidatePage,
    previewNextUnreviewedAICandidatePage,
    approveAICandidatePreview,
    previewNextUnreviewedAICandidateOperation,
    revealAICandidateOperation,
    revealAdjacentAICandidateOperation,
    setAICandidatePreviewMode,
    moveAICandidatePreviewPage,
    requestAICandidatePreview,
  };
}
