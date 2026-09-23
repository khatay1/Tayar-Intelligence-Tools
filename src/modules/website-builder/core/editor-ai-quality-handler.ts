import { createAIService } from '@/lib/ai/service';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { EditorAIAsyncContext } from '../core/editor-ai-operation-context';
import type { AIQualityReview } from '../core/editor-ai-patch-review';
import type { AIEditScopeTarget } from '../core/editor-ai-scope';
import type { Device,ElementShadow,SectionContentWidth,SectionLayout,SectionLayoutAlign,SectionResponsiveStyle,SectionType,WebsiteElementType,WebsiteFormFieldType } from '../core/types';

interface createAIQualityCheckHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  aiAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiBusy: boolean;
  aiEditorContextIsCurrent: (expected: EditorAIAsyncContext, requireSelection?: boolean) => boolean;
  aiQualityAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiQualityBusy: boolean;
  aiQualityOperationSequenceRef: React.MutableRefObject<number>;
  aiQualityReview: AIQualityReview | null;
  aiQualityReviewContextRef: React.MutableRefObject<EditorAIAsyncContext | null>;
  beginAIQualityRequest: () => AbortController;
  buildAIEditableSnapshot: (scope?: AIEditScopeTarget) => { siteName: string; activePageId: string; homePageId: string; editScope: AIEditScopeTarget | undefined; selection: { pageId: string; sectionId: string | null; elementId: string | null; device: Device; }; projectMap: { counts: { pages: number; sections: number; elements: number; reusableComponents: number; }; limits: { pages: number; sectionsPerPage: number; elementsPerSection: number; containersPerSection: number; formFieldsPerSection: number; reusableComponents: number; operationsPerRun: number; }; capabilities: string[]; pages: { id: string; name: string; slug: string; home: boolean; sections: { id: string; type: SectionType; anchorId: string; elementIds: string[]; containerIds: string[]; }[]; }[]; reusableComponents: { id: string; name: string; type: WebsiteElementType; instances: number; }[]; }; seo: { title: string; description: string; keywords: string[]; }; header: { enabled: boolean; sticky: boolean; mobileMenu: boolean; languageSwitcher: boolean; brandText: string; logoUrl: string; showCta: boolean; ctaLabel: string; ctaHref: string; backgroundColor: string; textColor: string; activeColor: string; hoverColor: string; ctaBackgroundColor: string; ctaTextColor: string; navGap: number; brandSize: number; navSize: number; borderColor: string; }; theme: { primaryColor: string; secondaryColor: string; backgroundColor: string; textColor: string; mutedTextColor: string; fontFamily: string; contentWidth: number; buttonRadius: number; sectionSpacing: number; }; symbols: { id: string; name: string; type: WebsiteElementType; content: string; }[]; pages: { id: string; name: string; slug: string; showInNavigation: boolean; seoTitle: string; seoDescription: string; canonicalUrl: string; noIndex: boolean; sections: { id: string; type: SectionType; title: string; description: string; buttonText: string; buttonUrl: string; background: string; accent: string; image: string | undefined; imagePrompt: string | undefined; backgroundMode: import("./types").SectionBackgroundMode | undefined; backgroundImage: string | undefined; backgroundPosition: import("./types").SectionBackgroundPosition | undefined; backgroundSize: import("./types").SectionBackgroundSize | undefined; gradientFrom: string | undefined; gradientTo: string | undefined; gradientAngle: number | undefined; overlayColor: string | undefined; overlayOpacity: number | undefined; sectionRadius: number | undefined; anchorId: string | undefined; layout: SectionLayout | undefined; layoutAlign: SectionLayoutAlign | undefined; contentWidth: SectionContentWidth | undefined; minHeight: number | undefined; sectionPaddingY: number | undefined; sectionPaddingX: number | undefined; layoutGap: number | undefined; responsive: Partial<Record<Device, SectionResponsiveStyle>>; containers: { id: string; name: string; layout: import("./types").ElementContainerLayout; gap: number; rowGap: number | undefined; columns: number | undefined; wrap: boolean | undefined; align: import("./types").ElementContainerAlign; justify: import("./types").ElementContainerJustify | undefined; backgroundColor: string; padding: number; borderRadius: number; borderWidth: number; borderColor: string; shadow: ElementShadow; layoutColumn: number | undefined; columnSpan: number | undefined; }[]; form: { successMessage: string; successAction: "message" | "redirect"; redirectUrl: string; fields: { id: string; name: string; label: string; type: WebsiteFormFieldType; placeholder: string; required: boolean; options: string[]; }[]; } | undefined; elements: { id: string; type: WebsiteElementType; content: string; href: string | undefined; src: string | undefined; layoutColumn: number | undefined; containerId: string | undefined; symbolId: string | undefined; animationOnce: boolean | undefined; animationTrigger: import("./types").ElementAnimationTrigger | undefined; style: import("./types").ElementStyle; responsive: Partial<Record<Device, import("./types").ElementStyle>>; }[]; }[]; }[]; };
  captureAIEditorContext: () => { loadSequence: number; userId: string | null; routeProjectId: string | null; projectId: string | null; ownerId: string | null; editableFingerprint: string; activePageId: string; sectionId: string | null; elementId: string | null; containerId: string | null; formFieldId: string | null; device: string; };
  designSystemReport: import("./website-design-system").WebsiteDesignSystemReport;
  finishAIQualityRequest: (controller: AbortController) => void;
  l: (text: string) => string;
  qualityDiagnostics: { pages: number; sections: number; elements: number; snapshotKb: number; warnings: string[]; healthy: boolean; };
  setAiError: React.Dispatch<React.SetStateAction<string>>;
  setAiQualityBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setAiQualityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiQualityReview: React.Dispatch<React.SetStateAction<AIQualityReview | null>>;
  siteAudit: { errors: string[]; warnings: string[]; score: number; };
  user: User | null;
}

