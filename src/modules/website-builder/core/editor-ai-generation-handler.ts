import type { Language } from '@/context/PreferencesContext';
import { createAIService } from '@/lib/ai/service';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import { createElement,normalizeSection,SECTION_LABELS } from '../core/defaults';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import type { EditorAIAsyncContext } from '../core/editor-ai-operation-context';
import type { AIQualityReview,AIWebsiteGeneration,AIWebsitePageGeneration,AIWebsitePatchReview } from '../core/editor-ai-patch-review';
import type { AIBuilderMessage,AIBuilderStage } from '../core/editor-ai-scope';
import type { SectionType,WebsiteBrand,WebsiteSection,WebsiteSEO } from '../core/types';
import { normalizeTheme } from '../core/website-builder-config';
import type { AIWebsiteCandidatePreview,AIWebsiteUndoSnapshot,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';

interface AIGenerationHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  aiAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiBusy: boolean;
  aiEditorContextIsCurrent: (expected: EditorAIAsyncContext, requireSelection?: boolean) => boolean;
  aiOperationSequenceRef: React.MutableRefObject<number>;
  aiPrompt: string;
  aiQualityAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiQualityBusy: boolean;
  aiQualityReviewContextRef: React.MutableRefObject<EditorAIAsyncContext | null>;
  aiUndoContextRef: React.MutableRefObject<EditorAIAsyncContext | null>;
  beginAIRequest: () => AbortController;
  billingEntitlements: import("./website-builder-model").BillingEntitlements;
  brand: WebsiteBrand;
  buildProjectSnapshot: () => { version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  captureAIEditorContext: () => { loadSequence: number; userId: string | null; routeProjectId: string | null; projectId: string | null; ownerId: string | null; editableFingerprint: string; activePageId: string; sectionId: string | null; elementId: string | null; containerId: string | null; formFieldId: string | null; device: string; };
  finishAIRequest: (controller: AbortController) => void;
  headerConfig: WebsiteHeaderConfig;
  l: (text: string) => string;
  pushProjectCheckpoint: (label: string, snapshot?: Record<string, unknown>) => void;
  requestGeneratedImage: (prompt: string, signal?: AbortSignal) => Promise<{ url: string; assetPath?: string; persisted?: boolean; persistenceError?: string; }>;
  seo: WebsiteSEO;
  setActivePageId: React.Dispatch<React.SetStateAction<string>>;
  setAiBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setAiCandidatePreview: React.Dispatch<React.SetStateAction<AIWebsiteCandidatePreview | null>>;
  setAiError: React.Dispatch<React.SetStateAction<string>>;
  setAiIntent: React.Dispatch<React.SetStateAction<"edit" | "build">>;
  setAiMessages: React.Dispatch<React.SetStateAction<AIBuilderMessage[]>>;
  setAiPatchReview: React.Dispatch<React.SetStateAction<AIWebsitePatchReview | null>>;
  setAiPlan: React.Dispatch<React.SetStateAction<{ summary: string; pages: Array<{ name: string; sections: number; }>; } | null>>;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  setAiQualityReview: React.Dispatch<React.SetStateAction<AIQualityReview | null>>;
  setAiStage: React.Dispatch<React.SetStateAction<AIBuilderStage>>;
  setAiUndoSnapshot: React.Dispatch<React.SetStateAction<AIWebsiteUndoSnapshot | null>>;
  setBrand: React.Dispatch<React.SetStateAction<WebsiteBrand>>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setHomePageId: React.Dispatch<React.SetStateAction<string>>;
  setPages: React.Dispatch<React.SetStateAction<WebsitePage[]>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSeo: React.Dispatch<React.SetStateAction<WebsiteSEO>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  setTheme: React.Dispatch<React.SetStateAction<WebsiteTheme>>;
  theme: WebsiteTheme;
  user: User | null;
}

export function createAIGenerationHandler({
  activeUserIdRef,
  aiAbortControllerRef,
  aiBusy,
  aiEditorContextIsCurrent,
  aiOperationSequenceRef,
  aiPrompt,
  aiQualityAbortControllerRef,
  aiQualityBusy,
  aiQualityReviewContextRef,
  aiUndoContextRef,
  beginAIRequest,
  billingEntitlements,
  brand,
  buildProjectSnapshot,
  captureAIEditorContext,
  finishAIRequest,
  headerConfig,
  l,
  pushProjectCheckpoint,
  requestGeneratedImage,
  seo,
  setActivePageId,
  setAiBusy,
  setAiCandidatePreview,
  setAiError,
  setAiIntent,
  setAiMessages,
  setAiPatchReview,
  setAiPlan,
  setAiPrompt,
  setAiQualityReview,
  setAiStage,
  setAiUndoSnapshot,
  setBrand,
  setHeaderConfig,
  setHomePageId,
  setPages,
  setSaved,
  setSections,
  setSelectedElementId,
  setSelectedId,
  setSeo,
  setSiteName,
  setTheme,
  theme,
  user,
}: AIGenerationHandlerDependencies) {
  return async function generateWithAI(agentMode = false) {
    if (aiAbortControllerRef.current || aiQualityAbortControllerRef.current) return;
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy || aiQualityBusy) return;
    if (!window.confirm(l('Building a new website replaces the current pages. Continue?'))) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const abortController = beginAIRequest();
    const operationUserId = user?.id ?? null;
    const operationContext = captureAIEditorContext();
    const operationIsLatest = () =>
      aiOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;
    const operationCanApply = () =>
      operationIsLatest() &&
      aiEditorContextIsCurrent(operationContext, false);

    const requestId = `ai-request-${Date.now()}`;
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
      const response = await ai.completeJSON<AIWebsiteGeneration>(
        { action: 'generate', prompt: agentMode ? `Build this as a complete production-ready website. Include strong SEO direction and imagePrompt values for the most important visual sections. Request: ${prompt}` : prompt },
        [],
        { temperature: 0.65, maxTokens: 9000, signal: abortController.signal },
      );

      if (!operationCanApply()) return;

      let generated = response.json;
      if (!generated && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        generated = JSON.parse(cleaned) as AIWebsiteGeneration;
      }

      const pageCandidates: AIWebsitePageGeneration[] = Array.isArray(generated?.pages) && generated.pages.length > 0
        ? generated.pages
        : Array.isArray(generated?.sections) && generated.sections.length > 0
          ? [{ name: 'Home', slug: 'home', showInNavigation: true, sections: generated.sections }]
          : [];

      if (!generated || pageCandidates.length === 0) {
        throw new Error(l('AI returned an invalid website plan. Please try a more specific description.'));
      }

      setAiStage('building');

      const allowedTypes = new Set<SectionType>([
        'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
      ]);
      const validHex = (value?: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');
      const isLightHex = (value: string) => {
        const hex = value.replace('#', '');
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return ((r * 299) + (g * 587) + (b * 114)) / 1000 > 165;
      };
      const generatedPrimary = validHex(generated.style?.primaryColor) ? generated.style!.primaryColor! : '#0f172a';
      const generatedAccent = validHex(generated.style?.accentColor) ? generated.style!.accentColor! : '#7c3aed';
      const generatedSurfaceIsLight = isLightHex(generatedPrimary);
      const generatedAccentIsLight = isLightHex(generatedAccent);
      const generatedTextColor = generatedSurfaceIsLight ? '#0f172a' : '#f8fafc';
      const generatedMutedTextColor = generatedSurfaceIsLight ? '#475569' : '#cbd5e1';
      const generatedAt = Date.now();
      const maxGeneratedPages = Math.max(1, Math.min(6, billingEntitlements.maxPages || 1));
      const usedSlugs = new Set<string>();

      let nextPages = pageCandidates.slice(0, maxGeneratedPages).map((page, pageIndex) => {
        const normalizedSections = (page.sections || [])
          .filter((section) => allowedTypes.has(section.type))
          .slice(0, 8)
          .map((section, sectionIndex) => normalizeSection({
            id: `${section.type}-ai-${generatedAt}-${pageIndex}-${sectionIndex}-${Math.random().toString(36).slice(2, 6)}`,
            type: section.type,
            title: section.title?.trim() || SECTION_LABELS[section.type],
            description: section.description?.trim() || '',
            buttonText: section.type === 'footer' ? '' : (section.buttonText?.trim() || 'Learn More'),
            buttonUrl: section.type === 'footer' ? '' : (section.buttonUrl?.trim() || '#contact'),
            background: validHex(section.background) ? section.background! : generatedPrimary,
            accent: validHex(section.accent) ? section.accent! : generatedAccent,
            image: section.image?.trim() || undefined,
            imagePrompt: section.imagePrompt?.trim() || undefined,
          }));

        const pageName = page.name?.trim() || (pageIndex === 0 ? 'Home' : `Page ${pageIndex + 1}`);
        const rawSlug = (page.slug?.trim() || pageName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `page-${pageIndex + 1}`;
        let slug = pageIndex === 0 && rawSlug === 'home' ? 'home' : rawSlug;
        let suffix = 2;
        while (usedSlugs.has(slug)) {
          slug = `${rawSlug}-${suffix}`;
          suffix += 1;
        }
        usedSlugs.add(slug);

        return {
          id: `page-ai-${generatedAt}-${pageIndex}`,
          name: pageName,
          slug,
          sections: normalizedSections,
          showInNavigation: page.showInNavigation !== false,
        } satisfies WebsitePage;
      }).filter((page) => page.sections.length > 0);

      if (nextPages.length === 0) {
        throw new Error(l('AI did not return usable pages or sections. Please try again.'));
      }

      let agentImagesGenerated = 0;
      if (agentMode) {
        setAiStage('styling');
        const visualTargets: Array<{ pageIndex: number; sectionIndex: number; prompt: string }> = [];
        nextPages.forEach((page, pageIndex) => {
          page.sections.forEach((section, sectionIndex) => {
            if (visualTargets.length >= 2) return;
            if ((section.type === 'hero' || section.type === 'about' || section.type === 'services') && section.imagePrompt?.trim()) {
              visualTargets.push({ pageIndex, sectionIndex, prompt: section.imagePrompt.trim() });
            }
          });
        });

        for (const target of visualTargets) {
          try {
            const generatedImage = await requestGeneratedImage(target.prompt, abortController.signal);
            if (!operationCanApply()) return;
            const page = nextPages[target.pageIndex];
            const section = page?.sections[target.sectionIndex];
            if (!section) continue;
            const nextSection: WebsiteSection = section.type === 'hero'
              ? {
                  ...section,
                  image: generatedImage.url,
                  backgroundMode: 'image',
                  backgroundImage: generatedImage.url,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  overlayColor: '#000000',
                  overlayOpacity: 0.42,
                }
              : {
                  ...section,
                  image: generatedImage.url,
                  elements: section.elements.some((element) => element.type === 'image')
                    ? section.elements.map((element) => element.type === 'image' ? { ...element, src: generatedImage.url, content: section.title || 'Generated image' } : element)
                    : [...section.elements, { ...createElement('image', section.accent), src: generatedImage.url, content: section.title || 'Generated image' }],
                };
            nextPages = nextPages.map((candidate, pageIndex) => pageIndex === target.pageIndex
              ? { ...candidate, sections: candidate.sections.map((candidateSection, sectionIndex) => sectionIndex === target.sectionIndex ? nextSection : candidateSection) }
              : candidate
            );
            agentImagesGenerated += 1;
          } catch {
            if (!operationCanApply()) return;
            // Agent image generation is best-effort; the site remains fully editable if the image provider is unavailable.
          }
        }
      }

      const firstPage = nextPages[0];
      const totalSections = nextPages.reduce((sum, page) => sum + page.sections.length, 0);
      const summary = generated.summary?.trim() || `${nextPages.length} page website with ${totalSections} structured sections.`;

      if (!operationCanApply()) return;

      pushProjectCheckpoint(agentMode ? 'Before Tayar Agent build' : 'Before AI build');
      setAiPlan({
        summary,
        pages: nextPages.map((page) => ({ name: page.name, sections: page.sections.length })),
      });
      setPages(nextPages);
      setActivePageId(firstPage.id);
      setHomePageId(firstPage.id);
      setSections(firstPage.sections);
      setSelectedId(firstPage.sections[0]?.id ?? null);
      setSelectedElementId(firstPage.sections[0]?.elements[0]?.id ?? null);
      setSiteName(generated.siteName?.trim() || 'My Website');

      setAiStage('styling');
      const tone = generated.style?.tone?.toLowerCase() || 'modern';
      const nextGeneratedTheme = normalizeTheme({
        ...theme,
        primaryColor: generatedAccent,
        secondaryColor: generatedPrimary,
        backgroundColor: generatedPrimary,
        textColor: generatedTextColor,
        mutedTextColor: generatedMutedTextColor,
        contentWidth: tone === 'editorial' ? 1040 : 1120,
        buttonRadius: tone === 'premium' || tone === 'friendly' ? 16 : tone === 'corporate' ? 10 : 12,
        sectionSpacing: tone === 'minimal' || tone === 'premium' ? 104 : 92,
      });
      const nextGeneratedHeader = {
        ...headerConfig,
        backgroundColor: generatedPrimary,
        textColor: generatedTextColor,
        activeColor: generatedTextColor,
        hoverColor: generatedAccent,
        ctaBackgroundColor: generatedAccent,
        ctaTextColor: generatedAccentIsLight ? '#0f172a' : '#ffffff',
        borderColor: generatedSurfaceIsLight ? '#e2e8f0' : '#334155',
      };
      const nextGeneratedSeo: WebsiteSEO = generated.seo || {
        ...seo,
        title: generated.siteName?.trim() || seo.title || 'Website',
        description: generated.summary?.trim() || seo.description || 'Professional website built with Tayar.',
        keywords: seo.keywords,
      };
      setTheme(nextGeneratedTheme);
      setHeaderConfig(nextGeneratedHeader);
      if (generated.brand) setBrand(generated.brand);
      setSeo(nextGeneratedSeo);

      const finalSiteName = generated.siteName?.trim() || 'My Website';
      pushProjectCheckpoint(agentMode ? 'After Tayar Agent build' : 'After AI build', {
        ...buildProjectSnapshot(),
        siteName: finalSiteName,
        pages: nextPages,
        activePageId: firstPage.id,
        homePageId: firstPage.id,
        theme: nextGeneratedTheme,
        headerConfig: nextGeneratedHeader,
        brand: generated.brand || brand,
        seo: nextGeneratedSeo,
      });
      aiUndoContextRef.current = null;
      aiQualityReviewContextRef.current = null;
      setAiUndoSnapshot(null);
      setAiQualityReview(null);
      setSaved(false);
      setAiPrompt('');
      setAiStage('ready');
      setAiIntent('edit');
      setAiMessages((current) => [
        ...current,
        {
          id: `ai-result-${generatedAt}`,
          role: 'assistant' as const,
          content: agentMode
            ? `Tayar Agent prepared ${nextPages.length} page${nextPages.length === 1 ? '' : 's'}, ${totalSections} sections, design system, SEO and ${agentImagesGenerated} generated image${agentImagesGenerated === 1 ? '' : 's'}. ${summary}`
            : `Built ${nextPages.length} page${nextPages.length === 1 ? '' : 's'} with ${totalSections} sections. ${summary}`,
        },
      ].slice(-12));
    } catch (error) {
      if (!operationCanApply()) return;
      const message = error instanceof Error ? error.message : l('AI generation failed.');
      setAiError(message);
      setAiStage('error');
      setAiMessages((current) => [
        ...current,
        { id: `ai-error-${Date.now()}`, role: 'assistant' as const, content: message },
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
