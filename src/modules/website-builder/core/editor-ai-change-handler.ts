import type { Language } from '@/context/PreferencesContext';
import { createAIService } from '@/lib/ai/service';
import { auditAIWebsiteCandidate, updateSectionContent, validateAIProjectIntegrity } from './editor-ai-candidate-audit';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import { createDefaultContactFormFields,createElement,ELEMENT_LABELS,normalizeSection,SECTION_LABELS } from '../core/defaults';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import { convertLegacyAIAddOperationToNative,convertLegacyAIGlobalOperationToNative,convertLegacyAIPageOperationToNative,convertLegacyAIPageUpdateOperationToNative,convertLegacyAIStructuralOperationToNative,convertLegacyAIUpdateOperationToNative,isLegacyAIGlobalNativeAction,isLegacyAIPageNativeAction,isLegacyAIStructuralNativeAction,isLegacyAIUpdateNativeAction } from '../core/editor-ai-native-bridge';
import type { EditorAIAsyncContext } from '../core/editor-ai-operation-context';
import type { AIQualityReview,AIWebsiteAgentPlan,AIWebsiteAgentPlanStep,AIWebsitePatchOperation,AIWebsitePatchReview,AIWebsitePlanReview } from '../core/editor-ai-patch-review';
import { aiWebsitePatchReviewKind,describeAIWebsitePatchFields,describeAIWebsitePatchTarget,humanizeAIWebsitePatchAction } from '../core/editor-ai-patch-review';
import { evaluateAIWebsitePlanCoverage } from '../core/editor-ai-plan-coverage';
import { aiWebsitePatchReviewItemTargetPage,reconcileAIWebsitePatchReviewTargets } from '../core/editor-ai-review-targets';
import type { AIBuilderMessage,AIBuilderStage,AIEditScope,AIEditScopeTarget,AIWebsiteAgentReview,AIWebsiteAgentReviewFinding,AIWebsitePatch } from '../core/editor-ai-scope';
import { aiOperationMatchesEditScope,buildAIConversationContext } from '../core/editor-ai-scope';
import { applyEditorAIWorkingNativeOperations } from '../core/editor-ai-working-project';
import type { EditorPageLike,EditorSymbolLike } from '../core/editor-model';
import type { EditorNativeOperation } from '../core/editor-native-operation';
import type { Device,ElementAnimation,ElementShadow,SectionContentWidth,SectionLayout,SectionLayoutAlign,SectionResponsiveStyle,SectionType,WebsiteBrand,WebsiteElement,WebsiteElementType,WebsiteFormField,WebsiteFormFieldType,WebsiteSection,WebsiteSEO } from '../core/types';
import { BILLING_PLAN_DETAILS,BUSINESS_BILLING_ENTITLEMENTS,normalizeHeaderConfig,normalizeTheme } from '../core/website-builder-config';
import type { AIWebsiteCandidatePreview,AIWebsiteUndoSnapshot,BillingPlan,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { cloneSymbolElement,normalizeAnchorId,normalizeFormFieldName,sectionColumnCount } from '../core/website-builder-rendering';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';

export interface AIChangeHandlerDependencies {
  activePageId: string;
  activeUserIdRef: React.MutableRefObject<string | null>;
  aiAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiBusy: boolean;
  aiEditorContextIsCurrent: (expected: EditorAIAsyncContext, requireSelection?: boolean) => boolean;
  aiEditScope: AIEditScope;
  aiMessages: AIBuilderMessage[];
  aiOperationSequenceRef: React.MutableRefObject<number>;
  aiPreparedFollowUpRef: React.MutableRefObject<string | null>;
  aiPrompt: string;
  aiQualityAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiQualityBusy: boolean;
  aiQualityReviewContextRef: React.MutableRefObject<EditorAIAsyncContext | null>;
  aiUndoContextRef: React.MutableRefObject<EditorAIAsyncContext | null>;
  beginAIRequest: () => AbortController;
  billingEntitlements: import("./website-builder-model").BillingEntitlements;
  billingPlan: BillingPlan;
  brand: WebsiteBrand;
  buildAIEditableSnapshot: (scope?: AIEditScopeTarget) => { siteName: string; activePageId: string; homePageId: string; editScope: AIEditScopeTarget | undefined; selection: { pageId: string; sectionId: string | null; elementId: string | null; device: Device; }; projectMap: { counts: { pages: number; sections: number; elements: number; reusableComponents: number; }; limits: { pages: number; sectionsPerPage: number; elementsPerSection: number; containersPerSection: number; formFieldsPerSection: number; reusableComponents: number; operationsPerRun: number; }; capabilities: string[]; pages: { id: string; name: string; slug: string; home: boolean; sections: { id: string; type: SectionType; anchorId: string; elementIds: string[]; containerIds: string[]; }[]; }[]; reusableComponents: { id: string; name: string; type: WebsiteElementType; instances: number; }[]; }; seo: { title: string; description: string; keywords: string[]; }; header: { enabled: boolean; sticky: boolean; mobileMenu: boolean; languageSwitcher: boolean; brandText: string; logoUrl: string; showCta: boolean; ctaLabel: string; ctaHref: string; backgroundColor: string; textColor: string; activeColor: string; hoverColor: string; ctaBackgroundColor: string; ctaTextColor: string; navGap: number; brandSize: number; navSize: number; borderColor: string; }; theme: { primaryColor: string; secondaryColor: string; backgroundColor: string; textColor: string; mutedTextColor: string; fontFamily: string; contentWidth: number; buttonRadius: number; sectionSpacing: number; }; symbols: { id: string; name: string; type: WebsiteElementType; content: string; }[]; pages: { id: string; name: string; slug: string; showInNavigation: boolean; seoTitle: string; seoDescription: string; canonicalUrl: string; noIndex: boolean; sections: { id: string; type: SectionType; title: string; description: string; buttonText: string; buttonUrl: string; background: string; accent: string; image: string | undefined; imagePrompt: string | undefined; backgroundMode: import("./types").SectionBackgroundMode | undefined; backgroundImage: string | undefined; backgroundPosition: import("./types").SectionBackgroundPosition | undefined; backgroundSize: import("./types").SectionBackgroundSize | undefined; gradientFrom: string | undefined; gradientTo: string | undefined; gradientAngle: number | undefined; overlayColor: string | undefined; overlayOpacity: number | undefined; sectionRadius: number | undefined; anchorId: string | undefined; layout: SectionLayout | undefined; layoutAlign: SectionLayoutAlign | undefined; contentWidth: SectionContentWidth | undefined; minHeight: number | undefined; sectionPaddingY: number | undefined; sectionPaddingX: number | undefined; layoutGap: number | undefined; responsive: Partial<Record<Device, SectionResponsiveStyle>>; containers: { id: string; name: string; layout: import("./types").ElementContainerLayout; gap: number; rowGap: number | undefined; columns: number | undefined; wrap: boolean | undefined; align: import("./types").ElementContainerAlign; justify: import("./types").ElementContainerJustify | undefined; backgroundColor: string; padding: number; borderRadius: number; borderWidth: number; borderColor: string; shadow: ElementShadow; layoutColumn: number | undefined; columnSpan: number | undefined; }[]; form: { successMessage: string; successAction: "message" | "redirect"; redirectUrl: string; fields: { id: string; name: string; label: string; type: WebsiteFormFieldType; placeholder: string; required: boolean; options: string[]; }[]; } | undefined; elements: { id: string; type: WebsiteElementType; content: string; href: string | undefined; src: string | undefined; layoutColumn: number | undefined; containerId: string | undefined; symbolId: string | undefined; animationOnce: boolean | undefined; animationTrigger: import("./types").ElementAnimationTrigger | undefined; style: import("./types").ElementStyle; responsive: Partial<Record<Device, import("./types").ElementStyle>>; }[]; }[]; }[]; };
  buildProjectSnapshot: () => { version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  captureAIEditorContext: () => { loadSequence: number; userId: string | null; routeProjectId: string | null; projectId: string | null; ownerId: string | null; editableFingerprint: string; activePageId: string; sectionId: string | null; elementId: string | null; containerId: string | null; formFieldId: string | null; device: string; };
  finishAIRequest: (controller: AbortController) => void;
  getCurrentPages: () => WebsitePage[];
  headerConfig: WebsiteHeaderConfig;
  homePageId: string;
  l: (text: string) => string;
  prefs: import("@/context/PreferencesContext").UserPreferences;
  pushProjectCheckpoint: (label: string, snapshot?: Record<string, unknown>) => void;
  remember: (current: WebsiteSection[], label?: string) => void;
  requestAICandidatePreview: (preview: AIWebsiteCandidatePreview, signal: AbortSignal) => Promise<boolean>;
  requestAIPatchReview: (review: AIWebsitePatchReview, signal: AbortSignal) => Promise<string[] | null>;
  requestAIPlanReview: (plan: AIWebsitePlanReview, signal: AbortSignal) => Promise<boolean>;
  requestGeneratedImage: (prompt: string, signal?: AbortSignal) => Promise<{ url: string; assetPath?: string; persisted?: boolean; persistenceError?: string; }>;
  sections: WebsiteSection[];
  selectedElementId: string | null;
  selectedId: string | null;
  seo: WebsiteSEO;
  setActivePageId: React.Dispatch<React.SetStateAction<string>>;
  setAiBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setAiCandidatePreview: React.Dispatch<React.SetStateAction<AIWebsiteCandidatePreview | null>>;
  setAiError: React.Dispatch<React.SetStateAction<string>>;
  setAiMessages: React.Dispatch<React.SetStateAction<AIBuilderMessage[]>>;
  setAiPatchReview: React.Dispatch<React.SetStateAction<AIWebsitePatchReview | null>>;
  setAiPlan: React.Dispatch<React.SetStateAction<{ summary: string; pages: Array<{ name: string; sections: number; }>; } | null>>;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  setAiQualityReview: React.Dispatch<React.SetStateAction<AIQualityReview | null>>;
  setAiStage: React.Dispatch<React.SetStateAction<AIBuilderStage>>;
  setAiUndoSnapshot: React.Dispatch<React.SetStateAction<AIWebsiteUndoSnapshot | null>>;
  setBuilderPanel: React.Dispatch<React.SetStateAction<"pages" | "add" | "layers">>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setHomePageId: React.Dispatch<React.SetStateAction<string>>;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPages: React.Dispatch<React.SetStateAction<WebsitePage[]>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSeo: React.Dispatch<React.SetStateAction<WebsiteSEO>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  setSymbols: React.Dispatch<React.SetStateAction<WebsiteSymbol[]>>;
  setTheme: React.Dispatch<React.SetStateAction<WebsiteTheme>>;
  siteName: string;
  symbols: WebsiteSymbol[];
  theme: WebsiteTheme;
  user: User | null;
}

export function createAIChangeHandler({
  activePageId,
  activeUserIdRef,
  aiAbortControllerRef,
  aiBusy,
  aiEditorContextIsCurrent,
  aiEditScope,
  aiMessages,
  aiOperationSequenceRef,
  aiPreparedFollowUpRef,
  aiPrompt,
  aiQualityAbortControllerRef,
  aiQualityBusy,
  aiQualityReviewContextRef,
  aiUndoContextRef,
  beginAIRequest,
  billingEntitlements,
  billingPlan,
  brand,
  buildAIEditableSnapshot,
  buildProjectSnapshot,
  captureAIEditorContext,
  finishAIRequest,
  getCurrentPages,
  headerConfig,
  homePageId,
  l,
  prefs,
  pushProjectCheckpoint,
  remember,
  requestAICandidatePreview,
  requestAIPatchReview,
  requestAIPlanReview,
  requestGeneratedImage,
  sections,
  selectedElementId,
  selectedId,
  seo,
  setActivePageId,
  setAiBusy,
  setAiCandidatePreview,
  setAiError,
  setAiMessages,
  setAiPatchReview,
  setAiPlan,
  setAiPrompt,
  setAiQualityReview,
  setAiStage,
  setAiUndoSnapshot,
  setBuilderPanel,
  setHeaderConfig,
  setHomePageId,
  setInspectorOpen,
  setPages,
  setSaved,
  setSections,
  setSelectedElementId,
  setSelectedId,
  setSeo,
  setSiteName,
  setSymbols,
  setTheme,
  siteName,
  symbols,
  theme,
  user,
}: AIChangeHandlerDependencies) {
  return async function applyAIChange(requestedPrompt?: string) {
    if (aiAbortControllerRef.current || aiQualityAbortControllerRef.current) return;
    const prompt = typeof requestedPrompt === 'string' ? requestedPrompt.trim() : aiPrompt.trim();
    if (!prompt || aiBusy || aiQualityBusy) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const abortController = beginAIRequest();
    const operationUserId = user?.id ?? null;
    const operationContext = captureAIEditorContext();
    const operationIsLatest = () =>
      aiOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;
    const operationCanApply = () =>
      operationIsLatest() &&
      aiEditorContextIsCurrent(operationContext, true);

    const requestId = `ai-edit-${Date.now()}`;
    const conversationContext = buildAIConversationContext(aiMessages);
    aiPreparedFollowUpRef.current = null;
    const currentPages = getCurrentPages();
    const editScope: AIEditScopeTarget = {
      kind: aiEditScope,
      pageId: activePageId,
      sectionId: selectedId,
      elementId: selectedElementId,
    };
    const snapshot: AIWebsiteUndoSnapshot = {
      pages: JSON.parse(JSON.stringify(currentPages)) as WebsitePage[],
      activePageId,
      homePageId,
      siteName,
      brand: JSON.parse(JSON.stringify(brand)) as WebsiteBrand,
      seo: JSON.parse(JSON.stringify(seo)) as WebsiteSEO,
      theme: JSON.parse(JSON.stringify(theme)) as WebsiteTheme,
      headerConfig: JSON.parse(JSON.stringify(headerConfig)) as WebsiteHeaderConfig,
      symbols: JSON.parse(JSON.stringify(symbols)) as WebsiteSymbol[],
    };

    setAiBusy(true);
    setAiError('');
    setAiPlan(null);
    setAiPatchReview(null);
    setAiCandidatePreview(null);
    setAiStage('planning');
    setAiMessages((current) => [
      ...current,
      { id: requestId, role: 'user' as const, content: prompt },
    ].slice(-12));

    try {
      const ai = createAIService('website-builder');
      const editableSnapshot = buildAIEditableSnapshot(editScope);
      const planResponse = await ai.completeJSON<AIWebsiteAgentPlan>(
        {
          action: 'plan-edit',
          prompt,
          currentSite: editableSnapshot,
          editScope,
          conversationContext,
        },
        [],
        { temperature: 0.2, maxTokens: 3500, signal: abortController.signal },
      );

      if (!operationCanApply()) return;

      let rawAgentPlan = planResponse.json as AIWebsiteAgentPlan | null;
      if (!rawAgentPlan && planResponse.content) {
        try {
          const cleanedPlan = planResponse.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          rawAgentPlan = JSON.parse(cleanedPlan) as AIWebsiteAgentPlan;
        } catch {
          rawAgentPlan = null;
        }
      }

      const plannedSteps = Array.isArray(rawAgentPlan?.steps)
        ? rawAgentPlan.steps
            .map((step, index): AIWebsiteAgentPlanStep | null => {
              if (!step || typeof step !== 'object') return null;
              const title = typeof step.title === 'string' ? step.title.trim().slice(0, 140) : '';
              if (!title) return null;
              return {
                id: typeof step.id === 'string' && step.id.trim() ? step.id.trim().slice(0, 40) : `step-${index + 1}`,
                title,
                target: typeof step.target === 'string' ? step.target.trim().slice(0, 180) : undefined,
                reason: typeof step.reason === 'string' ? step.reason.trim().slice(0, 220) : undefined,
                acceptanceCriteria: Array.isArray(step.acceptanceCriteria)
                  ? step.acceptanceCriteria.map((criterion) => String(criterion).trim().slice(0, 180)).filter(Boolean).slice(0, 4)
                  : [],
                affectedPageIds: Array.isArray(step.affectedPageIds)
                  ? step.affectedPageIds.map((pageId) => String(pageId).trim()).filter((pageId) => currentPages.some((page) => page.id === pageId)).slice(0, 12)
                  : [],
                destructive: step.destructive === true,
              };
            })
            .filter((step): step is AIWebsiteAgentPlanStep => Boolean(step))
            .slice(0, 12)
        : [];

      const agentPlan: AIWebsiteAgentPlan = {
        summary: typeof rawAgentPlan?.summary === 'string' && rawAgentPlan.summary.trim()
          ? rawAgentPlan.summary.trim().slice(0, 240)
          : 'Apply the requested website changes safely.',
        steps: plannedSteps.length
          ? plannedSteps
          : [{ id: 'step-1', title: 'Apply the requested changes with native editable Tayar operations.', destructive: false }],
        warnings: Array.isArray(rawAgentPlan?.warnings)
          ? rawAgentPlan.warnings.map((warning) => String(warning).trim()).filter(Boolean).slice(0, 5)
          : [],
      };
      const planPreview = (agentPlan.steps || []).map((step, index) => `${index + 1}. ${step.title}`).join(' → ');
      setAiMessages((current) => [
        ...current,
        {
          id: `ai-plan-${Date.now()}`,
          role: 'assistant' as const,
          content: `${l('Plan')}: ${planPreview}${agentPlan.warnings?.length ? ` · ${l('Warnings')}: ${agentPlan.warnings.join(' · ')}` : ''}`,
        },
      ].slice(-30));

      const planApproved = await requestAIPlanReview({
        summary: agentPlan.summary || 'Apply the requested website changes safely.',
        steps: agentPlan.steps || [],
        warnings: agentPlan.warnings || [],
      }, abortController.signal);
      if (!planApproved) {
        if (operationIsLatest() && !abortController.signal.aborted) {
          setAiStage('ready');
          setAiMessages((current) => [
            ...current,
            { id: `ai-plan-discarded-${Date.now()}`, role: 'assistant' as const, content: l('AI plan discarded. No changes were applied.') },
          ].slice(-20));
        }
        return;
      }
      if (!operationCanApply()) return;
      setAiStage('building');

      const response = await ai.completeJSON<AIWebsitePatch>(
        {
          action: 'edit',
          prompt,
          currentSite: editableSnapshot,
          executionPlan: agentPlan,
          editScope,
          conversationContext,
        },
        [],
        { temperature: 0.25, maxTokens: 12000, signal: abortController.signal },
      );

      if (!operationCanApply()) return;

      let patch = response.json;
      if (!patch && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        patch = JSON.parse(cleaned) as AIWebsitePatch;
      }

      const proposedOperations = Array.isArray(patch?.operations) ? patch.operations.slice(0, 60) : [];
      const operations = proposedOperations.filter((operation) =>
        operation && aiOperationMatchesEditScope(operation, editScope, currentPages));
      if (!patch || operations.length === 0) {
        throw new Error(l(proposedOperations.length
          ? 'AI proposed changes outside the locked scope. No changes were applied.'
          : 'AI did not return any safe website changes. Try a more specific request.'));
      }

      const destructiveActions = new Set([
        'remove_page', 'remove_section', 'remove_container', 'remove_element', 'remove_form_field',
      ]);
      const destructiveOperations = operations.filter((operation) => operation && destructiveActions.has(operation.action));
      const planCoverage = evaluateAIWebsitePlanCoverage(agentPlan.steps || [], operations);
      const patchWarnings = [
        ...(operations.length < proposedOperations.length
          ? [`${proposedOperations.length - operations.length} ${l('out-of-scope changes were blocked')}`]
          : []),
        ...(Array.isArray(patch.warnings)
          ? patch.warnings.map((warning) => String(warning).trim()).filter(Boolean).slice(0, 5)
          : []),
        ...planCoverage.warnings,
      ];
      const confidence = Number.isFinite(Number(patch.confidence))
        ? Math.min(1, Math.max(0, Number(patch.confidence)))
        : null;
      const summary = patch.summary?.trim().slice(0, 280) || `Apply ${operations.length} targeted AI change${operations.length === 1 ? '' : 's'}.`;
      const exactPatchReview: AIWebsitePatchReview = {
        summary,
        operations: operations.map((operation, index) => {
          const kind = aiWebsitePatchReviewKind(operation?.action || '');
          return {
            id: `operation-${index + 1}`,
            action: operation?.action,
            planStepId: typeof operation?.planStepId === 'string' ? operation.planStepId.trim().slice(0, 40) : undefined,
            label: operation && typeof operation.action === 'string'
              ? humanizeAIWebsitePatchAction(operation.action)
              : 'Unsupported operation',
            target: operation ? describeAIWebsitePatchTarget(operation) : 'Site-wide',
            fields: operation ? describeAIWebsitePatchFields(operation) : [],
            kind,
            pageId: operation?.pageId,
            pageSlug: operation?.pageSlug,
            sectionId: kind === 'add'
              ? operation?.afterSectionId || operation?.beforeSectionId || operation?.sectionId
              : operation?.sectionId,
            elementId: operation?.elementId,
            containerId: operation?.containerId,
          };
        }),
        selectedOperationIds: operations.map((_, index) => `operation-${index + 1}`),
        warnings: patchWarnings,
        confidence,
        destructiveCount: destructiveOperations.length,
        planCoveragePercent: planCoverage.percent,
        planStepIds: (agentPlan.steps || []).map((step) => step.id),
        uncoveredPlanStepIds: planCoverage.uncoveredStepIds,
      };
      const selectedPatchOperationIds = await requestAIPatchReview(exactPatchReview, abortController.signal);
      if (!selectedPatchOperationIds) {
        if (operationIsLatest() && !abortController.signal.aborted) {
          setAiStage('ready');
          setAiMessages((current) => [
            ...current,
            { id: `ai-patch-discarded-${Date.now()}`, role: 'assistant' as const, content: l('AI changes discarded. No changes were applied.') },
          ].slice(-20));
        }
        return;
      }
      const selectedOperationSet = new Set(selectedPatchOperationIds);
      if (selectedOperationSet.size === 0) {
        if (operationIsLatest() && !abortController.signal.aborted) {
          setAiStage('ready');
          setAiMessages((current) => [
            ...current,
            { id: `ai-patch-empty-${Date.now()}`, role: 'assistant' as const, content: l('No AI changes were selected.') },
          ].slice(-20));
        }
        return;
      }
      if (!operationCanApply()) return;

      const selectedPlanCoverage = evaluateAIWebsitePlanCoverage(
        agentPlan.steps || [],
        operations.filter((_, index) => selectedOperationSet.has(`operation-${index + 1}`)),
      );

      setAiStage('building');

      const allowedTypes = new Set<SectionType>([
        'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
      ]);
      const allowedElementTypes = new Set<WebsiteElementType>([
        'heading', 'text', 'button', 'image', 'video', 'list', 'divider', 'spacer',
        'accordion', 'tabs', 'gallery', 'embed', 'code', 'countdown', 'stats', 'testimonials-slider',
      ]);
      const allowedShadows = new Set<ElementShadow>(['none', 'sm', 'md', 'lg', 'xl']);
      const allowedAnimations = new Set<ElementAnimation>(['none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in', 'zoom-out', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'blur-in', 'flip-in', 'bounce-in']);
      const allowedAnimationTriggers = new Set(['scroll', 'load', 'hover', 'click']);
      const allowedAnimationEasings = new Set(['smooth', 'ease', 'linear', 'spring']);
      const allowedFormFieldTypes = new Set<WebsiteFormFieldType>(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']);
      const validHex = (value?: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');
      const finiteStyleNumber = (value: unknown, min: number, max: number) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
      const normalizeSlugValue = (value: string) => value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let nextPages = JSON.parse(JSON.stringify(currentPages)) as WebsitePage[];
      let nextSiteName = siteName;
      let nextHomePageId = homePageId;
      let nextTheme = { ...theme };
      let nextSeo: WebsiteSEO = { ...seo, keywords: [...seo.keywords] };
      let nextHeaderConfig: WebsiteHeaderConfig = { ...headerConfig };
      let nextSymbols = JSON.parse(JSON.stringify(symbols)) as WebsiteSymbol[];
      let applied = 0;
      const appliedOperationIds = new Set<string>();
      const nativeBridgeWarnings: string[] = [];

      const applyAIWorkingNativeOperations = (
        nativeOperations: EditorNativeOperation[],
        sourceAction: string,
      ) => {
        if (!nativeOperations.length) {
          return 'unchanged' as const;
        }

        const nativeResult =
          applyEditorAIWorkingNativeOperations(
            {
              pages:
                nextPages as unknown as EditorPageLike[],
              homePageId:
                nextHomePageId,
              theme: {
                ...nextTheme,
              },
              seo: {
                ...nextSeo,
                keywords: [
                  ...nextSeo.keywords,
                ],
              },
              headerConfig: {
                ...nextHeaderConfig,
              },
              symbols:
                JSON.parse(
                  JSON.stringify(nextSymbols),
                ) as EditorSymbolLike[],
            },
            nativeOperations,
            {
              source: 'ai',
              label:
                `Apply AI ${sourceAction.replace(/_/g, ' ')}`,
              limits: {
                maxPages:
                  BUSINESS_BILLING_ENTITLEMENTS.maxPages,
                maxSymbols: 50,
              },
              validateProject: (
                candidate,
                previous,
              ) => {
                const pageCountIncreased =
                  candidate.pages.length >
                  previous.pages.length;

                if (
                  pageCountIncreased &&
                  candidate.pages.length >
                    billingEntitlements.maxPages
                ) {
                  return {
                    ok: false,
                    errors: [
                      `Your ${BILLING_PLAN_DETAILS[billingPlan].label} plan supports up to ${billingEntitlements.maxPages} pages.`,
                    ],
                  };
                }

                return {
                  ok: true,
                };
              },
            },
          );

        if (!nativeResult.ok) {
          nativeBridgeWarnings.push(
            ...nativeResult.errors
              .map((error) =>
                `${sourceAction}: ${error}`,
              )
              .slice(0, 3),
          );
          return 'rejected' as const;
        }

        if (!nativeResult.changed) {
          return 'unchanged' as const;
        }

        const working =
          nativeResult.working;

        nextPages =
          working.pages as unknown as WebsitePage[];

        const requestedHomePageId =
          typeof working.homePageId === 'string'
            ? working.homePageId
            : nextHomePageId;

        if (
          nextPages.some(
            (page) =>
              page.id ===
              requestedHomePageId,
          )
        ) {
          nextHomePageId =
            requestedHomePageId;
        }

        if (
          working.theme &&
          typeof working.theme === 'object'
        ) {
          nextTheme =
            normalizeTheme(
              working.theme as Partial<WebsiteTheme>,
            );
        }

        if (
          working.seo &&
          typeof working.seo === 'object'
        ) {
          const rawSeo =
            working.seo as Partial<WebsiteSEO>;

          nextSeo = {
            title:
              typeof rawSeo.title === 'string'
                ? rawSeo.title
                : nextSeo.title,
            description:
              typeof rawSeo.description === 'string'
                ? rawSeo.description
                : nextSeo.description,
            keywords:
              Array.isArray(rawSeo.keywords)
                ? rawSeo.keywords
                    .filter(
                      (
                        keyword,
                      ): keyword is string =>
                        typeof keyword === 'string',
                    )
                    .slice(0, 40)
                : [
                    ...nextSeo.keywords,
                  ],
          };
        }

        if (
          working.headerConfig &&
          typeof working.headerConfig ===
            'object'
        ) {
          nextHeaderConfig =
            normalizeHeaderConfig(
              working.headerConfig as Partial<WebsiteHeaderConfig>,
            );
        }

        if (
          Array.isArray(
            working.symbols,
          )
        ) {
          nextSymbols =
            working.symbols as unknown as WebsiteSymbol[];
        }

        applied += 1;
        nativeBridgeWarnings.push(
          ...nativeResult.warnings
            .map((warning) =>
              `${sourceAction}: ${warning}`,
            )
            .slice(0, 3),
        );

        return 'changed' as const;
      };

      const applyAIWorkingNativeOperation = (
        nativeOperation: EditorNativeOperation,
        sourceAction: string,
      ) =>
        applyAIWorkingNativeOperations(
          [nativeOperation],
          sourceAction,
        );

      const applyAIGlobalNativeOperation = (
        operation: AIWebsitePatchOperation,
      ) => {
        if (!isLegacyAIGlobalNativeAction(operation.action)) {
          return false;
        }

        const nativeOperation =
          convertLegacyAIGlobalOperationToNative(
            operation as unknown as {
              action: string;
              changes?: Record<string, unknown>;
            },
          );

        if (nativeOperation) {
          applyAIWorkingNativeOperation(
            nativeOperation,
            operation.action,
          );
        }

        return true;
      };

      const resolvePageIndex = (operation: AIWebsitePatchOperation) => {
        if (operation.pageId) {
          const index = nextPages.findIndex((page) => page.id === operation.pageId);
          if (index >= 0) return index;
        }
        if (operation.pageSlug) {
          const slug = normalizeSlugValue(operation.pageSlug);
          const index = nextPages.findIndex((page) => normalizeSlugValue(page.slug) === slug);
          if (index >= 0) return index;
        }
        return nextPages.findIndex((page) => page.id === activePageId);
      };

      const applyAIPageNativeOperation = (
        operation: AIWebsitePatchOperation,
      ) => {
        if (operation.action === 'duplicate_page') {
          if (
            nextPages.length >= billingEntitlements.maxPages ||
            (!operation.pageId && !operation.pageSlug)
          ) {
            return true;
          }

          const sourceIndex = resolvePageIndex(operation);
          if (sourceIndex < 0 || sourceIndex >= nextPages.length) {
            return true;
          }

          const sourcePage = nextPages[sourceIndex];
          const changes = operation.changes || {};
          const requestedName =
            typeof changes.name === 'string' && changes.name.trim()
              ? changes.name.trim().slice(0, 60)
              : `${sourcePage.name} Copy`;
          const requestedSlug =
            typeof changes.slug === 'string' && changes.slug.trim()
              ? normalizeSlugValue(changes.slug)
              : normalizeSlugValue(`${sourcePage.slug}-copy`);

          applyAIWorkingNativeOperation(
            {
              action: 'duplicate_page',
              source: 'ai',
              pageId: sourcePage.id,
              changes: {
                name: requestedName,
                slug: requestedSlug || `page-copy-${Date.now()}`,
                translationKey: '',
                canonicalUrl: '',
              },
            },
            operation.action,
          );

          return true;
        }

        if (!isLegacyAIPageNativeAction(operation.action)) {
          return false;
        }

        if (operation.action === 'move_page') {
          if (
            !operation.pageId ||
            (!operation.beforePageId &&
              !operation.afterPageId) ||
            (operation.beforePageId &&
              operation.afterPageId)
          ) {
            return true;
          }

          const sourceIndex =
            nextPages.findIndex(
              (page) =>
                page.id === operation.pageId,
            );

          if (sourceIndex < 0) {
            return true;
          }

          const destinationId =
            operation.beforePageId ||
            operation.afterPageId ||
            '';

          if (
            destinationId ===
            operation.pageId
          ) {
            return true;
          }

          const destinationExists =
            nextPages.some(
              (page) =>
                page.id ===
                destinationId,
            );

          if (!destinationExists) {
            return true;
          }

          const nativeOperation =
            convertLegacyAIPageOperationToNative(
              operation,
              operation.pageId,
            );

          if (nativeOperation) {
            applyAIWorkingNativeOperation(
              nativeOperation,
              operation.action,
            );
          }

          return true;
        }

        if (
          !operation.pageId &&
          !operation.pageSlug
        ) {
          return true;
        }

        const pageIndex =
          resolvePageIndex(operation);

        if (
          pageIndex < 0 ||
          pageIndex >= nextPages.length
        ) {
          return true;
        }

        const pageId =
          nextPages[pageIndex].id;

        if (
          operation.action === 'remove_page' &&
          (
            nextPages.length <= 1 ||
            pageId === nextHomePageId
          )
        ) {
          return true;
        }

        if (
          operation.action === 'set_home_page' &&
          pageId === nextHomePageId
        ) {
          return true;
        }

        const nativeOperation =
          convertLegacyAIPageOperationToNative(
            operation,
            pageId,
          );

        if (nativeOperation) {
          applyAIWorkingNativeOperation(
            nativeOperation,
            operation.action,
          );
        }

        return true;
      };

      const resolveSectionIndex = (page: WebsitePage, operation: AIWebsitePatchOperation) => {
        if (operation.sectionId) {
          const index = page.sections.findIndex((section) => section.id === operation.sectionId);
          if (index >= 0) return index;
        }
        if (operation.sectionType && allowedTypes.has(operation.sectionType)) {
          return page.sections.findIndex((section) => section.type === operation.sectionType);
        }
        return -1;
      };

      const applyAIPageScopedStructuralNativeOperation = (
        operation: AIWebsitePatchOperation,
        pageIndex: number,
      ) => {
        if (
          operation.action !== 'remove_section' &&
          operation.action !== 'move_section' &&
          operation.action !== 'duplicate_section'
        ) {
          return false;
        }

        const page =
          nextPages[pageIndex];

        if (!page) {
          return true;
        }

        if (
          !operation.sectionId ||
          !page.sections.some(
            (section) =>
              section.id ===
              operation.sectionId,
          )
        ) {
          return true;
        }

        if (
          operation.action === 'remove_section' &&
          page.sections.length <= 1
        ) {
          return true;
        }

        if (operation.action === 'duplicate_section') {
          if (page.sections.length >= 20) {
            return true;
          }

          const beforeCandidate =
            typeof operation.beforeSectionId === 'string'
              ? operation.beforeSectionId.trim()
              : '';
          const afterCandidate =
            typeof operation.afterSectionId === 'string'
              ? operation.afterSectionId.trim()
              : '';
          const beforeId =
            beforeCandidate &&
            page.sections.some((section) => section.id === beforeCandidate)
              ? beforeCandidate
              : '';
          const afterId =
            !beforeId &&
            afterCandidate &&
            page.sections.some((section) => section.id === afterCandidate)
              ? afterCandidate
              : '';

          applyAIWorkingNativeOperation(
            {
              action: 'duplicate_section',
              source: 'ai',
              pageId: page.id,
              sectionId: operation.sectionId,
              changes: {
                anchorId: undefined,
              },
              ...(beforeId
                ? { position: { beforeId } }
                : afterId
                  ? { position: { afterId } }
                  : {}),
            },
            operation.action,
          );

          return true;
        }

        if (
          operation.action === 'move_section'
        ) {
          if (
            (!operation.beforeSectionId &&
              !operation.afterSectionId) ||
            (operation.beforeSectionId &&
              operation.afterSectionId)
          ) {
            return true;
          }

          const destinationId =
            operation.beforeSectionId ||
            operation.afterSectionId ||
            '';

          if (
            destinationId ===
            operation.sectionId ||
            !page.sections.some(
              (section) =>
                section.id === destinationId,
            )
          ) {
            return true;
          }
        }

        const nativeOperations =
          convertLegacyAIStructuralOperationToNative(
            operation,
            {
              pageId: page.id,
              sectionId:
                operation.sectionId,
            },
          );

        if (nativeOperations.length) {
          applyAIWorkingNativeOperations(
            nativeOperations,
            operation.action,
          );
        }

        return true;
      };

      const applyAISectionScopedStructuralNativeOperation = (
        operation: AIWebsitePatchOperation,
        pageIndex: number,
        sectionIndex: number,
      ) => {
        const page =
          nextPages[pageIndex];
        const section =
          page?.sections[sectionIndex];

        if (!page || !section) {
          return true;
        }

        if (operation.action === 'duplicate_element') {
          if (
            !operation.elementId ||
            section.elements.length >= 60 ||
            !section.elements.some(
              (element) => element.id === operation.elementId,
            )
          ) {
            return true;
          }

          const beforeCandidate =
            typeof operation.beforeElementId === 'string'
              ? operation.beforeElementId.trim()
              : '';
          const afterCandidate =
            typeof operation.afterElementId === 'string'
              ? operation.afterElementId.trim()
              : '';
          const beforeId =
            beforeCandidate &&
            beforeCandidate !== operation.elementId &&
            section.elements.some(
              (element) => element.id === beforeCandidate,
            )
              ? beforeCandidate
              : '';
          const afterId =
            !beforeId &&
            afterCandidate &&
            afterCandidate !== operation.elementId &&
            section.elements.some(
              (element) => element.id === afterCandidate,
            )
              ? afterCandidate
              : '';

          applyAIWorkingNativeOperation(
            {
              action: 'duplicate_element',
              source: 'ai',
              pageId: page.id,
              sectionId: section.id,
              elementId: operation.elementId,
              ...(beforeId
                ? { position: { beforeId } }
                : afterId
                  ? { position: { afterId } }
                  : {}),
            },
            operation.action,
          );

          return true;
        }

        if (operation.action === 'create_symbol') {
          if (
            !operation.elementId ||
            nextSymbols.length >= 50
          ) {
            return true;
          }

          const targetElement =
            section.elements.find(
              (element) =>
                element.id === operation.elementId,
            );

          if (!targetElement || targetElement.symbolId) {
            return true;
          }

          const symbolName =
            typeof operation.symbolName === 'string' &&
            operation.symbolName.trim()
              ? operation.symbolName.trim().slice(0, 80)
              : (
                  targetElement.content?.trim().slice(0, 60) ||
                  ELEMENT_LABELS[targetElement.type] ||
                  'Reusable component'
                );

          applyAIWorkingNativeOperation(
            {
              action: 'create_symbol',
              source: 'ai',
              pageId: page.id,
              sectionId: section.id,
              elementId: targetElement.id,
              symbolName,
            },
            operation.action,
          );

          return true;
        }

        if (operation.action === 'insert_symbol') {
          if (
            !operation.symbolId ||
            section.elements.length >= 60 ||
            !nextSymbols.some(
              (symbol) => symbol.id === operation.symbolId,
            )
          ) {
            return true;
          }

          const beforeCandidate =
            typeof operation.beforeElementId === 'string'
              ? operation.beforeElementId.trim()
              : '';
          const afterCandidate =
            typeof operation.afterElementId === 'string'
              ? operation.afterElementId.trim()
              : '';
          const beforeId =
            beforeCandidate &&
            section.elements.some(
              (element) => element.id === beforeCandidate,
            )
              ? beforeCandidate
              : '';
          const afterId =
            !beforeId &&
            afterCandidate &&
            section.elements.some(
              (element) => element.id === afterCandidate,
            )
              ? afterCandidate
              : '';

          applyAIWorkingNativeOperation(
            {
              action: 'insert_symbol',
              source: 'ai',
              pageId: page.id,
              sectionId: section.id,
              symbolId: operation.symbolId,
              ...(beforeId
                ? { position: { beforeId } }
                : afterId
                  ? { position: { afterId } }
                  : {}),
            },
            operation.action,
          );

          return true;
        }

        if (
          !isLegacyAIStructuralNativeAction(
            operation.action,
          ) ||
          operation.action === 'remove_section' ||
          operation.action === 'move_section'
        ) {
          return false;
        }

        if (
          operation.action === 'remove_element'
        ) {
          if (
            !operation.elementId ||
            section.elements.length <= 1
          ) {
            return true;
          }

          const target =
            section.elements.find(
              (element) =>
                element.id ===
                operation.elementId,
            );

          if (!target || target.symbolId) {
            return true;
          }
        }

        if (
          operation.action === 'move_element'
        ) {
          if (
            !operation.elementId ||
            (!operation.beforeElementId &&
              !operation.afterElementId) ||
            (operation.beforeElementId &&
              operation.afterElementId)
          ) {
            return true;
          }

          const source =
            section.elements.find(
              (element) =>
                element.id ===
                operation.elementId,
            );

          if (!source || source.symbolId) {
            return true;
          }

          const destinationId =
            operation.beforeElementId ||
            operation.afterElementId ||
            '';

          const destination =
            section.elements.find(
              (element) =>
                element.id ===
                destinationId,
            );

          if (
            !destination ||
            destination.id === source.id ||
            destination.symbolId
          ) {
            return true;
          }
        }

        if (
          operation.action ===
          'assign_element_container'
        ) {
          if (!operation.elementId) {
            return true;
          }

          const element =
            section.elements.find(
              (candidate) =>
                candidate.id ===
                operation.elementId,
            );

          if (!element || element.symbolId) {
            return true;
          }

          if (
            operation.containerId &&
            !(section.containers || []).some(
              (container) =>
                container.id ===
                operation.containerId,
            )
          ) {
            return true;
          }
        }

        if (
          operation.action ===
          'detach_symbol'
        ) {
          if (!operation.elementId) {
            return true;
          }

          const element =
            section.elements.find(
              (candidate) =>
                candidate.id ===
                operation.elementId,
            );

          if (!element?.symbolId) {
            return true;
          }
        }

        let detachElementIds:
          | string[]
          | undefined;

        if (
          operation.action === 'remove_container'
        ) {
          if (
            !operation.containerId ||
            !(section.containers || []).some(
              (container) =>
                container.id ===
                operation.containerId,
            )
          ) {
            return true;
          }

          detachElementIds =
            section.elements
              .filter(
                (element) =>
                  element.containerId ===
                  operation.containerId,
              )
              .map(
                (element) =>
                  element.id,
              );
        }

        if (
          operation.action ===
            'remove_form_field' ||
          operation.action ===
            'move_form_field'
        ) {
          if (
            section.type !== 'contact' ||
            !Array.isArray(
              section.formFields,
            )
          ) {
            return false;
          }

          const fields =
            section.formFields;

          if (
            !operation.formFieldId ||
            !fields.some(
              (field) =>
                field.id ===
                operation.formFieldId,
            )
          ) {
            return true;
          }

          if (
            operation.action ===
              'remove_form_field' &&
            fields.length <= 1
          ) {
            return true;
          }

          if (
            operation.action ===
            'move_form_field'
          ) {
            if (
              (!operation.beforeFormFieldId &&
                !operation.afterFormFieldId) ||
              (operation.beforeFormFieldId &&
                operation.afterFormFieldId)
            ) {
              return true;
            }

            const destinationId =
              operation.beforeFormFieldId ||
              operation.afterFormFieldId ||
              '';

            if (
              destinationId ===
                operation.formFieldId ||
              !fields.some(
                (field) =>
                  field.id ===
                  destinationId,
              )
            ) {
              return true;
            }
          }
        }

        const nativeOperations =
          convertLegacyAIStructuralOperationToNative(
            operation,
            {
              pageId: page.id,
              sectionId: section.id,
              detachElementIds,
            },
          );

        if (nativeOperations.length) {
          applyAIWorkingNativeOperations(
            nativeOperations,
            operation.action,
          );
        }

        return true;
      };

      const applyAISectionScopedUpdateNativeOperation = (
        operation: AIWebsitePatchOperation,
        pageIndex: number,
        sectionIndex: number,
      ) => {
        if (!isLegacyAIUpdateNativeAction(operation.action)) {
          return false;
        }

        const page = nextPages[pageIndex];
        const section = page?.sections[sectionIndex];
        if (!page || !section) {
          return true;
        }

        if (operation.action === 'update_form') {
          if (section.type !== 'contact') {
            return true;
          }

          const nativeOperation =
            convertLegacyAIUpdateOperationToNative(
              operation,
              {
                pageId: page.id,
                sectionId: section.id,
              },
            );

          if (!nativeOperation) {
            applied += 1;
            return true;
          }

          const status =
            applyAIWorkingNativeOperation(
              nativeOperation,
              operation.action,
            );

          if (status === 'unchanged') {
            applied += 1;
          }

          return true;
        }

        if (operation.action === 'update_container') {
          if (
            !operation.containerId ||
            !(section.containers || []).some(
              (container) =>
                container.id === operation.containerId,
            )
          ) {
            return true;
          }

          const nativeOperation =
            convertLegacyAIUpdateOperationToNative(
              operation,
              {
                pageId: page.id,
                sectionId: section.id,
                sectionColumns:
                  sectionColumnCount(section.layout),
                sectionIsStack:
                  section.layout === 'stack',
              },
            );

          if (!nativeOperation) {
            applied += 1;
            return true;
          }

          const status =
            applyAIWorkingNativeOperation(
              nativeOperation,
              operation.action,
            );

          if (status === 'unchanged') {
            applied += 1;
          }

          return true;
        }

        if (
          section.type !== 'contact' ||
          !Array.isArray(section.formFields)
        ) {
          return false;
        }

        if (!operation.formFieldId) {
          return true;
        }

        const currentFormField =
          section.formFields.find(
            (field) =>
              field.id === operation.formFieldId,
          );

        if (!currentFormField) {
          return true;
        }

        const nativeOperation =
          convertLegacyAIUpdateOperationToNative(
            operation,
            {
              pageId: page.id,
              sectionId: section.id,
              currentFormField:
                currentFormField as unknown as Record<string, unknown>,
            },
          );

        if (!nativeOperation) {
          return true;
        }

        const status =
          applyAIWorkingNativeOperation(
            nativeOperation,
            operation.action,
          );

        if (status === 'unchanged') {
          applied += 1;
        }

        return true;
      };

      const applyAISectionScopedAddNativeOperation = (
        operation: AIWebsitePatchOperation,
        pageIndex: number,
        sectionIndex: number,
      ) => {
        if (
          operation.action !== 'add_container' &&
          operation.action !== 'add_form_field'
        ) {
          return false;
        }

        const page = nextPages[pageIndex];
        const section = page?.sections[sectionIndex];
        if (!page || !section) {
          return true;
        }

        if (operation.action === 'add_container') {
          const containers =
            section.containers || [];

          if (containers.length >= 30) {
            return true;
          }

          const assignElement =
            operation.elementId
              ? section.elements.find(
                  (element) =>
                    element.id ===
                    operation.elementId,
                )
              : undefined;

          const assignElementId =
            assignElement &&
            !assignElement.symbolId
              ? assignElement.id
              : undefined;

          const nativeOperations =
            convertLegacyAIAddOperationToNative(
              operation,
              {
                pageId: page.id,
                sectionId: section.id,
                generatedId:
                  `container-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sectionColumns:
                  sectionColumnCount(section.layout),
                sectionIsStack:
                  section.layout === 'stack',
                existingContainerCount:
                  containers.length,
                assignElementId,
              },
            );

          if (nativeOperations.length) {
            applyAIWorkingNativeOperations(
              nativeOperations,
              operation.action,
            );
          }

          return true;
        }

        if (
          section.type !== 'contact' ||
          !Array.isArray(section.formFields)
        ) {
          return false;
        }

        if (
          !operation.formFieldType ||
          !allowedFormFieldTypes.has(
            operation.formFieldType,
          )
        ) {
          return true;
        }

        const fields =
          section.formFields;

        if (fields.length >= 20) {
          return true;
        }

        const nativeOperations =
          convertLegacyAIAddOperationToNative(
            operation,
            {
              pageId: page.id,
              sectionId: section.id,
              generatedId:
                `field-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              existingFormFieldNames:
                fields.map(
                  (field) =>
                    field.name,
                ),
              existingFormFieldIds:
                fields.map(
                  (field) =>
                    field.id,
                ),
            },
          );

        if (nativeOperations.length) {
          applyAIWorkingNativeOperations(
            nativeOperations,
            operation.action,
          );
        }

        return true;
      };

      for (const [operationIndex, operation] of operations.entries()) {
        if (!selectedOperationSet.has(`operation-${operationIndex + 1}`)) continue;
        if (!operation || typeof operation.action !== 'string') continue;
        const appliedBeforeOperation = applied;
        try {

        if (
          applyAIGlobalNativeOperation(
            operation,
          ) ||
          applyAIPageNativeOperation(
            operation,
          )
        ) {
          continue;
        }

        if (operation.action === 'add_page') {
          const sourcePage = operation.page;
          if (!sourcePage || nextPages.length >= billingEntitlements.maxPages) continue;
          const sourceSections = Array.isArray(sourcePage.sections) ? sourcePage.sections : [];
          const normalizedSections = sourceSections
            .filter((section) => section && allowedTypes.has(section.type))
            .slice(0, 8)
            .map((section, sectionIndex) => normalizeSection({
              ...section,
              id: `${section.type}-ai-page-${Date.now()}-${sectionIndex}-${Math.random().toString(36).slice(2, 7)}`,
              type: section.type,
              title: section.title?.trim() || SECTION_LABELS[section.type],
              description: section.description?.trim() || '',
              buttonText: section.type === 'footer' ? '' : (section.buttonText?.trim() || 'Learn More'),
              buttonUrl: section.type === 'footer' ? '' : (section.buttonUrl?.trim() || '#contact'),
              background: validHex(section.background) ? section.background! : nextTheme.backgroundColor || '#0f172a',
              accent: validHex(section.accent) ? section.accent! : nextTheme.primaryColor || '#7c3aed',
              image: section.image?.trim() || undefined,
              imagePrompt: section.imagePrompt?.trim() || undefined,
            }));
          if (!normalizedSections.length) continue;
          const pageName = sourcePage.name?.trim().slice(0, 60) || `Page ${nextPages.length + 1}`;
          const requestedSlug = normalizeSlugValue(sourcePage.slug || pageName) || `page-${nextPages.length + 1}`;
          const createdPage: WebsitePage = {
            id: `page-ai-edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: pageName,
            slug: requestedSlug,
            sections: normalizedSections,
            showInNavigation: sourcePage.showInNavigation !== false,
            language: prefs.language,
            translationKey: '',
            seoTitle: '',
            seoDescription: '',
            canonicalUrl: '',
            noIndex: false,
          };

          applyAIWorkingNativeOperation(
            {
              action: 'add_page',
              source: 'ai',
              page:
                createdPage as unknown as EditorPageLike,
            },
            operation.action,
          );
          continue;
        }

        if (operation.action === 'update_site') {
          const changes = operation.changes || {};
          if (typeof changes.name === 'string' && changes.name.trim()) {
            nextSiteName = changes.name.trim().slice(0, 100);
            applied += 1;
          }
          continue;
        }

        if (operation.action === 'repair_responsive') {
          let repaired = 0;
          const targetPageId = operation.pageId?.trim();
          const targetPageSlug = operation.pageSlug ? normalizeSlugValue(operation.pageSlug) : '';
          nextPages = nextPages.map((candidatePage) => {
            const pageMatches = !targetPageId && !targetPageSlug
              ? true
              : targetPageId
                ? candidatePage.id === targetPageId
                : normalizeSlugValue(candidatePage.slug) === targetPageSlug;
            if (!pageMatches) return candidatePage;

            return {
              ...candidatePage,
              sections: candidatePage.sections.map((candidateSection) => {
                let sectionChanged = false;
                const sectionResponsive = { ...(candidateSection.responsive || {}) };
                const mobileSection = { ...(sectionResponsive.mobile || {}) };
                const tabletSection = { ...(sectionResponsive.tablet || {}) };

                const basePaddingX = Number(candidateSection.sectionPaddingX);
                if (Number.isFinite(basePaddingX) && basePaddingX > 28 && mobileSection.sectionPaddingX === undefined) {
                  mobileSection.sectionPaddingX = 20;
                  sectionChanged = true;
                }
                if (Number.isFinite(basePaddingX) && basePaddingX > 48 && tabletSection.sectionPaddingX === undefined) {
                  tabletSection.sectionPaddingX = 32;
                  sectionChanged = true;
                }

                const basePaddingY = Number(candidateSection.sectionPaddingY);
                if (Number.isFinite(basePaddingY) && basePaddingY > 96 && mobileSection.sectionPaddingY === undefined) {
                  mobileSection.sectionPaddingY = 64;
                  sectionChanged = true;
                }
                if (Number.isFinite(basePaddingY) && basePaddingY > 120 && tabletSection.sectionPaddingY === undefined) {
                  tabletSection.sectionPaddingY = 84;
                  sectionChanged = true;
                }

                const baseGap = Number(candidateSection.layoutGap);
                if (Number.isFinite(baseGap) && baseGap > 36 && mobileSection.layoutGap === undefined) {
                  mobileSection.layoutGap = 24;
                  sectionChanged = true;
                }
                if (Number.isFinite(baseGap) && baseGap > 52 && tabletSection.layoutGap === undefined) {
                  tabletSection.layoutGap = 36;
                  sectionChanged = true;
                }

                const elements = candidateSection.elements.map((element) => {
                  let elementChanged = false;
                  const responsive = { ...(element.responsive || {}) };
                  const mobile = { ...(responsive.mobile || {}) };
                  const tablet = { ...(responsive.tablet || {}) };
                  const baseStyle = element.style || {};

                  const fontSize = Number(baseStyle.fontSize);
                  if (Number.isFinite(fontSize) && fontSize > 52 && mobile.fontSize === undefined) {
                    mobile.fontSize = Math.max(28, Math.min(48, Math.round(fontSize * 0.72)));
                    elementChanged = true;
                  }
                  if (Number.isFinite(fontSize) && fontSize > 76 && tablet.fontSize === undefined) {
                    tablet.fontSize = Math.max(36, Math.min(68, Math.round(fontSize * 0.84)));
                    elementChanged = true;
                  }

                  const padding = Number(baseStyle.padding);
                  if (Number.isFinite(padding) && padding > 32 && mobile.padding === undefined) {
                    mobile.padding = 20;
                    elementChanged = true;
                  }
                  if (Number.isFinite(padding) && padding > 48 && tablet.padding === undefined) {
                    tablet.padding = 32;
                    elementChanged = true;
                  }

                  for (const side of ['marginLeft', 'marginRight'] as const) {
                    const margin = Number(baseStyle[side]);
                    if (Number.isFinite(margin) && Math.abs(margin) > 32 && mobile[side] === undefined) {
                      mobile[side] = 0;
                      elementChanged = true;
                    }
                    if (Number.isFinite(margin) && Math.abs(margin) > 64 && tablet[side] === undefined) {
                      tablet[side] = 0;
                      elementChanged = true;
                    }
                  }

                  const positionX = Number(baseStyle.positionX || 0);
                  const positionY = Number(baseStyle.positionY || 0);
                  if (Math.abs(positionX) > 24 && mobile.positionX === undefined) {
                    mobile.positionX = 0;
                    elementChanged = true;
                  }
                  if (Math.abs(positionY) > 24 && mobile.positionY === undefined) {
                    mobile.positionY = 0;
                    elementChanged = true;
                  }
                  if (Math.abs(positionX) > 80 && tablet.positionX === undefined) {
                    tablet.positionX = 0;
                    elementChanged = true;
                  }
                  if (Math.abs(positionY) > 80 && tablet.positionY === undefined) {
                    tablet.positionY = 0;
                    elementChanged = true;
                  }

                  const maxWidth = Number(baseStyle.maxWidth);
                  if (Number.isFinite(maxWidth) && maxWidth > 520 && mobile.maxWidth === undefined) {
                    mobile.maxWidth = 420;
                    mobile.width = mobile.width ?? 100;
                    elementChanged = true;
                  }
                  if (Number.isFinite(maxWidth) && maxWidth > 900 && tablet.maxWidth === undefined) {
                    tablet.maxWidth = 760;
                    elementChanged = true;
                  }

                  if (!elementChanged) return element;
                  repaired += 1;
                  return {
                    ...element,
                    responsive: {
                      ...responsive,
                      mobile,
                      tablet,
                    },
                  };
                });

                if (sectionChanged) {
                  repaired += 1;
                  sectionResponsive.mobile = mobileSection;
                  sectionResponsive.tablet = tabletSection;
                }

                return sectionChanged
                  ? { ...candidateSection, responsive: sectionResponsive, elements }
                  : elements === candidateSection.elements
                    ? candidateSection
                    : { ...candidateSection, elements };
              }),
            };
          });
          if (repaired > 0) applied += 1;
          continue;
        }

        if (operation.action === 'repair_accessibility') {
          let repaired = 0;
          nextPages = nextPages.map((candidatePage) => ({
            ...candidatePage,
            sections: candidatePage.sections.map((candidateSection) => {
              const elements = candidateSection.elements.map((element) => {
                if (element.type === 'image' && element.src?.trim() && !element.content.trim()) {
                  repaired += 1;
                  return { ...element, content: `${candidateSection.title || candidatePage.name} image`.slice(0, 180) };
                }
                if (element.type === 'button' && !element.content.trim()) {
                  repaired += 1;
                  return { ...element, content: 'Learn more' };
                }
                return element;
              });
              if (candidateSection.type !== 'contact') return { ...candidateSection, elements };
              const fields = (candidateSection.formFields || createDefaultContactFormFields()).map((field) => {
                if (field.label.trim()) return field;
                repaired += 1;
                const fallback = field.name.replace(/[_-]+/g, ' ').trim() || 'Field';
                return { ...field, label: fallback.charAt(0).toUpperCase() + fallback.slice(1) };
              });
              return { ...candidateSection, elements, formFields: fields };
            }),
          }));
          if (repaired > 0) applied += 1;
          continue;
        }

        if (operation.action === 'restyle_site') {
          const changes = operation.changes || {};
          const backgroundColor = validHex(changes.backgroundColor)
            ? changes.backgroundColor!
            : validHex(changes.primaryColor)
              ? changes.primaryColor!
              : undefined;
          const accentColor = validHex(changes.accentColor) ? changes.accentColor! : undefined;

          if (!backgroundColor && !accentColor) continue;

          nextPages = nextPages.map((page) => ({
            ...page,
            sections: page.sections.map((section) => {
              const restyled = {
                ...section,
                background: backgroundColor || section.background,
                accent: accentColor || section.accent,
              };
              return {
                ...restyled,
                elements: section.elements.map((element) => element.type === 'button' && accentColor
                  ? { ...element, style: { ...element.style, backgroundColor: accentColor } }
                  : element
                ),
              };
            }),
          }));

          nextTheme = {
            ...nextTheme,
            backgroundColor: backgroundColor || nextTheme.backgroundColor,
            secondaryColor: backgroundColor || nextTheme.secondaryColor,
            primaryColor: accentColor || nextTheme.primaryColor,
          };
          applied += 1;
          continue;
        }

        const pageIndex = resolvePageIndex(operation);
        if (pageIndex < 0 || pageIndex >= nextPages.length) continue;
        const page = nextPages[pageIndex];

        if (
          applyAIPageScopedStructuralNativeOperation(
            operation,
            pageIndex,
          )
        ) {
          continue;
        }

        if (operation.action === 'update_page') {
          const nativeOperation =
            convertLegacyAIPageUpdateOperationToNative(
              operation,
              page.id,
            );

          if (!nativeOperation) {
            applied += 1;
            continue;
          }

          const status =
            applyAIWorkingNativeOperation(
              nativeOperation,
              operation.action,
            );

          if (status === 'unchanged') {
            applied += 1;
          }

          continue;
        }

        if (operation.action === 'add_section') {
          const source = operation.section;
          if (!source || !allowedTypes.has(source.type) || page.sections.length >= 20) continue;
          const created = normalizeSection({
            ...source,
            id: `${source.type}-ai-edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: source.type,
            title: source.title?.trim() || SECTION_LABELS[source.type],
            description: source.description?.trim() || '',
            buttonText: source.type === 'footer' ? '' : (source.buttonText?.trim() || 'Learn More'),
            buttonUrl: source.type === 'footer' ? '' : (source.buttonUrl?.trim() || '#contact'),
            background: validHex(source.background) ? source.background! : page.sections[0]?.background || '#0f172a',
            accent: validHex(source.accent) ? source.accent! : page.sections[0]?.accent || '#7c3aed',
            image: source.image?.trim() || undefined,
            imagePrompt: source.imagePrompt?.trim() || undefined,
          });
          const requestedAfter =
            operation.afterSectionId &&
            page.sections.some(
              (section) =>
                section.id === operation.afterSectionId,
            )
              ? operation.afterSectionId
              : '';
          const footer =
            page.sections.find(
              (section) =>
                section.type === 'footer',
            );
          const position = requestedAfter
            ? { afterId: requestedAfter }
            : footer
              ? { beforeId: footer.id }
              : {};

          applyAIWorkingNativeOperation(
            {
              action: 'add_section',
              source: 'ai',
              pageId: page.id,
              section:
                created as unknown as EditorPageLike['sections'][number],
              position,
            },
            operation.action,
          );
          continue;
        }

        const sectionIndex = resolveSectionIndex(page, operation);
        if (sectionIndex < 0 || sectionIndex >= page.sections.length) continue;

        if (
          applyAISectionScopedStructuralNativeOperation(
            operation,
            pageIndex,
            sectionIndex,
          )
        ) {
          continue;
        }

        if (
          applyAISectionScopedUpdateNativeOperation(
            operation,
            pageIndex,
            sectionIndex,
          )
        ) {
          continue;
        }

        if (
          applyAISectionScopedAddNativeOperation(
            operation,
            pageIndex,
            sectionIndex,
          )
        ) {
          continue;
        }

        if (operation.action === 'add_element') {
          if (!operation.elementType || !allowedElementTypes.has(operation.elementType)) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.elements.length >= 60) continue;

          const changes = operation.changes || {};
          const created = createElement(operation.elementType, targetSection.accent);
          const createdStyle: WebsiteElement['style'] = { ...created.style };
          const setCreatedNumber = (key: keyof WebsiteElement['style'], value: unknown, min: number, max: number) => {
            const nextValue = finiteStyleNumber(value, min, max);
            if (nextValue !== undefined) {
              (createdStyle as Record<string, unknown>)[key] = nextValue;
            }
          };

          if (validHex(changes.color)) createdStyle.color = changes.color;
          if (validHex(changes.elementBackgroundColor)) createdStyle.backgroundColor = changes.elementBackgroundColor;
          if (validHex(changes.elementBorderColor)) createdStyle.borderColor = changes.elementBorderColor;
          if (validHex(changes.elementHoverBackgroundColor)) createdStyle.hoverBackgroundColor = changes.elementHoverBackgroundColor;
          if (validHex(changes.elementHoverColor)) createdStyle.hoverColor = changes.elementHoverColor;
          if (changes.elementBorderStyle === 'solid' || changes.elementBorderStyle === 'dashed' || changes.elementBorderStyle === 'dotted') createdStyle.borderStyle = changes.elementBorderStyle;
          if (changes.elementShadow && allowedShadows.has(changes.elementShadow)) createdStyle.shadow = changes.elementShadow;
          if (changes.elementHoverShadow && allowedShadows.has(changes.elementHoverShadow)) createdStyle.hoverShadow = changes.elementHoverShadow;
          if (changes.elementAnimation && allowedAnimations.has(changes.elementAnimation)) createdStyle.animation = changes.elementAnimation;
          if (changes.elementAnimationEasing && allowedAnimationEasings.has(changes.elementAnimationEasing)) createdStyle.animationEasing = changes.elementAnimationEasing;
          if (changes.textAlign === 'left' || changes.textAlign === 'center' || changes.textAlign === 'right') createdStyle.textAlign = changes.textAlign;
          if (changes.alignSelf === 'auto' || changes.alignSelf === 'start' || changes.alignSelf === 'center' || changes.alignSelf === 'end' || changes.alignSelf === 'stretch') createdStyle.alignSelf = changes.alignSelf;
          if (typeof changes.hidden === 'boolean') createdStyle.hidden = changes.hidden;
          setCreatedNumber('fontSize', changes.fontSize, 8, 240);
          setCreatedNumber('fontWeight', changes.fontWeight, 100, 1000);
          setCreatedNumber('padding', changes.padding, 0, 160);
          setCreatedNumber('borderRadius', changes.borderRadius, 0, 160);
          setCreatedNumber('width', changes.width, 1, 100);
          setCreatedNumber('maxWidth', changes.maxWidth, 0, 2000);
          setCreatedNumber('marginTop', changes.marginTop, -200, 400);
          setCreatedNumber('marginRight', changes.marginRight, -200, 400);
          setCreatedNumber('marginBottom', changes.marginBottom, -200, 400);
          setCreatedNumber('marginLeft', changes.marginLeft, -200, 400);
          setCreatedNumber('positionX', changes.positionX, -4000, 4000);
          setCreatedNumber('positionY', changes.positionY, -4000, 4000);
          setCreatedNumber('lineHeight', changes.lineHeight, 0.7, 4);
          setCreatedNumber('letterSpacing', changes.letterSpacing, -10, 30);
          setCreatedNumber('opacity', changes.opacity, 0, 1);
          setCreatedNumber('rotate', changes.rotate, -180, 180);
          setCreatedNumber('borderWidth', changes.elementBorderWidth, 0, 24);
          setCreatedNumber('hoverScale', changes.elementHoverScale, 0.5, 1.6);
          setCreatedNumber('hoverOpacity', changes.elementHoverOpacity, 0, 1);
          setCreatedNumber('animationDuration', changes.elementAnimationDuration, 100, 4000);
          setCreatedNumber('animationDelay', changes.elementAnimationDelay, 0, 5000);
          setCreatedNumber('animationDistance', changes.elementAnimationDistance, 0, 300);
          setCreatedNumber('animationIterations', changes.elementAnimationIterations, 1, 20);
          setCreatedNumber('parallaxSpeed', changes.elementParallaxSpeed, -1, 1);

          const newElement: WebsiteElement = {
            ...created,
            content: typeof changes.elementContent === 'string' ? changes.elementContent.slice(0, 5000) : created.content,
            href: typeof changes.elementHref === 'string' ? changes.elementHref.trim().slice(0, 2000) : created.href,
            src: typeof changes.elementSrc === 'string' ? changes.elementSrc.trim().slice(0, 2000) : created.src,
            style: createdStyle,
            animationOnce: typeof changes.elementAnimationOnce === 'boolean' ? changes.elementAnimationOnce : created.animationOnce,
            animationTrigger: changes.elementAnimationTrigger && allowedAnimationTriggers.has(changes.elementAnimationTrigger) ? changes.elementAnimationTrigger : created.animationTrigger,
          };

          const beforeId =
            operation.beforeElementId &&
            targetSection.elements.some(
              (element) => element.id === operation.beforeElementId,
            )
              ? operation.beforeElementId
              : '';
          const afterId =
            !beforeId &&
            operation.afterElementId &&
            targetSection.elements.some(
              (element) => element.id === operation.afterElementId,
            )
              ? operation.afterElementId
              : '';

          applyAIWorkingNativeOperation(
            {
              action: 'add_element',
              source: 'ai',
              pageId: page.id,
              sectionId: targetSection.id,
              element:
                newElement as unknown as EditorPageLike['sections'][number]['elements'][number],
              ...(beforeId
                ? { position: { beforeId } }
                : afterId
                  ? { position: { afterId } }
                  : {}),
            },
            operation.action,
          );
          continue;
        }

        if (operation.action === 'update_element') {
          if (!operation.elementId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const elementIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (elementIndex < 0) continue;

          const changes = operation.changes || {};
          const targetElement = targetSection.elements[elementIndex];
          const styleChanges: WebsiteElement['style'] = {};
          const setNumeric = (key: keyof WebsiteElement['style'], value: unknown, min: number, max: number) => {
            const nextValue = finiteStyleNumber(value, min, max);
            if (nextValue !== undefined) {
              (styleChanges as Record<string, unknown>)[key] = nextValue;
            }
          };

          if (validHex(changes.color)) styleChanges.color = changes.color;
          if (validHex(changes.elementBackgroundColor)) styleChanges.backgroundColor = changes.elementBackgroundColor;
          if (validHex(changes.elementBorderColor)) styleChanges.borderColor = changes.elementBorderColor;
          if (validHex(changes.elementHoverBackgroundColor)) styleChanges.hoverBackgroundColor = changes.elementHoverBackgroundColor;
          if (validHex(changes.elementHoverColor)) styleChanges.hoverColor = changes.elementHoverColor;
          if (changes.elementBorderStyle === 'solid' || changes.elementBorderStyle === 'dashed' || changes.elementBorderStyle === 'dotted') styleChanges.borderStyle = changes.elementBorderStyle;
          if (changes.elementShadow && allowedShadows.has(changes.elementShadow)) styleChanges.shadow = changes.elementShadow;
          if (changes.elementHoverShadow && allowedShadows.has(changes.elementHoverShadow)) styleChanges.hoverShadow = changes.elementHoverShadow;
          if (changes.elementAnimation && allowedAnimations.has(changes.elementAnimation)) styleChanges.animation = changes.elementAnimation;
          if (changes.elementAnimationEasing && allowedAnimationEasings.has(changes.elementAnimationEasing)) styleChanges.animationEasing = changes.elementAnimationEasing;
          if (changes.textAlign === 'left' || changes.textAlign === 'center' || changes.textAlign === 'right') styleChanges.textAlign = changes.textAlign;
          if (changes.alignSelf === 'auto' || changes.alignSelf === 'start' || changes.alignSelf === 'center' || changes.alignSelf === 'end' || changes.alignSelf === 'stretch') styleChanges.alignSelf = changes.alignSelf;
          if (typeof changes.hidden === 'boolean') styleChanges.hidden = changes.hidden;
          setNumeric('fontSize', changes.fontSize, 8, 240);
          setNumeric('fontWeight', changes.fontWeight, 100, 1000);
          setNumeric('padding', changes.padding, 0, 160);
          setNumeric('borderRadius', changes.borderRadius, 0, 160);
          setNumeric('width', changes.width, 1, 100);
          setNumeric('maxWidth', changes.maxWidth, 0, 2000);
          setNumeric('columnSpan', changes.elementColumnSpan, 1, sectionColumnCount(targetSection.layout));
          setNumeric('marginTop', changes.marginTop, -200, 400);
          setNumeric('marginRight', changes.marginRight, -200, 400);
          setNumeric('marginBottom', changes.marginBottom, -200, 400);
          setNumeric('marginLeft', changes.marginLeft, -200, 400);
          setNumeric('positionX', changes.positionX, -4000, 4000);
          setNumeric('positionY', changes.positionY, -4000, 4000);
          setNumeric('lineHeight', changes.lineHeight, 0.7, 4);
          setNumeric('letterSpacing', changes.letterSpacing, -10, 30);
          setNumeric('opacity', changes.opacity, 0, 1);
          setNumeric('rotate', changes.rotate, -180, 180);
          setNumeric('borderWidth', changes.elementBorderWidth, 0, 24);
          setNumeric('hoverScale', changes.elementHoverScale, 0.5, 1.6);
          setNumeric('hoverOpacity', changes.elementHoverOpacity, 0, 1);
          setNumeric('animationDuration', changes.elementAnimationDuration, 100, 4000);
          setNumeric('animationDelay', changes.elementAnimationDelay, 0, 5000);
          setNumeric('animationDistance', changes.elementAnimationDistance, 0, 300);
          setNumeric('animationIterations', changes.elementAnimationIterations, 1, 20);
          setNumeric('parallaxSpeed', changes.elementParallaxSpeed, -1, 1);

          const hasContentChange = typeof changes.elementContent === 'string' || typeof changes.elementHref === 'string' || typeof changes.elementSrc === 'string';
          const hasElementMetaChange = typeof changes.elementAnimationOnce === 'boolean'
            || (typeof changes.elementAnimationTrigger === 'string' && allowedAnimationTriggers.has(changes.elementAnimationTrigger));
          if (!hasContentChange && !hasElementMetaChange && Object.keys(styleChanges).length === 0) continue;

          const responsiveDevice = operation.device === 'mobile' || operation.device === 'tablet' ? operation.device : null;
          const sectionColumns = sectionColumnCount(targetSection.layout);
          const requestedColumn = finiteStyleNumber(changes.elementColumn, 1, sectionColumns);
          const baseElement: WebsiteElement = {
            ...targetElement,
            content: typeof changes.elementContent === 'string' ? changes.elementContent.slice(0, 5000) : targetElement.content,
            href: typeof changes.elementHref === 'string' ? changes.elementHref.trim().slice(0, 2000) : targetElement.href,
            src: typeof changes.elementSrc === 'string' ? changes.elementSrc.trim().slice(0, 2000) : targetElement.src,
            layoutColumn: responsiveDevice
              ? targetElement.layoutColumn
              : requestedColumn !== undefined
                ? Math.round(requestedColumn)
                : targetElement.layoutColumn,
            animationOnce: typeof changes.elementAnimationOnce === 'boolean' ? changes.elementAnimationOnce : targetElement.animationOnce,
            animationTrigger: changes.elementAnimationTrigger && allowedAnimationTriggers.has(changes.elementAnimationTrigger) ? changes.elementAnimationTrigger : targetElement.animationTrigger,
          };
          const updatedElement: WebsiteElement = responsiveDevice
            ? {
                ...baseElement,
                responsive: {
                  ...(targetElement.responsive || {}),
                  [responsiveDevice]: {
                    ...(targetElement.responsive?.[responsiveDevice] || {}),
                    ...styleChanges,
                  },
                },
              }
            : {
                ...baseElement,
                style: { ...targetElement.style, ...styleChanges },
              };

          if (targetElement.symbolId) {
            const linkedSymbolId = targetElement.symbolId;
            const syncInstance = (instance: WebsiteElement): WebsiteElement => ({
              ...updatedElement,
              id: instance.id,
              containerId: instance.containerId,
              layoutColumn: instance.layoutColumn,
              symbolId: linkedSymbolId,
            });
            nextPages = nextPages.map((candidatePage) => ({
              ...candidatePage,
              sections: candidatePage.sections.map((candidateSection) => ({
                ...candidateSection,
                elements: candidateSection.elements.map((instance) =>
                  instance.symbolId === linkedSymbolId ? syncInstance(instance) : instance
                ),
              })),
            }));
            nextSymbols = nextSymbols.map((symbol) => symbol.id === linkedSymbolId
              ? { ...symbol, element: cloneSymbolElement(updatedElement), updatedAt: new Date().toISOString() }
              : symbol
            );
          } else {
            const nextElements = [...targetSection.elements];
            nextElements[elementIndex] = updatedElement;
            sectionList[sectionIndex] = { ...targetSection, elements: nextElements };
            nextPages[pageIndex] = { ...page, sections: sectionList };
          }
          applied += 1;
          continue;
        }

        if (operation.action === 'add_form_field') {
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.type !== 'contact' || !operation.formFieldType || !allowedFormFieldTypes.has(operation.formFieldType)) continue;
          const fields = [...(targetSection.formFields || createDefaultContactFormFields())];
          if (fields.length >= 20) continue;

          const changes = operation.changes || {};
          const baseName = typeof changes.formFieldName === 'string' && changes.formFieldName.trim()
            ? normalizeFormFieldName(changes.formFieldName, 'field')
            : operation.formFieldType === 'email'
              ? 'email'
              : operation.formFieldType === 'tel'
                ? 'phone'
                : operation.formFieldType === 'textarea'
                  ? 'message'
                  : operation.formFieldType === 'checkbox'
                    ? 'consent'
                    : operation.formFieldType === 'select'
                      ? 'option'
                      : 'field';
          let uniqueName = baseName;
          let suffix = 2;
          while (fields.some((field) => field.name === uniqueName)) {
            uniqueName = `${baseName}_${suffix}`;
            suffix += 1;
          }

          const newField: WebsiteFormField = {
            id: `field-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: uniqueName,
            label: typeof changes.formFieldLabel === 'string' && changes.formFieldLabel.trim()
              ? changes.formFieldLabel.trim().slice(0, 120)
              : operation.formFieldType === 'textarea'
                ? 'Message'
                : operation.formFieldType === 'checkbox'
                  ? 'I agree'
                  : operation.formFieldType === 'select'
                    ? 'Choose an option'
                    : operation.formFieldType === 'tel'
                      ? 'Phone'
                      : operation.formFieldType === 'email'
                        ? 'Email'
                        : 'New field',
            type: operation.formFieldType,
            placeholder: operation.formFieldType === 'checkbox'
              ? ''
              : typeof changes.formFieldPlaceholder === 'string'
                ? changes.formFieldPlaceholder.slice(0, 160)
                : '',
            required: changes.formFieldRequired === true,
            options: operation.formFieldType === 'select'
              ? (Array.isArray(changes.formFieldOptions)
                  ? changes.formFieldOptions.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
                  : ['Option 1', 'Option 2'])
              : undefined,
          };

          const beforeIndex = operation.beforeFormFieldId ? fields.findIndex((field) => field.id === operation.beforeFormFieldId) : -1;
          const afterIndex = operation.afterFormFieldId ? fields.findIndex((field) => field.id === operation.afterFormFieldId) : -1;
          const insertAt = beforeIndex >= 0 ? beforeIndex : afterIndex >= 0 ? afterIndex + 1 : fields.length;
          fields.splice(Math.min(Math.max(insertAt, 0), fields.length), 0, newField);

          sectionList[sectionIndex] = { ...targetSection, formFields: fields };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'update_form_field') {
          if (!operation.formFieldId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.type !== 'contact') continue;
          const fields = [...(targetSection.formFields || createDefaultContactFormFields())];
          const fieldIndex = fields.findIndex((field) => field.id === operation.formFieldId);
          if (fieldIndex < 0) continue;

          const changes = operation.changes || {};
          const current = fields[fieldIndex];
          const nextType = operation.formFieldType && allowedFormFieldTypes.has(operation.formFieldType)
            ? operation.formFieldType
            : current.type;
          fields[fieldIndex] = {
            ...current,
            name: typeof changes.formFieldName === 'string' && changes.formFieldName.trim()
              ? normalizeFormFieldName(changes.formFieldName, current.name || 'field')
              : current.name,
            label: typeof changes.formFieldLabel === 'string' ? changes.formFieldLabel.trim().slice(0, 120) : current.label,
            type: nextType,
            placeholder: nextType === 'checkbox'
              ? ''
              : typeof changes.formFieldPlaceholder === 'string'
                ? changes.formFieldPlaceholder.slice(0, 160)
                : current.placeholder,
            required: typeof changes.formFieldRequired === 'boolean' ? changes.formFieldRequired : current.required,
            options: nextType === 'select'
              ? (Array.isArray(changes.formFieldOptions)
                  ? changes.formFieldOptions.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
                  : current.options || ['Option 1', 'Option 2'])
              : undefined,
          };

          sectionList[sectionIndex] = { ...targetSection, formFields: fields };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'remove_form_field') {
          if (!operation.formFieldId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.type !== 'contact') continue;
          const fields = [...(targetSection.formFields || createDefaultContactFormFields())];
          if (fields.length <= 1 || !fields.some((field) => field.id === operation.formFieldId)) continue;

          sectionList[sectionIndex] = {
            ...targetSection,
            formFields: fields.filter((field) => field.id !== operation.formFieldId),
          };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'move_form_field') {
          if (!operation.formFieldId || (!operation.beforeFormFieldId && !operation.afterFormFieldId)) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.type !== 'contact') continue;
          const fields = [...(targetSection.formFields || createDefaultContactFormFields())];
          const sourceIndex = fields.findIndex((field) => field.id === operation.formFieldId);
          if (sourceIndex < 0) continue;
          const sourceField = fields[sourceIndex];
          const withoutSource = fields.filter((field) => field.id !== sourceField.id);
          const destinationId = operation.beforeFormFieldId || operation.afterFormFieldId || '';
          const destinationIndex = withoutSource.findIndex((field) => field.id === destinationId);
          if (destinationIndex < 0) continue;

          const insertAt = destinationIndex + (operation.afterFormFieldId ? 1 : 0);
          withoutSource.splice(Math.min(Math.max(insertAt, 0), withoutSource.length), 0, sourceField);
          sectionList[sectionIndex] = { ...targetSection, formFields: withoutSource };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'copy_section_style') {
          if (!operation.sourceSectionId) continue;
          const sourceSection = nextPages
            .flatMap((candidatePage) => candidatePage.sections)
            .find((candidateSection) => candidateSection.id === operation.sourceSectionId);
          if (!sourceSection) continue;

          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          sectionList[sectionIndex] = {
            ...targetSection,
            background: sourceSection.background,
            accent: sourceSection.accent,
            backgroundMode: sourceSection.backgroundMode,
            backgroundImage: sourceSection.backgroundImage,
            backgroundPosition: sourceSection.backgroundPosition,
            backgroundSize: sourceSection.backgroundSize,
            gradientFrom: sourceSection.gradientFrom,
            gradientTo: sourceSection.gradientTo,
            gradientAngle: sourceSection.gradientAngle,
            overlayColor: sourceSection.overlayColor,
            overlayOpacity: sourceSection.overlayOpacity,
            minHeight: sourceSection.minHeight,
            sectionPaddingY: sourceSection.sectionPaddingY,
            sectionPaddingX: sourceSection.sectionPaddingX,
            sectionRadius: sourceSection.sectionRadius,
            layoutGap: sourceSection.layoutGap,
            layoutAlign: sourceSection.layoutAlign,
            contentWidth: sourceSection.contentWidth,
            responsive: sourceSection.responsive
              ? JSON.parse(JSON.stringify(sourceSection.responsive)) as WebsiteSection['responsive']
              : undefined,
          };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'copy_element_style') {
          if (!operation.sourceElementId || !operation.elementId) continue;
          const sourceElement = nextPages
            .flatMap((candidatePage) => candidatePage.sections)
            .flatMap((candidateSection) => candidateSection.elements)
            .find((candidateElement) => candidateElement.id === operation.sourceElementId);
          const targetSection = page.sections[sectionIndex];
          const targetIndex = targetSection.elements.findIndex((candidateElement) => candidateElement.id === operation.elementId);
          if (!sourceElement || targetIndex < 0) continue;
          const targetElement = targetSection.elements[targetIndex];

          const copyVisualStyle = (candidateElement: WebsiteElement): WebsiteElement => {
            const copiedStyle = JSON.parse(JSON.stringify(sourceElement.style || {})) as WebsiteElement['style'];
            copiedStyle.positionX = candidateElement.style.positionX;
            copiedStyle.positionY = candidateElement.style.positionY;
            copiedStyle.columnSpan = candidateElement.style.columnSpan;

            const sourceResponsive = sourceElement.responsive
              ? JSON.parse(JSON.stringify(sourceElement.responsive)) as WebsiteElement['responsive']
              : {};
            const copiedResponsive = { ...(sourceResponsive || {}) };
            for (const responsiveDevice of ['desktop', 'tablet', 'mobile'] as Device[]) {
              const sourceDevice = copiedResponsive?.[responsiveDevice];
              if (!sourceDevice) continue;
              const candidateDevice = candidateElement.responsive?.[responsiveDevice];
              copiedResponsive[responsiveDevice] = {
                ...sourceDevice,
                positionX: candidateDevice?.positionX,
                positionY: candidateDevice?.positionY,
                columnSpan: candidateDevice?.columnSpan,
              };
            }
            return {
              ...candidateElement,
              style: copiedStyle,
              responsive: copiedResponsive,
            };
          };

          const linkedSymbolId = targetElement.symbolId;
          if (linkedSymbolId) {
            nextPages = nextPages.map((candidatePage) => ({
              ...candidatePage,
              sections: candidatePage.sections.map((candidateSection) => ({
                ...candidateSection,
                elements: candidateSection.elements.map((candidateElement) =>
                  candidateElement.symbolId === linkedSymbolId ? copyVisualStyle(candidateElement) : candidateElement
                ),
              })),
            }));
            nextSymbols = nextSymbols.map((symbol) => symbol.id === linkedSymbolId
              ? {
                  ...symbol,
                  element: cloneSymbolElement(copyVisualStyle(symbol.element)),
                  updatedAt: new Date().toISOString(),
                }
              : symbol
            );
          } else {
            const sectionList = [...page.sections];
            const elements = [...sectionList[sectionIndex].elements];
            elements[targetIndex] = copyVisualStyle(targetElement);
            sectionList[sectionIndex] = { ...sectionList[sectionIndex], elements };
            nextPages[pageIndex] = { ...page, sections: sectionList };
          }
          applied += 1;
          continue;
        }

        if (operation.action === 'generate_image') {
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const imagePrompt = operation.prompt?.trim() || targetSection.imagePrompt?.trim() || `${targetSection.title}. Professional website image for ${siteName}.`;
          try {
            const generatedImage = await requestGeneratedImage(imagePrompt, abortController.signal);
            if (!operationCanApply()) return;
            const placement = operation.placement || (targetSection.type === 'hero' ? 'section_background' : 'section_image');
            if (placement === 'section_background') {
              sectionList[sectionIndex] = {
                ...targetSection,
                image: generatedImage.url,
                imagePrompt,
                backgroundMode: 'image',
                backgroundImage: generatedImage.url,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                overlayColor: '#000000',
                overlayOpacity: targetSection.type === 'hero' ? 0.42 : 0.3,
              };
            } else {
              const existingImageIndex = targetSection.elements.findIndex((element) => element.type === 'image');
              const nextElements = [...targetSection.elements];
              if (existingImageIndex >= 0) {
                nextElements[existingImageIndex] = {
                  ...nextElements[existingImageIndex],
                  src: generatedImage.url,
                  content: targetSection.title || 'Generated image',
                };
              } else {
                nextElements.push({
                  ...createElement('image', targetSection.accent),
                  src: generatedImage.url,
                  content: targetSection.title || 'Generated image',
                });
              }
              sectionList[sectionIndex] = {
                ...targetSection,
                image: generatedImage.url,
                imagePrompt,
                elements: nextElements,
              };
            }
            nextPages[pageIndex] = { ...page, sections: sectionList };
            applied += 1;
          } catch {
            // A failed image provider should not discard other safe patch operations in the same request.
          }
          continue;
        }

        if (operation.action === 'update_section') {
          const changes = operation.changes || {};
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const responsiveDevice = operation.device === 'mobile' || operation.device === 'tablet' ? operation.device : null;
          const sectionStyleChanges: Record<string, number> = {};
          const setSectionNumber = (key: string, value: unknown, min: number, max: number) => {
            const nextValue = finiteStyleNumber(value, min, max);
            if (nextValue !== undefined) sectionStyleChanges[key] = nextValue;
          };
          setSectionNumber('minHeight', changes.sectionMinHeight, 0, 1200);
          setSectionNumber('sectionPaddingY', changes.sectionPaddingY, 0, 240);
          setSectionNumber('sectionPaddingX', changes.sectionPaddingX, 0, 160);
          setSectionNumber('layoutGap', changes.sectionLayoutGap, 0, 80);

          if (responsiveDevice) {
            if (Object.keys(sectionStyleChanges).length === 0) continue;
            sectionList[sectionIndex] = {
              ...targetSection,
              responsive: {
                ...(targetSection.responsive || {}),
                [responsiveDevice]: {
                  ...(targetSection.responsive?.[responsiveDevice] || {}),
                  ...sectionStyleChanges,
                },
              },
            };
          } else {
            const baseUpdatedSection = updateSectionContent(targetSection, changes);
            const updatedSection: WebsiteSection = {
              ...baseUpdatedSection,
              backgroundMode: changes.sectionBackgroundMode === 'gradient' || changes.sectionBackgroundMode === 'image'
                ? changes.sectionBackgroundMode
                : changes.sectionBackgroundMode === 'color'
                  ? 'color'
                  : baseUpdatedSection.backgroundMode,
              backgroundImage: typeof changes.sectionBackgroundImage === 'string'
                ? changes.sectionBackgroundImage.trim().slice(0, 2000) || undefined
                : baseUpdatedSection.backgroundImage,
              backgroundPosition: changes.sectionBackgroundPosition === 'top' || changes.sectionBackgroundPosition === 'bottom' || changes.sectionBackgroundPosition === 'left' || changes.sectionBackgroundPosition === 'right'
                ? changes.sectionBackgroundPosition
                : changes.sectionBackgroundPosition === 'center'
                  ? 'center'
                  : baseUpdatedSection.backgroundPosition,
              backgroundSize: changes.sectionBackgroundSize === 'contain' || changes.sectionBackgroundSize === 'auto'
                ? changes.sectionBackgroundSize
                : changes.sectionBackgroundSize === 'cover'
                  ? 'cover'
                  : baseUpdatedSection.backgroundSize,
              gradientFrom: validHex(changes.sectionGradientFrom) ? changes.sectionGradientFrom : baseUpdatedSection.gradientFrom,
              gradientTo: validHex(changes.sectionGradientTo) ? changes.sectionGradientTo : baseUpdatedSection.gradientTo,
              gradientAngle: finiteStyleNumber(changes.sectionGradientAngle, 0, 360) ?? baseUpdatedSection.gradientAngle,
              overlayColor: validHex(changes.sectionOverlayColor) ? changes.sectionOverlayColor : baseUpdatedSection.overlayColor,
              overlayOpacity: finiteStyleNumber(changes.sectionOverlayOpacity, 0, 1) ?? baseUpdatedSection.overlayOpacity,
              sectionRadius: finiteStyleNumber(changes.sectionRadius, 0, 80) ?? baseUpdatedSection.sectionRadius,
              anchorId: typeof changes.sectionAnchorId === 'string' && changes.sectionAnchorId.trim()
                ? normalizeAnchorId(changes.sectionAnchorId, baseUpdatedSection.type)
                : baseUpdatedSection.anchorId,
            };
            const nextLayout: SectionLayout =
              changes.sectionLayout === 'two-column' || changes.sectionLayout === 'three-column'
                ? changes.sectionLayout
                : changes.sectionLayout === 'stack'
                  ? 'stack'
                  : (updatedSection.layout || 'stack');
            const nextAlign: SectionLayoutAlign =
              changes.sectionLayoutAlign === 'start' || changes.sectionLayoutAlign === 'end' || changes.sectionLayoutAlign === 'stretch'
                ? changes.sectionLayoutAlign
                : changes.sectionLayoutAlign === 'center'
                  ? 'center'
                  : (updatedSection.layoutAlign || 'center');
            const nextContentWidth: SectionContentWidth =
              changes.sectionContentWidth === 'full' ? 'full' : changes.sectionContentWidth === 'boxed' ? 'boxed' : (updatedSection.contentWidth || 'boxed');
            const nextColumns = sectionColumnCount(nextLayout);

            sectionList[sectionIndex] = {
              ...updatedSection,
              ...sectionStyleChanges,
              layout: nextLayout,
              layoutAlign: nextAlign,
              contentWidth: nextContentWidth,
              elements: updatedSection.elements.map((element, elementIndex) => {
                const requestedColumn = Number(element.layoutColumn) || ((elementIndex % nextColumns) + 1);
                const safeColumn = nextLayout === 'stack' ? undefined : Math.min(nextColumns, Math.max(1, requestedColumn));
                const currentSpan = Number(element.style.columnSpan) || 1;
                return {
                  ...element,
                  layoutColumn: safeColumn,
                  style: {
                    ...element.style,
                    columnSpan: Math.min(nextColumns, Math.max(1, currentSpan)),
                  },
                };
              }),
            };
          }

          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
        }
        } finally {
          if (applied > appliedBeforeOperation) appliedOperationIds.add(`operation-${operationIndex + 1}`);
        }
      }

      if (applied === 0) {
        throw new Error(l('AI changes could not be matched safely to this website. Try naming the page or section more clearly.'));
      }

      setAiStage('styling');

      const activeAfterPatch = nextPages.find((page) => page.id === activePageId) || nextPages[0];
      const usedSlugs = new Set<string>();
      nextPages = nextPages.map((page, index) => {
        const baseSlug = normalizeSlugValue(page.slug || page.name) || `page-${index + 1}`;
        let slug = baseSlug;
        let suffix = 2;
        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }
        usedSlugs.add(slug);
        return { ...page, slug };
      });

      const appliedPlanCoverage = evaluateAIWebsitePlanCoverage(
        agentPlan.steps || [],
        operations.filter((_, index) => appliedOperationIds.has(`operation-${index + 1}`)),
      );
      const deterministicReview = auditAIWebsiteCandidate(nextPages, nextSeo, nextHeaderConfig);
      if (appliedPlanCoverage.percent < 100) {
        deterministicReview.findings.unshift({
          severity: 'warning',
          title: 'Approved plan is only partially covered',
          detail: `${appliedPlanCoverage.percent}% of approved steps produced safe applied operations. Review the uncovered steps before keeping the result.`,
          target: 'agent-plan',
        });
        deterministicReview.findings = deterministicReview.findings.slice(0, 6);
        deterministicReview.score = Math.min(
          deterministicReview.score,
          Math.max(0, 70 + Math.round(appliedPlanCoverage.percent * 0.2)),
        );
      }
      let agentReview: AIWebsiteAgentReview | null = {
        score: deterministicReview.score,
        summary: deterministicReview.findings.length
          ? 'Verified project checks found issues to review before keeping this result.'
          : 'Verified project checks passed for structure, links, content basics and responsive risk.',
        findings: deterministicReview.findings,
        followUpPrompt: deterministicReview.fixPrompt,
      };
      try {
        const proposedProject = {
          homePageId: nextHomePageId,
          siteName: nextSiteName,
          theme: nextTheme,
          seo: nextSeo,
          header: nextHeaderConfig,
          symbols: nextSymbols.slice(0, 50).map((symbol) => ({
            id: symbol.id,
            name: symbol.name,
            type: symbol.element.type,
            content: symbol.element.content?.slice(0, 160),
            style: symbol.element.style,
            responsive: symbol.element.responsive || {},
          })),
          pages: nextPages.slice(0, 24).map((candidatePage) => ({
            id: candidatePage.id,
            name: candidatePage.name,
            slug: candidatePage.slug,
            showInNavigation: candidatePage.showInNavigation,
            seoTitle: candidatePage.seoTitle,
            seoDescription: candidatePage.seoDescription,
            sections: candidatePage.sections.slice(0, 20).map((candidateSection) => ({
              id: candidateSection.id,
              type: candidateSection.type,
              title: candidateSection.title?.slice(0, 160),
              description: candidateSection.description?.slice(0, 260),
              background: candidateSection.background,
              accent: candidateSection.accent,
              backgroundMode: candidateSection.backgroundMode,
              layout: candidateSection.layout,
              layoutAlign: candidateSection.layoutAlign,
              contentWidth: candidateSection.contentWidth,
              responsive: candidateSection.responsive || {},
              formFields: (candidateSection.formFields || []).slice(0, 20).map((field) => ({
                id: field.id,
                name: field.name,
                label: field.label,
                type: field.type,
                required: field.required,
              })),
              elements: candidateSection.elements.slice(0, 40).map((element) => ({
                id: element.id,
                type: element.type,
                content: element.content?.slice(0, 180),
                href: element.href,
                src: element.src,
                containerId: element.containerId,
                symbolId: element.symbolId,
                style: element.style,
                responsive: element.responsive || {},
              })),
            })),
          })),
        };

        const reviewResponse = await ai.completeJSON<AIWebsiteAgentReview>(
          {
            action: 'review-edit',
            originalPrompt: prompt,
            executionPlan: agentPlan,
            planCoverage: appliedPlanCoverage,
            proposedProject,
            deterministicAudit: deterministicReview,
          },
          [],
          { temperature: 0.1, maxTokens: 3200, signal: abortController.signal },
        );

        if (!operationCanApply()) return;

        let rawReview = reviewResponse.json as AIWebsiteAgentReview | null;
        if (!rawReview && reviewResponse.content) {
          try {
            const cleanedReview = reviewResponse.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            rawReview = JSON.parse(cleanedReview) as AIWebsiteAgentReview;
          } catch {
            rawReview = null;
          }
        }

        if (rawReview) {
          const score = Number.isFinite(Number(rawReview.score))
            ? Math.max(0, Math.min(100, Math.round(Number(rawReview.score))))
            : undefined;
          const findings = Array.isArray(rawReview.findings)
            ? rawReview.findings
                .filter((finding) => finding && typeof finding === 'object')
                .map((finding): AIWebsiteAgentReviewFinding => ({
                  severity: finding.severity === 'critical' || finding.severity === 'warning' ? finding.severity : 'improvement',
                  title: String(finding.title || 'Review note').trim().slice(0, 120),
                  detail: String(finding.detail || '').trim().slice(0, 360),
                  target: typeof finding.target === 'string' ? finding.target.trim().slice(0, 160) : undefined,
                }))
                .slice(0, 6)
            : [];
          const modelFindings = findings.filter((finding) => !deterministicReview.findings.some((verified) =>
            verified.title === finding.title && verified.target === finding.target));
          agentReview = {
            score: score === undefined ? deterministicReview.score : Math.min(score, deterministicReview.score),
            summary: typeof rawReview.summary === 'string' && rawReview.summary.trim()
              ? rawReview.summary.trim().slice(0, 300)
              : agentReview.summary,
            findings: [...deterministicReview.findings, ...modelFindings].slice(0, 6),
            followUpPrompt: deterministicReview.fixPrompt ||
              (typeof rawReview.followUpPrompt === 'string' ? rawReview.followUpPrompt.trim().slice(0, 500) : undefined),
          };
        }
      } catch {
        // The deterministic candidate review remains available when the advisory model review fails.
      }

      if (!operationCanApply()) return;

      const integrityErrors = validateAIProjectIntegrity(nextPages, nextHomePageId, nextSymbols);
      if (integrityErrors.length) {
        throw new Error(`AI change blocked by project safety validation: ${integrityErrors.join(' ')}`);
      }

      const finalActive = nextPages.find((page) => page.id === activeAfterPatch?.id) || nextPages[0];
      const previousPagesById = new Map(snapshot.pages.map((page) => [page.id, page]));
      const visualGlobalsChanged =
        snapshot.siteName !== nextSiteName ||
        JSON.stringify(snapshot.theme) !== JSON.stringify(nextTheme) ||
        JSON.stringify(snapshot.headerConfig) !== JSON.stringify(nextHeaderConfig);
      const changedPageIds = nextPages
        .filter((page) => visualGlobalsChanged || JSON.stringify(previousPagesById.get(page.id)) !== JSON.stringify(page))
        .map((page) => page.id);
      const addedPageIds = nextPages
        .filter((page) => !previousPagesById.has(page.id))
        .map((page) => page.id);
      const nextPageIds = new Set(nextPages.map((page) => page.id));
      const removedPageIds = snapshot.pages
        .filter((page) => !nextPageIds.has(page.id))
        .map((page) => page.id);
      const skipped = Math.max(0, operations.length - applied);
      const resultWarnings = [
        ...patchWarnings,
        ...selectedPlanCoverage.warnings,
        ...appliedPlanCoverage.warnings,
        ...nativeBridgeWarnings,
      ].filter((warning, index, warnings) => warnings.indexOf(warning) === index).slice(0, 10);
      const candidateReview = reconcileAIWebsitePatchReviewTargets(
        {
          ...exactPatchReview,
          operations: exactPatchReview.operations.filter((operation) => appliedOperationIds.has(operation.id)),
          planCoveragePercent: appliedPlanCoverage.percent,
          uncoveredPlanStepIds: appliedPlanCoverage.uncoveredStepIds,
        },
        snapshot.pages,
        nextPages,
      );
      const candidateApproved = await requestAICandidatePreview({
        review: candidateReview,
        summary,
        viewMode: 'after',
        pages: nextPages,
        baselinePages: snapshot.pages,
        activePageId: finalActive?.id || activePageId,
        homePageId: nextHomePageId,
        siteName: nextSiteName,
        theme: nextTheme,
        seo: nextSeo,
        headerConfig: nextHeaderConfig,
        symbols: nextSymbols,
        baselineSiteName: snapshot.siteName,
        baselineTheme: snapshot.theme,
        baselineHeaderConfig: snapshot.headerConfig,
        changedPageIds,
        addedPageIds,
        removedPageIds,
        reviewedPageIds: finalActive?.id ? [finalActive.id] : [],
        reviewedOperationIds: [],
        focusedOperationId: null,
        applied,
        skipped,
        warnings: resultWarnings,
        confidence,
        agentReview,
      }, abortController.signal);
      if (!candidateApproved) {
        if (operationIsLatest() && !abortController.signal.aborted) {
          setAiStage('ready');
          setAiMessages((current) => [
            ...current,
            { id: `ai-result-discarded-${Date.now()}`, role: 'assistant' as const, content: l('AI result discarded. No changes were applied.') },
          ].slice(-20));
        }
        return;
      }
      if (!operationCanApply()) return;
      remember(sections, `AI change: ${prompt.slice(0, 60)}`);
      pushProjectCheckpoint(`Before AI change · ${prompt.slice(0, 60)}`);
      aiUndoContextRef.current = operationContext;
      setAiUndoSnapshot(snapshot);
      setPages(nextPages);
      setSections(finalActive?.sections || []);
      setActivePageId(finalActive?.id || activePageId);
      setHomePageId(nextHomePageId);
      setSiteName(nextSiteName);
      setTheme(nextTheme);
      setSeo(nextSeo);
      setHeaderConfig(nextHeaderConfig);
      setSymbols(nextSymbols);

      const handoffOperation = [...candidateReview.operations].reverse().find((operation) =>
        operation.action &&
        !['repair_accessibility', 'repair_responsive', 'update_theme', 'restyle_site', 'update_site', 'update_seo', 'update_header'].includes(operation.action)
      );
      const handoffPage = handoffOperation
        ? aiWebsitePatchReviewItemTargetPage(handoffOperation, nextPages) ?? finalActive
        : finalActive;
      const handoffSection = handoffOperation?.sectionId
        ? handoffPage?.sections.find((candidateSection) => candidateSection.id === handoffOperation.sectionId)
        : handoffOperation?.elementId
          ? handoffPage?.sections.find((candidateSection) => candidateSection.elements.some((candidateElement) => candidateElement.id === handoffOperation.elementId))
          : handoffOperation?.containerId
            ? handoffPage?.sections.find((candidateSection) => (candidateSection.containers || []).some((candidateContainer) => candidateContainer.id === handoffOperation.containerId))
            : handoffPage?.sections[0];
      const handoffElement = handoffOperation?.elementId
        ? handoffPage?.sections.flatMap((candidateSection) => candidateSection.elements).find((candidateElement) => candidateElement.id === handoffOperation.elementId)
        : handoffSection?.elements[0];

      if (handoffPage) {
        setActivePageId(handoffPage.id);
        setSections(handoffPage.sections);
      }
      setSelectedId(handoffSection?.id ?? handoffPage?.sections[0]?.id ?? finalActive?.sections[0]?.id ?? null);
      setSelectedElementId(handoffElement?.id ?? handoffSection?.elements[0]?.id ?? null);
      setBuilderPanel('layers');
      setInspectorOpen(true);
      setSaved(false);
      setAiPrompt(aiPreparedFollowUpRef.current || '');
      aiPreparedFollowUpRef.current = null;
      aiQualityReviewContextRef.current = null;
      setAiQualityReview(null);
      setAiStage('ready');
      pushProjectCheckpoint(`After AI change · ${prompt.slice(0, 60)}`, {
        ...buildProjectSnapshot(),
        pages: nextPages,
        activePageId: finalActive?.id || activePageId,
        homePageId: nextHomePageId,
        siteName: nextSiteName,
        theme: nextTheme,
        seo: nextSeo,
        headerConfig: nextHeaderConfig,
        symbols: nextSymbols,
      });

      setAiPlan({
        summary,
        pages: nextPages.map((page) => ({ name: page.name, sections: page.sections.length })),
      });
      setAiMessages((current) => [
        ...current,
        {
          id: `ai-patch-result-${Date.now()}`,
          role: 'assistant' as const,
          content: [
            summary,
            `${l('Planned steps')}: ${(agentPlan.steps || []).length}`,
            `${l('Applied safe changes')}: ${applied}`,
            skipped ? `${l('Skipped unsafe changes')}: ${skipped}` : '',
            resultWarnings.length ? `${l('Warnings')}: ${resultWarnings.join(' · ')}` : '',
            confidence !== null ? `${l('Confidence')}: ${Math.round(confidence * 100)}%` : '',
            agentReview
              ? `${l('Agent review')}${typeof agentReview.score === 'number' ? ` ${agentReview.score}/100` : ''}: ${agentReview.summary || l('Review complete.')}${agentReview.findings?.length ? ` · ${agentReview.findings.map((finding) => `${finding.severity}: ${finding.title}`).join(' · ')}` : ''}${agentReview.followUpPrompt ? ` · ${l('Suggested follow-up')}: ${agentReview.followUpPrompt}` : ''}`
              : '',
          ].filter(Boolean).join(' · '),
        },
      ].slice(-12));
    } catch (error) {
      if (!operationCanApply()) return;
      const message = error instanceof Error ? error.message : l('AI edit failed.');
      setAiError(message);
      setAiStage('error');
      setAiMessages((current) => [
        ...current,
        { id: `ai-patch-error-${Date.now()}`, role: 'assistant' as const, content: message },
      ].slice(-12));
    } finally {
      finishAIRequest(abortController);
      if (operationIsLatest()) {
        setAiBusy(false);
        if (!operationCanApply()) setAiStage('ready');
      }
    }
  };
}