export function createAIQualityCheckHandler({
  activeUserIdRef,
  aiAbortControllerRef,
  aiBusy,
  aiEditorContextIsCurrent,
  aiQualityAbortControllerRef,
  aiQualityBusy,
  aiQualityOperationSequenceRef,
  aiQualityReview,
  aiQualityReviewContextRef,
  beginAIQualityRequest,
  buildAIEditableSnapshot,
  captureAIEditorContext,
  designSystemReport,
  finishAIQualityRequest,
  l,
  qualityDiagnostics,
  setAiError,
  setAiQualityBusy,
  setAiQualityOpen,
  setAiQualityReview,
  siteAudit,
  user,
}: createAIQualityCheckHandlerDependencies) {
  return async function runAIQualityCheck(): Promise<AIQualityReview | null> {
    if (aiAbortControllerRef.current || aiQualityAbortControllerRef.current) return null;
    if (aiQualityBusy || aiBusy) return aiQualityReview;

    const operationSequence = ++aiQualityOperationSequenceRef.current;
    const abortController = beginAIQualityRequest();
    const operationUserId = user?.id ?? null;
    const operationContext = captureAIEditorContext();
    const operationIsLatest = () =>
      aiQualityOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;
    const operationCanApply = () =>
      operationIsLatest() &&
      aiEditorContextIsCurrent(operationContext, false);
    const currentSite = buildAIEditableSnapshot();
    const qualityAudit = {
      score: siteAudit.score,
      errors: [...siteAudit.errors],
      warnings: [...siteAudit.warnings],
      diagnostics: {
        ...qualityDiagnostics,
        warnings: [...qualityDiagnostics.warnings],
      },
      designSystem: designSystemReport,
      deviceModes: ['desktop', 'tablet', 'mobile'],
    };

    setAiQualityBusy(true);
    setAiQualityOpen(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');
      const response = await ai.completeJSON<AIQualityReview>(
        {
          action: 'quality-check',
          currentSite,
          audit: qualityAudit,
        },
        [],
        { temperature: 0.25, maxTokens: 5000, signal: abortController.signal },
      );

      if (!operationCanApply()) return null;

      let review = response.json;
      if (!review && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        review = JSON.parse(cleaned) as AIQualityReview;
      }
      if (!review) throw new Error('AI quality check returned no review.');

      const deterministicFindings: AIQualityReview['findings'] = designSystemReport.issues.map((issue) => ({
        severity: issue.severity,
        title: issue.title,
        detail: issue.detail,
      }));
      const modelFindings: AIQualityReview['findings'] = Array.isArray(review.findings)
        ? review.findings.map((finding) => ({
            severity: finding.severity === 'critical' || finding.severity === 'warning' ? finding.severity : 'improvement',
            title: String(finding.title || 'Website improvement').slice(0, 120),
            detail: String(finding.detail || '').slice(0, 500),
          }))
        : [];
      const normalized: AIQualityReview = {
        score: Math.min(
          designSystemReport.score,
          Math.max(0, Math.min(100, Number(review.score) || 0)),
        ),
        summary: String(review.summary || 'Quality review completed.').slice(0, 500),
        findings: [
          ...deterministicFindings,
          ...modelFindings,
        ].slice(0, 8),
        fixPrompt: [
          String(review.fixPrompt || ''),
          deterministicFindings.length
            ? `Respect the global design system and safely fix these measured issues: ${deterministicFindings.map((finding) => `${finding.title}: ${finding.detail}`).join(' | ')}`
            : '',
        ].filter(Boolean).join('\n').slice(0, 5000),
      };

      if (!operationCanApply()) return null;
      aiQualityReviewContextRef.current = operationContext;
      setAiQualityReview(normalized);
      return normalized;
    } catch (error) {
      if (!operationCanApply()) return null;
      const message = error instanceof Error ? error.message : 'AI quality check failed.';
      setAiError(message);
      aiQualityReviewContextRef.current = operationContext;
      setAiQualityReview({
        score: Math.min(qualityAudit.score, designSystemReport.score),
        summary: l('Automated builder audit is available, but the AI review could not complete.'),
        findings: [
          ...qualityAudit.errors.slice(0, 4).map((detail) => ({ severity: 'critical' as const, title: l('Publish blocker'), detail })),
          ...qualityAudit.warnings.slice(0, 4).map((detail) => ({ severity: 'warning' as const, title: l('Recommended improvement'), detail })),
          ...designSystemReport.issues.map((issue) => ({ severity: issue.severity, title: issue.title, detail: issue.detail })),
        ].slice(0, 8),
        fixPrompt: '',
      });
      return null;
    } finally {
      finishAIQualityRequest(abortController);
      if (operationIsLatest()) setAiQualityBusy(false);
    }
  };
}
