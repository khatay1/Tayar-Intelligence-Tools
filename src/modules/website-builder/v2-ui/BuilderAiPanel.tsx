import type * as React from 'react';
import { Sparkles } from 'lucide-react';
import type { AIWebsitePatchReviewItem, AIWebsitePatchReview, AIWebsitePlanReview, AIQualityReview } from '../core/editor-ai-patch-review';
import type { AIEditScope, AIBuilderMessage } from '../core/editor-ai-scope';
import type { AIWebsiteCandidatePreview, WebsitePage, AIWebsiteUndoSnapshot } from '../core/website-builder-model';

interface BuilderAiPanelProps {
  aiBusy: boolean;
  aiCandidateActiveOperations: AIWebsitePatchReviewItem[];
  aiCandidateApproveButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  aiCandidateCanShowAfter: boolean;
  aiCandidateCanShowBefore: boolean;
  aiCandidateGlobalOperations: AIWebsitePatchReviewItem[];
  aiCandidatePreview: AIWebsiteCandidatePreview | null;
  aiCandidateReviewedOperationCount: number;
  aiCandidateReviewedPageCount: number;
  aiCandidateReviewPages: ({ page: WebsitePage; status: "added" | "changed" | "current"; operationCount: number; } | { page: WebsitePage; status: "removed"; operationCount: number; })[];
  aiCandidateTargetableOperations: AIWebsitePatchReviewItem[];
  aiEditScope: AIEditScope;
  aiEditScopeOptions: { value: AIEditScope; label: string; disabled: boolean; }[];
  aiError: string;
  aiIntent: "edit" | "build";
  aiMessages: AIBuilderMessage[];
  aiPatchApproveButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  aiPatchReview: AIWebsitePatchReview | null;
  aiPlan: { summary: string; pages: Array<{ name: string; sections: number; }>; } | null;
  aiPlanApproveButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  aiPlanReview: AIWebsitePlanReview | null;
  aiPreparedFollowUpRef: React.MutableRefObject<string | null>;
  aiPrompt: string;
  aiQualityBusy: boolean;
  aiQualityReview: AIQualityReview | null;
  aiSelectedDestructiveCount: number;
  aiStageStatus: string;
  aiUndoSnapshot: AIWebsiteUndoSnapshot | null;
  approveAICandidatePreview: () => void;
  l: (text: string) => string;
  moveAICandidatePreviewPage: (direction: -1 | 1) => void;
  previewAICandidatePage: (pageId: string) => void;
  previewNextUnreviewedAICandidateOperation: () => void;
  previewNextUnreviewedAICandidatePage: () => void;
  resolveAICandidatePreview: (approved: boolean) => void;
  resolveAIPatchReview: (approved: boolean) => void;
  resolveAIPlanReview: (approved: boolean) => void;
  revealAdjacentAICandidateOperation: (direction: -1 | 1) => void;
  revealAICandidateOperation: (operation: AIWebsitePatchReviewItem) => void;
  runAIQualityCheck: () => Promise<AIQualityReview | null>;
  setAICandidatePreviewMode: (viewMode: "before" | "after") => void;
  setAiEditScope: React.Dispatch<React.SetStateAction<AIEditScope>>;
  setAiIntent: React.Dispatch<React.SetStateAction<"edit" | "build">>;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  stopAIQualityCheck: () => void;
  stopAIRequest: () => void;
  submitV2AIRequest: () => void;
  toggleAIPatchReviewOperation: (operationId: string) => void;
  undoLastAIChange: () => void;
  v2AiMessagesEndRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function BuilderAiPanel({
  aiBusy,
  aiCandidateActiveOperations,
  aiCandidateApproveButtonRef,
  aiCandidateCanShowAfter,
  aiCandidateCanShowBefore,
  aiCandidateGlobalOperations,
  aiCandidatePreview,
  aiCandidateReviewedOperationCount,
  aiCandidateReviewedPageCount,
  aiCandidateReviewPages,
  aiCandidateTargetableOperations,
  aiEditScope,
  aiEditScopeOptions,
  aiError,
  aiIntent,
  aiMessages,
  aiPatchApproveButtonRef,
  aiPatchReview,
  aiPlan,
  aiPlanApproveButtonRef,
  aiPlanReview,
  aiPreparedFollowUpRef,
  aiPrompt,
  aiQualityBusy,
  aiQualityReview,
  aiSelectedDestructiveCount,
  aiStageStatus,
  aiUndoSnapshot,
  approveAICandidatePreview,
  l,
  moveAICandidatePreviewPage,
  previewAICandidatePage,
  previewNextUnreviewedAICandidateOperation,
  previewNextUnreviewedAICandidatePage,
  resolveAICandidatePreview,
  resolveAIPatchReview,
  resolveAIPlanReview,
  revealAdjacentAICandidateOperation,
  revealAICandidateOperation,
  runAIQualityCheck,
  setAICandidatePreviewMode,
  setAiEditScope,
  setAiIntent,
  setAiPrompt,
  stopAIQualityCheck,
  stopAIRequest,
  submitV2AIRequest,
  toggleAIPatchReviewOperation,
  undoLastAIChange,
  v2AiMessagesEndRef,
}: BuilderAiPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />

              <strong className="text-xs">
                Tayar AI
              </strong>
            </div>

            <p className="mt-1 text-[9px] leading-relaxed text-gray-500">{l("Build or edit your website with natural language.")}</p>
          </div>

          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-violet-300">
            {aiBusy ? aiStageStatus : l('Agent')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pt-3" role="group" aria-label={l('AI action')}>
        {(['edit', 'build'] as const).map((intent) => (
          <button key={intent} type="button" disabled={aiBusy || aiQualityBusy} aria-pressed={aiIntent === intent}
            onClick={() => setAiIntent(intent)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${aiIntent === intent ? 'border-violet-400/40 bg-violet-500/20 text-violet-200' : 'border-white/10 text-gray-400'}`}>
            {intent === 'edit' ? l('Edit current website') : l('Build new website')}
          </button>
        ))}
      </div>
      {aiIntent === 'edit' && (
        <div className="px-3 pt-3">
          <p className="mb-1.5 text-[8px] font-black uppercase tracking-wider text-gray-500">{l('Edit scope')}</p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={l('Edit scope')}>
            {aiEditScopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled || aiBusy || aiQualityBusy}
                aria-pressed={aiEditScope === option.value}
                onClick={() => setAiEditScope(option.value)}
                className={`rounded-lg border px-2 py-1.5 text-[8px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${aiEditScope === option.value ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200' : 'border-white/10 text-gray-400 hover:bg-white/[0.04]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="space-y-2">
          {aiMessages.slice(-8).map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'user'
                  ? 'ml-5 rounded-xl border border-violet-500/15 bg-violet-500/10 px-3 py-2.5 text-[10px] leading-relaxed text-violet-50'
                  : 'mr-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] leading-relaxed text-gray-300'
              }
            >
              <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-gray-500">
                {message.role === 'user'
                  ? l('You')
                  : 'Tayar AI'}
              </span>

              {l(message.content)}
            </div>
          ))}
        </div>

        {aiBusy && (
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.06] p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              {aiStageStatus}
            </div>
          </div>
        )}

        {aiPlanReview && (
          <div
            className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-3"
            role="dialog"
            aria-labelledby="tayar-ai-plan-review-title"
            aria-describedby="tayar-ai-plan-review-description"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              resolveAIPlanReview(false);
            }}
          >
            <strong id="tayar-ai-plan-review-title" className="text-[10px] text-amber-200">{l('Review AI plan')}</strong>
            <p className="mt-1 text-[9px] leading-relaxed text-gray-400">{aiPlanReview.summary}</p>
            <p id="tayar-ai-plan-review-description" className="mt-2 text-[8px] font-semibold text-amber-300">{l('No website changes have been applied yet.')}</p>
            <ol className="mt-2 space-y-1.5">
              {aiPlanReview.steps.map((step, index) => (
                <li key={step.id} className="rounded-lg border border-white/[0.07] bg-black/10 px-2.5 py-2 text-[9px] text-gray-300">
                  <span className="font-bold text-gray-200">{index + 1}. {step.title}</span>
                  {step.target && <span className="mt-0.5 block text-[8px] text-gray-500">{step.target}</span>}
                  {step.reason && <span className="mt-1 block text-[8px] text-gray-400">{step.reason}</span>}
                  {(step.acceptanceCriteria?.length ?? 0) > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[8px] text-emerald-300">
                      {step.acceptanceCriteria?.map((criterion) => <li key={criterion}>✓ {criterion}</li>)}
                    </ul>
                  )}
                  {(step.affectedPageIds?.length ?? 0) > 0 && (
                    <span className="mt-1 block text-[7px] text-cyan-300">{l('Affected pages')}: {step.affectedPageIds?.join(', ')}</span>
                  )}
                </li>
              ))}
            </ol>
            {aiPlanReview.warnings.length > 0 && (
              <p className="mt-2 text-[8px] leading-relaxed text-amber-300">{aiPlanReview.warnings.join(' · ')}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button ref={aiPlanApproveButtonRef} type="button" onClick={() => resolveAIPlanReview(true)} className="rounded-lg bg-emerald-600 px-2 py-2 text-[9px] font-black text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                {l('Approve and continue')}
              </button>
              <button type="button" aria-keyshortcuts="Escape" onClick={() => resolveAIPlanReview(false)} className="rounded-lg border border-white/10 px-2 py-2 text-[9px] font-bold text-gray-300 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
                {l('Discard plan')}
              </button>
            </div>
            <p className="mt-2 text-center text-[8px] text-gray-500">{l('Press Escape to discard')}</p>
          </div>
        )}

        {aiPatchReview && (
          <div
            className="rounded-xl border border-violet-400/30 bg-violet-500/[0.07] p-3"
            role="dialog"
            aria-labelledby="tayar-ai-patch-review-title"
            aria-describedby="tayar-ai-patch-review-description"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              resolveAIPatchReview(false);
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <strong id="tayar-ai-patch-review-title" className="text-[10px] text-violet-200">{l('Review exact changes')}</strong>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-bold text-gray-300">
                {aiPatchReview.selectedOperationIds.length}/{aiPatchReview.operations.length} {l('Selected')}
              </span>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-gray-300">{aiPatchReview.summary}</p>
            <p id="tayar-ai-patch-review-description" className="mt-2 text-[8px] font-semibold text-violet-300">{l('No website changes have been applied yet.')}</p>
            {typeof aiPatchReview.planCoveragePercent === 'number' && (
              <div className={`mt-2 rounded-lg border px-2 py-1.5 text-[8px] font-bold ${aiPatchReview.planCoveragePercent === 100 ? 'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-300' : 'border-amber-400/20 bg-amber-500/[0.06] text-amber-300'}`}>
                {l('Plan coverage')}: {aiPatchReview.planCoveragePercent}%
                {(aiPatchReview.uncoveredPlanStepIds?.length ?? 0) > 0 && ` · ${l('Uncovered steps')}: ${aiPatchReview.uncoveredPlanStepIds?.join(', ')}`}
              </div>
            )}
            {aiSelectedDestructiveCount > 0 && (
              <p className="mt-2 rounded-lg border border-red-400/20 bg-red-500/[0.08] px-2 py-1.5 text-[8px] font-bold text-red-300">
                {aiSelectedDestructiveCount} {l(aiSelectedDestructiveCount === 1 ? 'destructive change' : 'destructive changes')}
              </p>
            )}
            <ol className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {aiPatchReview.operations.map((operation, index) => (
                <li key={operation.id} className="rounded-lg border border-white/[0.08] bg-black/15 px-2.5 py-2 text-[9px] text-gray-300">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex min-w-0 cursor-pointer items-center gap-2 font-bold text-gray-100">
                      <input
                        type="checkbox"
                        checked={aiPatchReview.selectedOperationIds.includes(operation.id)}
                        onChange={() => toggleAIPatchReviewOperation(operation.id)}
                        className="h-3.5 w-3.5 shrink-0 accent-violet-500"
                      />
                      <span className="truncate">{index + 1}. {operation.label}</span>
                    </label>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${operation.kind === 'remove' ? 'border-red-400/25 bg-red-500/10 text-red-300' : operation.kind === 'add' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-violet-400/25 bg-violet-500/10 text-violet-300'}`}>
                      {l(operation.kind === 'remove' ? 'Remove' : operation.kind === 'add' ? 'Add' : 'Update')}
                    </span>
                  </div>

                  <span className="mt-0.5 block truncate text-[8px] text-gray-500" title={operation.target}>{operation.target}</span>
                  {operation.planStepId && <span className="mt-1 block text-[7px] font-bold text-cyan-300">{l('Plan step')}: {operation.planStepId}</span>}
                  {operation.fields.length > 0 && (
                    <span className="mt-1 block text-[8px] text-gray-400">{l('Fields')}: {operation.fields.join(', ')}</span>
                  )}
                </li>
              ))}
            </ol>
            {aiPatchReview.warnings.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-2 text-[8px] leading-relaxed text-amber-300">
                <span className="font-black">{l('Warnings')}:</span> {aiPatchReview.warnings.join(' · ')}
              </div>
            )}
            {aiPatchReview.confidence !== null && (
              <p className="mt-2 text-[8px] text-gray-400">{l('Confidence')}: {Math.round(aiPatchReview.confidence * 100)}%</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button ref={aiPatchApproveButtonRef} type="button" disabled={aiPatchReview.selectedOperationIds.length === 0} onClick={() => resolveAIPatchReview(true)} className="rounded-lg bg-emerald-600 px-2 py-2 text-[9px] font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                {l('Apply changes')}
              </button>
              <button type="button" aria-keyshortcuts="Escape" onClick={() => resolveAIPatchReview(false)} className="rounded-lg border border-white/10 px-2 py-2 text-[9px] font-bold text-gray-300 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
                {l('Discard changes')}
              </button>
            </div>
            <p className="mt-2 text-center text-[8px] text-gray-500">{l('Press Escape to discard')}</p>
          </div>
        )}

        {aiCandidatePreview && (
          <div
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.07] p-3"
            role="dialog"
            aria-labelledby="tayar-ai-result-review-title"
            aria-describedby="tayar-ai-result-review-description"
            aria-keyshortcuts="Escape Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Alt+PageUp Alt+PageDown"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                resolveAICandidatePreview(false);
                return;
              }
              if (!event.altKey) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setAICandidatePreviewMode(event.key === 'ArrowLeft' ? 'before' : 'after');
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveAICandidatePreviewPage(event.key === 'ArrowUp' ? -1 : 1);
              } else if (event.key === 'PageUp' || event.key === 'PageDown') {
                event.preventDefault();
                revealAdjacentAICandidateOperation(event.key === 'PageUp' ? -1 : 1);
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <strong id="tayar-ai-result-review-title" className="text-[10px] text-emerald-200">{l('Review rendered result')}</strong>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-bold text-gray-300">
                {aiCandidatePreview.applied} {l('applied')} · {aiCandidatePreview.skipped} {l('skipped')}
              </span>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-gray-300">{aiCandidatePreview.summary}</p>
            <p id="tayar-ai-result-review-description" className="mt-2 text-[8px] font-semibold text-emerald-300">
              {l('This is a temporary preview. Your saved project is unchanged.')}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label={l('Compare result')}>
              {(['before', 'after'] as const).map((viewMode) => {
                const selected = aiCandidatePreview.viewMode === viewMode;
                const available = viewMode === 'before' ? aiCandidateCanShowBefore : aiCandidateCanShowAfter;
                return (
                  <button
                    key={viewMode}
                    type="button"
                    aria-pressed={selected}
                    aria-keyshortcuts={viewMode === 'before' ? 'Alt+ArrowLeft' : 'Alt+ArrowRight'}
                    disabled={!available}
                    onClick={() => setAICandidatePreviewMode(viewMode)}
                    className={`rounded-lg border px-2 py-1.5 text-[8px] font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-black/10 text-gray-400 hover:bg-white/[0.05]'}`}
                  >
                    {l(viewMode === 'before' ? 'Before' : 'After')}
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] font-black uppercase tracking-wide text-gray-500">{l('Preview pages')}</span>
                <span className="text-[8px] font-semibold text-gray-400" aria-live="polite">
                  {l('Reviewed pages')}: {aiCandidateReviewedPageCount}/{aiCandidateReviewPages.length}
                </span>
              </div>
              <div className="mt-1.5 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1" role="group" aria-label={l('Preview pages')}>
                {aiCandidateReviewPages.map(({ page, status, operationCount }) => {
                    const active = page.id === aiCandidatePreview.activePageId;
                    const reviewed = aiCandidatePreview.reviewedPageIds.includes(page.id);
                    return (
                      <button
                        key={page.id}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${page.name}, ${l(status === 'added' ? 'Added' : status === 'removed' ? 'Removed' : status === 'changed' ? 'Changed' : 'Current')}, ${l(reviewed ? 'Reviewed' : 'Not reviewed')}`}
                        onClick={() => previewAICandidatePage(page.id)}
                        className={`rounded-lg border px-2 py-1.5 text-left text-[8px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${active ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-black/10 text-gray-300 hover:bg-white/[0.05]'}`}
                      >
                        {reviewed && <span className="mr-1 text-emerald-300" aria-hidden="true">✓</span>}
                        <span>{page.name}</span>
                        {status !== 'current' && (
                          <span className={`ml-1.5 text-[7px] uppercase tracking-wide ${status === 'added' ? 'text-cyan-300' : status === 'removed' ? 'text-red-300' : 'text-violet-300'}`}>
                            {l(status === 'added' ? 'Added' : status === 'removed' ? 'Removed' : 'Changed')}
                          </span>
                        )}
                        {operationCount > 0 && (
                          <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] text-gray-300" aria-hidden="true">
                            {operationCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
              {aiCandidateReviewedPageCount < aiCandidateReviewPages.length && (
                <button
                  type="button"
                  onClick={previewNextUnreviewedAICandidatePage}
                  className="mt-1.5 w-full rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[8px] font-bold text-emerald-200 transition hover:bg-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                >
                  {l('Review next page')}
                </button>
              )}
              {aiCandidateReviewPages.length > 1 && (
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[8px] text-gray-500">
                  <span>{l('Alt + Up/Down switches pages')}</span>
                  <span>{l('Alt + Left/Right compares before and after')}</span>
                </div>
              )}
            </div>
            {aiCandidateTargetableOperations.length > 0 && (
              <div className="mt-2 rounded-lg border border-white/[0.08] bg-black/15 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wide text-gray-500">{l('Reviewed changes')}</span>
                  <span className="text-[8px] font-semibold text-gray-400" aria-live="polite">
                    {aiCandidateReviewedOperationCount}/{aiCandidateTargetableOperations.length}
                  </span>
                </div>
                {aiCandidateReviewedOperationCount < aiCandidateTargetableOperations.length && (
                  <button
                    type="button"
                    onClick={previewNextUnreviewedAICandidateOperation}
                    className="mt-1.5 w-full rounded-md border border-violet-400/20 bg-violet-500/[0.06] px-2 py-1.5 text-[8px] font-bold text-violet-200 transition hover:bg-violet-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                  >
                    {l('Review next change')}
                  </button>
                )}
              </div>
            )}
            {aiCandidateActiveOperations.length > 0 && (
              <details className="mt-2 rounded-lg border border-white/[0.08] bg-black/15 px-2.5 py-2 text-[8px] text-gray-300">
                <summary className="cursor-pointer font-black text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                  {l('Changes affecting this page')} · {aiCandidateActiveOperations.length}
                  {aiCandidateGlobalOperations.length > 0 && (
                    <span className="ml-1.5 font-semibold text-violet-300">
                      ({aiCandidateGlobalOperations.length} {l(aiCandidateGlobalOperations.length === 1 ? 'site-wide change' : 'site-wide changes')})
                    </span>
                  )}
                </summary>
                <ol className="mt-2 space-y-1.5">
                  {aiCandidateActiveOperations.map((operation) => {
                    const reviewed = aiCandidatePreview.reviewedOperationIds.includes(operation.id);
                    return (
                    <li key={operation.id}>
                      <button
                        type="button"
                        disabled={!operation.sectionId && !operation.elementId && !operation.containerId}
                        onClick={() => revealAICandidateOperation(operation)}
                        aria-pressed={operation.id === aiCandidatePreview.focusedOperationId}
                        aria-label={`${operation.label}, ${l(reviewed ? 'Reviewed' : 'Not reviewed')}`}
                        className={`flex w-full items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-left transition disabled:cursor-default disabled:hover:border-white/[0.06] disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${operation.id === aiCandidatePreview.focusedOperationId ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-white/[0.06] hover:border-emerald-400/20 hover:bg-emerald-500/[0.05]'}`}
                      >
                        <span>
                          <span className="block font-bold text-gray-200">
                            {reviewed && <span className="mr-1 text-emerald-300" aria-hidden="true">✓</span>}
                            {operation.label}
                          </span>
                          <span className="mt-0.5 block text-[7px] text-gray-500">{operation.target}</span>
                          {(operation.sectionId || operation.elementId || operation.containerId) && (
                            <span className="mt-1 block text-[7px] font-bold text-emerald-300">{l('Show on canvas')}</span>
                          )}
                        </span>
                        <span className={`shrink-0 text-[7px] font-black uppercase tracking-wide ${operation.kind === 'remove' ? 'text-red-300' : operation.kind === 'add' ? 'text-emerald-300' : 'text-violet-300'}`}>
                          {l(operation.kind === 'remove' ? 'Remove' : operation.kind === 'add' ? 'Add' : 'Update')}
                        </span>
                      </button>
                    </li>
                    );
                  })}
                </ol>
                {aiCandidateTargetableOperations.length > 1 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      aria-keyshortcuts="Alt+PageUp"
                      onClick={() => revealAdjacentAICandidateOperation(-1)}
                      className="rounded-md border border-white/10 px-2 py-1.5 font-bold text-gray-300 transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    >
                      ← {l('Previous change')}
                    </button>
                    <button
                      type="button"
                      aria-keyshortcuts="Alt+PageDown"
                      onClick={() => revealAdjacentAICandidateOperation(1)}
                      className="rounded-md border border-white/10 px-2 py-1.5 font-bold text-gray-300 transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    >
                      {l('Next change')} →
                    </button>
                  </div>
                )}
                {aiCandidateTargetableOperations.length > 1 && (
                  <p className="mt-1.5 text-center text-[7px] text-gray-500">{l('Alt + Page Up/Down switches changes')}</p>
                )}
              </details>
            )}
            {aiCandidatePreview.agentReview && (
              <div className="mt-2 rounded-lg border border-white/[0.08] bg-black/15 px-2.5 py-2 text-[8px] text-gray-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-gray-200">{l('Agent review')}</span>
                  {typeof aiCandidatePreview.agentReview.score === 'number' && (
                    <span className="font-black text-emerald-300">{aiCandidatePreview.agentReview.score}/100</span>
                  )}
                </div>
                {aiCandidatePreview.agentReview.summary && <p className="mt-1 leading-relaxed text-gray-400">{aiCandidatePreview.agentReview.summary}</p>}
                {(aiCandidatePreview.agentReview.findings?.length ?? 0) > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {(aiCandidatePreview.agentReview.findings ?? []).map((finding, index) => (
                      <li key={`${finding.title}-${index}`} className={finding.severity === 'critical' ? 'text-red-300' : finding.severity === 'warning' ? 'text-amber-300' : ''}>
                        <span className="font-bold">{finding.title}</span>{finding.detail ? ` · ${finding.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {aiCandidatePreview.agentReview.followUpPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      const followUpPrompt = aiCandidatePreview.agentReview?.followUpPrompt || '';
                      aiPreparedFollowUpRef.current = followUpPrompt;
                      setAiIntent('edit');
                      setAiPrompt(followUpPrompt);
                    }}
                    className="mt-2 w-full rounded-md border border-violet-400/20 bg-violet-500/[0.08] px-2 py-1.5 text-left font-bold text-violet-200 transition hover:bg-violet-500/[0.14]"
                  >
                    {l('Prepare suggested follow-up')}
                  </button>
                )}
              </div>
            )}
            {aiCandidatePreview.warnings.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-2 text-[8px] leading-relaxed text-amber-300">
                <span className="font-black">{l('Warnings')}:</span> {aiCandidatePreview.warnings.join(' · ')}
              </div>
            )}
            {aiCandidatePreview.confidence !== null && (
              <p className="mt-2 text-[8px] text-gray-400">{l('Confidence')}: {Math.round(aiCandidatePreview.confidence * 100)}%</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button ref={aiCandidateApproveButtonRef} type="button" onClick={approveAICandidatePreview} className="rounded-lg bg-emerald-600 px-2 py-2 text-[9px] font-black text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                {l('Keep result')}
              </button>
              <button type="button" aria-keyshortcuts="Escape" onClick={() => resolveAICandidatePreview(false)} className="rounded-lg border border-white/10 px-2 py-2 text-[9px] font-bold text-gray-300 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
                {l('Discard result')}
              </button>
            </div>
            <p className="mt-2 text-center text-[8px] text-gray-500">{l('Press Escape to discard')}</p>
          </div>
        )}

        {aiPlan && (
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">{l("Website plan")}</p>

            <p className="mt-1.5 text-[10px] leading-relaxed text-gray-300">
              {aiPlan.summary}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              {aiPlan.pages.map((page) => (
                <span
                  key={page.name}
                  className="rounded-full border border-white/10 px-2 py-1 text-[8px] text-gray-400"
                >
                  {page.name} - {page.sections} sections
                </span>
              ))}
            </div>
          </div>
        )}

        {aiQualityReview && (
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-[10px] text-emerald-300">{l("Quality score")}</strong>

              <span className="text-sm font-black text-emerald-400">
                {aiQualityReview.score}/100
              </span>
            </div>

            <p className="mt-1.5 text-[9px] leading-relaxed text-gray-400">
              {aiQualityReview.summary}
            </p>
          </div>
        )}

        {aiError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-red-300">
            {aiError}
          </div>
        )}

        <div>
          <p className="mb-2 text-[8px] font-black uppercase tracking-wider text-gray-500">{l("Quick actions")}</p>

          <div className="grid grid-cols-1 gap-1.5">
            {[
              'Make this page look more premium',
              'Improve mobile and tablet layout',
              'Improve the hero and calls to action',
              'Review this website and fix safe issues',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => { setAiIntent('edit'); setAiPrompt(prompt); }}
                disabled={aiBusy || aiQualityBusy}
                className="rounded-lg border border-white/10 px-2.5 py-2 text-left text-[9px] text-gray-400 transition hover:bg-white/[0.04] hover:text-gray-200 disabled:opacity-40"
              >
                {l(prompt)}
              </button>
            ))}
          </div>
        </div>
        <div ref={v2AiMessagesEndRef} aria-hidden="true" />
      </div>

      <div className="border-t border-white/10 p-3">
        <textarea
          value={aiPrompt}
          onChange={(event) =>
            setAiPrompt(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submitV2AIRequest();
          }}
          disabled={aiBusy || aiQualityBusy}
          rows={4}
          placeholder={
            aiIntent === 'edit'
              ? l('Tell Tayar AI what to change...')
              : l('Describe the website you want to build...')
          }
          className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-gray-600 focus:border-violet-500/50 disabled:opacity-50"
        />
        <p className="mt-1 text-[8px] text-gray-600">{l('Enter to send · Shift+Enter for a new line')}</p>

        <button
          type="button"
          onClick={aiBusy ? stopAIRequest : submitV2AIRequest}
          disabled={aiQualityBusy || (!aiBusy && !aiPrompt.trim())}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${aiBusy ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'}`}
        >
          <Sparkles className="h-3.5 w-3.5" />

          {aiBusy
            ? l('Stop AI')
            : aiIntent === 'edit'
              ? l('Apply AI change')
              : l('Build with Tayar AI')}
        </button>

        <div className="mt-2">
          <button
            type="button"
            onClick={aiQualityBusy ? stopAIQualityCheck : () => void runAIQualityCheck()}
            disabled={aiBusy}
            className={`w-full rounded-lg border px-2 py-2 text-[9px] font-bold disabled:opacity-40 ${aiQualityBusy ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' : 'border-white/10 text-gray-400 hover:bg-white/[0.04]'}`}
          >
            {aiQualityBusy
              ? l('Stop check')
              : l('Quality check')}
          </button>
        </div>

        {aiUndoSnapshot && (
          <button
            type="button"
            onClick={undoLastAIChange}
            disabled={aiBusy}
            className="mt-2 w-full rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-2 py-2 text-[9px] font-bold text-amber-300 disabled:opacity-40"
          >{l("Undo last AI change")}</button>
        )}
      </div>
    </div>
  );
}
