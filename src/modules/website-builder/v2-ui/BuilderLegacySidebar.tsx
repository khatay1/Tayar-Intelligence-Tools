import type { Language,UserPreferences } from '@/context/PreferencesContext';
import { Check,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Copy,Eye,Globe,Palette,Plus,RotateCcw,Sparkles,Trash2,Type } from 'lucide-react';
import type * as React from 'react';
import { ELEMENT_LABELS,SECTION_LABELS } from '../core/defaults';
import type { AIQualityReview } from '../core/editor-ai-patch-review';
import type { AIBuilderMessage,AIBuilderStage } from '../core/editor-ai-scope';
import { AI_BUILDER_STAGE_ORDER } from '../core/editor-ai-scope';
import { languageCodeLabel,normalizePageLanguage,PAGE_LANGUAGE_LABELS } from '../core/project-identifiers';
import type { SectionType,WebsiteElementType,WebsiteSection,WebsiteSEO } from '../core/types';
import { FONT_OPTIONS,normalizeTheme } from '../core/website-builder-config';
import type { AIWebsiteUndoSnapshot,BillingEntitlements,BillingFeature,ReusableSectionTemplate,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteTheme } from '../core/website-builder-model';
import type { PageTemplateDefinition,SectionTemplateDefinition } from '../core/website-builder-rendering';
import { PAGE_TEMPLATES,SECTION_TEMPLATES } from '../core/website-builder-rendering';
import type { WebsiteDesignSystemPreset,WebsiteDesignSystemReport } from '../core/website-design-system';
import { WEBSITE_DESIGN_SYSTEM_PRESETS } from '../core/website-design-system';
import type { WebsiteLocalizationConfig } from '../core/website-localization';

interface BuilderLegacySidebarProps {
  activePage: WebsitePage;
  activePageId: string;
  addElement: (type: WebsiteElementType) => void;
  addPage: () => void;
  addSection: (type: SectionType) => void;
  addSectionTemplate: (template: SectionTemplateDefinition) => void;
  advancedSiteSettingsOpen: boolean;
  aiBusy: boolean;
  aiError: string;
  aiMessages: AIBuilderMessage[];
  aiPlan: { summary: string; pages: Array<{ name: string; sections: number; }>; } | null;
  aiPrompt: string;
  aiQualityBusy: boolean;
  aiStage: AIBuilderStage;
  aiStageStatus: string;
  aiUndoSnapshot: AIWebsiteUndoSnapshot | null;
  applyAIChange: (requestedPrompt?: string) => Promise<void>;
  applyDesignSystemPreset: (preset: WebsiteDesignSystemPreset) => void;
  applyPageTemplate: (template: PageTemplateDefinition) => void;
  applyThemeToAllPages: () => void;
  applyThemeToCurrentPage: () => void;
  billingEntitlements: BillingEntitlements;
  builderPanel: "add" | "pages" | "layers";
  copied: boolean;
  copyHtml: () => Promise<void>;
  darkMode: boolean;
  deleteActivePage: () => void;
  deleteReusableSection: (template: ReusableSectionTemplate) => Promise<void>;
  designSystemReport: WebsiteDesignSystemReport;
  duplicateActivePage: () => void;
  duplicatePageAsTranslation: (language: Language) => void;
  faviconUrl: string;
  footerConfig: WebsiteFooterConfig;
  generateRealImage: () => Promise<void>;
  generateWithAI: (agentMode?: boolean) => Promise<void>;
  headerConfig: WebsiteHeaderConfig;
  homePageId: string;
  insertReusableSection: (template: ReusableSectionTemplate) => void;
  l: (text: string) => string;
  leftSidebarOpen: boolean;
  localization: WebsiteLocalizationConfig;
  makeActivePageHome: () => void;
  movePage: (pageId: string, direction: "up" | "down") => void;
  openBillingWithMessage: (message?: string) => void;
  pages: WebsitePage[];
  pageSettingsOpen: boolean;
  prefs: UserPreferences;
  productionConfig: WebsiteProductionConfig;
  qualityDiagnostics: { pages: number; sections: number; elements: number; snapshotKb: number; warnings: string[]; healthy: boolean; };
  recoveryAvailable: boolean;
  repairActiveDesignSystem: () => void;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  restoreRecoverySnapshot: () => void;
  reusableBusy: boolean;
  reusableError: string;
  reusableSections: ReusableSectionTemplate[];
  runAIQualityCheck: () => Promise<AIQualityReview | null>;
  saveSelectedSectionAsReusable: () => Promise<void>;
  sections: WebsiteSection[];
  selectedElementId: string | null;
  selectedId: string | null;
  selectedSection: WebsiteSection | null;
  seo: WebsiteSEO;
  setAdvancedSiteSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiError: React.Dispatch<React.SetStateAction<string>>;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  setAiStage: React.Dispatch<React.SetStateAction<AIBuilderStage>>;
  setBuilderPanel: React.Dispatch<React.SetStateAction<"add" | "pages" | "layers">>;
  setFaviconUrl: React.Dispatch<React.SetStateAction<string>>;
  setFooterConfig: React.Dispatch<React.SetStateAction<WebsiteFooterConfig>>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLocalization: React.Dispatch<React.SetStateAction<WebsiteLocalizationConfig>>;
  setPageSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProductionConfig: React.Dispatch<React.SetStateAction<WebsiteProductionConfig>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSeo: React.Dispatch<React.SetStateAction<WebsiteSEO>>;
  setSiteEnhancements: React.Dispatch<React.SetStateAction<WebsiteSiteEnhancements>>;
  setTheme: React.Dispatch<React.SetStateAction<WebsiteTheme>>;
  siteAudit: { errors: string[]; warnings: string[]; score: number; };
  siteEnhancements: WebsiteSiteEnhancements;
  stopAIQualityCheck: () => void;
  switchPage: (pageId: string) => void;
  theme: WebsiteTheme;
  undoLastAIChange: () => void;
  updateActivePageMeta: (changes: Partial<Pick<WebsitePage, "name" | "slug" | "showInNavigation" | "seoTitle" | "seoDescription" | "socialImage" | "canonicalUrl" | "language" | "translationKey" | "noIndex">>) => void;
}

export function BuilderLegacySidebar({
  activePage,
  activePageId,
  addElement,
  addPage,
  addSection,
  addSectionTemplate,
  advancedSiteSettingsOpen,
  aiBusy,
  aiError,
  aiMessages,
  aiPlan,
  aiPrompt,
  aiQualityBusy,
  aiStage,
  aiStageStatus,
  aiUndoSnapshot,
  applyAIChange,
  applyDesignSystemPreset,
  applyPageTemplate,
  applyThemeToAllPages,
  applyThemeToCurrentPage,
  billingEntitlements,
  builderPanel,
  copied,
  copyHtml,
  darkMode,
  deleteActivePage,
  deleteReusableSection,
  designSystemReport,
  duplicateActivePage,
  duplicatePageAsTranslation,
  faviconUrl,
  footerConfig,
  generateRealImage,
  generateWithAI,
  headerConfig,
  homePageId,
  insertReusableSection,
  l,
  leftSidebarOpen,
  localization,
  makeActivePageHome,
  movePage,
  openBillingWithMessage,
  pages,
  pageSettingsOpen,
  prefs,
  productionConfig,
  qualityDiagnostics,
  recoveryAvailable,
  repairActiveDesignSystem,
  requireBillingFeature,
  restoreRecoverySnapshot,
  reusableBusy,
  reusableError,
  reusableSections,
  runAIQualityCheck,
  saveSelectedSectionAsReusable,
  sections,
  selectedElementId,
  selectedId,
  selectedSection,
  seo,
  setAdvancedSiteSettingsOpen,
  setAiError,
  setAiPrompt,
  setAiStage,
  setBuilderPanel,
  setFaviconUrl,
  setFooterConfig,
  setHeaderConfig,
  setInspectorOpen,
  setLeftSidebarOpen,
  setLocalization,
  setPageSettingsOpen,
  setProductionConfig,
  setSaved,
  setSelectedElementId,
  setSelectedId,
  setSeo,
  setSiteEnhancements,
  setTheme,
  siteAudit,
  siteEnhancements,
  stopAIQualityCheck,
  switchPage,
  theme,
  undoLastAIChange,
  updateActivePageMeta,
}: BuilderLegacySidebarProps) {
  return (
<aside data-tayar-v1-left="true"
          className={`w-full shrink-0 border-b p-3 transition-[width,padding] duration-200 lg:border-b-0 lg:border-r ${leftSidebarOpen ? 'lg:w-56 xl:w-60 lg:p-3' : 'lg:w-12 lg:p-2'} ${
            darkMode
              ? 'border-white/10 bg-[#0a0a1a]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-2 hidden lg:flex lg:justify-end">
            <button
              type="button"
              onClick={() => setLeftSidebarOpen((open) => !open)}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              title={l(leftSidebarOpen ? 'Collapse tools panel' : 'Expand tools panel')}
              aria-label={l(leftSidebarOpen ? 'Collapse tools panel' : 'Expand tools panel')}
              aria-expanded={leftSidebarOpen}
            >
              {leftSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
          <div className={leftSidebarOpen ? 'block' : 'lg:hidden'}>
          <div className={`mb-3 grid grid-cols-3 gap-1 rounded-xl border p-1 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
            {([
              ['add', l('Add')],
              ['pages', l('Pages')],
              ['layers', l('Layers')],
            ] as const).map(([panel, label]) => (
              <button
                key={panel}
                type="button"
                onClick={() => setBuilderPanel(panel)}
                className={`rounded-lg px-2 py-2 text-[10px] font-bold transition ${builderPanel === panel ? 'bg-violet-600 text-white shadow-sm' : darkMode ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {builderPanel === 'pages' && (
            <>
          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold">{l('Pages')}</span>
              <button type="button" onClick={addPage} className="rounded p-1 text-violet-400 hover:bg-violet-500/10" title={l('Add page')}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {pages.map((page, index) => (
                <div key={page.id} className={`flex items-center gap-1 rounded-lg ${activePageId === page.id ? (darkMode ? 'bg-violet-500/15' : 'bg-violet-100') : ''}`}>
                  <button type="button" onClick={() => switchPage(page.id)} className={`min-w-0 flex-1 px-2 py-1.5 text-left text-xs ${activePageId === page.id ? (darkMode ? 'text-violet-300' : 'text-violet-700') : (darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900')}`}>
                    <span className="flex items-center gap-1.5">
                      {page.id === homePageId && <span className="text-[9px] font-bold text-emerald-400">{l('HOME')}</span>}
                      <span className="truncate">{page.name}</span>
                      <span className="rounded bg-sky-500/10 px-1 text-[8px] font-bold text-sky-400">{languageCodeLabel(normalizePageLanguage(page.language, prefs.language))}</span>
                      {page.showInNavigation === false && <span className="text-[9px] text-gray-500">{l('HIDDEN')}</span>}
                    </span>
                    <span className="block truncate text-[9px] text-gray-500">/{page.slug}</span>
                  </button>
                  <div className="flex shrink-0 flex-col pr-1">
                    <button type="button" onClick={() => movePage(page.id, 'up')} disabled={index === 0} className="rounded p-0.5 text-gray-500 hover:text-violet-400 disabled:opacity-20" title={l('Move page up')}><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" onClick={() => movePage(page.id, 'down')} disabled={index === pages.length - 1} className="rounded p-0.5 text-gray-500 hover:text-violet-400 disabled:opacity-20" title={l('Move page down')}><ChevronDown className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <label className="text-[9px] text-gray-500">{l('Default language')}
                <select value={localization.defaultLanguage} onChange={(e) => { setLocalization((current) => ({ ...current, defaultLanguage: e.target.value as Language })); setSaved(false); }} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                  <option value="en">EN</option><option value="sv">SV</option><option value="ar">AR</option>
                </select>
              </label>
              <label className="text-[9px] text-gray-500">{l('Locale routes')}
                <select value={localization.routeStrategy} onChange={(e) => { setLocalization((current) => ({ ...current, routeStrategy: e.target.value === 'flat' ? 'flat' : 'subdirectory' })); setSaved(false); }} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                  <option value="subdirectory">/sv/page.html</option><option value="flat">/page.html</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setPageSettingsOpen((open) => !open)}
              className={'mt-3 flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[10px] font-semibold ' + (darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-white')}
              aria-expanded={pageSettingsOpen}
            >
              <span>{l('Page settings')}</span>
              <ChevronDown className={'h-3.5 w-3.5 transition-transform ' + (pageSettingsOpen ? 'rotate-180' : '')} />
            </button>
            {activePage && pageSettingsOpen && (
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <label className="flex items-center gap-1.5 text-gray-500">
                    <input type="checkbox" checked={activePage.showInNavigation !== false} onChange={(e) => updateActivePageMeta({ showInNavigation: e.target.checked })} />{l("Show in navigation")}</label>
                  <button type="button" onClick={makeActivePageHome} disabled={activePage.id === homePageId} className="rounded px-2 py-1 font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40">
                    {activePage.id === homePageId ? 'Home page' : 'Set home'}
                  </button>
                </div>
                <input value={activePage.name} onChange={(e) => updateActivePageMeta({ name: e.target.value })} placeholder={l('Page name')} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <select value={normalizePageLanguage(activePage.language, prefs.language)} disabled={!billingEntitlements.features.multilingual} onChange={(e) => { if (!requireBillingFeature('multilingual', 'Multilingual pages')) return; updateActivePageMeta({ language: e.target.value as Language }); }} className={`rounded-lg border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`}>
                    <option value="en">{l(PAGE_LANGUAGE_LABELS.en)}</option><option value="sv">{PAGE_LANGUAGE_LABELS.sv}</option><option value="ar">{PAGE_LANGUAGE_LABELS.ar}</option>
                  </select>
                  <input value={activePage.translationKey || ''} disabled={!billingEntitlements.features.multilingual} onChange={(e) => { if (!requireBillingFeature('multilingual', 'Multilingual pages')) return; updateActivePageMeta({ translationKey: e.target.value.slice(0, 120) }); }} placeholder={billingEntitlements.features.multilingual ? 'Translation group (optional)' : 'Translation groups · Pro'} className={`rounded-lg border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['en', 'sv', 'ar'] as Language[]).filter((language) => language !== normalizePageLanguage(activePage.language, prefs.language)).map((language) => (
                    <button key={language} type="button" disabled={!billingEntitlements.features.multilingual} onClick={() => duplicatePageAsTranslation(language)} className="rounded-md border border-sky-500/20 px-2 py-1 text-[9px] font-semibold text-sky-400 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40">+ {PAGE_LANGUAGE_LABELS[language]}</button>
                  ))}
                  {!billingEntitlements.features.multilingual && <button type="button" onClick={() => openBillingWithMessage('Multilingual pages require the Pro plan or higher.')} className="rounded-md border border-amber-500/20 px-2 py-1 text-[9px] font-bold text-amber-400 hover:bg-amber-500/10">{l('Unlock multilingual')}</button>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">/</span>
                  <input value={activePage.slug} onChange={(e) => updateActivePageMeta({ slug: e.target.value })} placeholder="page-slug" className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <button type="button" onClick={duplicateActivePage} className="rounded p-1.5 text-sky-400 hover:bg-sky-500/10" title={l('Duplicate page')}>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={deleteActivePage} disabled={pages.length <= 1} className="rounded p-1.5 text-red-400 disabled:opacity-30" title={l('Delete page')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2 border-t border-white/10 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">{l('Page SEO')}</span>
                    <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <input type="checkbox" checked={activePage.noIndex === true} onChange={(e) => updateActivePageMeta({ noIndex: e.target.checked })} />{l("Hide from search")}</label>
                  </div>
                  <input value={activePage.seoTitle || ''} onChange={(e) => updateActivePageMeta({ seoTitle: e.target.value })} placeholder={l('Custom SEO title (optional)')} maxLength={70} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <textarea value={activePage.seoDescription || ''} onChange={(e) => updateActivePageMeta({ seoDescription: e.target.value })} placeholder={l('Custom meta description (optional)')} maxLength={180} rows={3} className={`w-full resize-none rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={activePage.socialImage || ''} onChange={(e) => updateActivePageMeta({ socialImage: e.target.value })} placeholder={l('Social share image URL')} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={activePage.canonicalUrl || ''} onChange={(e) => updateActivePageMeta({ canonicalUrl: e.target.value })} placeholder={l('Canonical URL override (optional)')} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              </div>
            )}
          </div>


          <button
            type="button"
            onClick={() => setAdvancedSiteSettingsOpen((open) => !open)}
            className={'mb-4 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ' + (advancedSiteSettingsOpen ? 'border-violet-500/40 bg-violet-500/10 text-violet-400' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')}
            aria-expanded={advancedSiteSettingsOpen}
          >
            <span>
              <span className="block">{l('Site settings')}</span>
              <span className="mt-0.5 block text-[9px] font-normal text-gray-500">{l('Header, footer, theme, SEO and advanced options')}</span>
            </span>
            <ChevronDown className={'h-4 w-4 transition-transform ' + (advancedSiteSettingsOpen ? 'rotate-180' : '')} />
          </button>

          {advancedSiteSettingsOpen && (
            <>
          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/60'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold">{l('Global Header & Footer')}</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/15 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">{l('Header')}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={headerConfig.enabled} onChange={(e) => { setHeaderConfig((current) => ({ ...current, enabled: e.target.checked })); setSaved(false); }} />{l('Enabled')}</label>
                    <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={headerConfig.sticky} onChange={(e) => { setHeaderConfig((current) => ({ ...current, sticky: e.target.checked })); setSaved(false); }} />{l('Sticky')}</label>
                    <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={headerConfig.mobileMenu} onChange={(e) => { setHeaderConfig((current) => ({ ...current, mobileMenu: e.target.checked })); setSaved(false); }} />{l('Mobile menu')}</label>
                    <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={headerConfig.languageSwitcher} disabled={!billingEntitlements.features.multilingual} onChange={(e) => { if (!requireBillingFeature('multilingual', 'Language switcher')) return; setHeaderConfig((current) => ({ ...current, languageSwitcher: e.target.checked })); setSaved(false); }} /> Language switcher {!billingEntitlements.features.multilingual && <span className="font-bold text-amber-400">PRO</span>}</label>
                  </div>
                </div>
                <div className="space-y-2">
                  <input value={headerConfig.brandText} onChange={(e) => { setHeaderConfig((current) => ({ ...current, brandText: e.target.value })); setSaved(false); }} placeholder={l('Brand text (blank = site name)')} maxLength={80} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                  <input value={headerConfig.logoUrl} onChange={(e) => { setHeaderConfig((current) => ({ ...current, logoUrl: e.target.value })); setSaved(false); }} placeholder={l('Logo image URL (optional)')} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                  <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={headerConfig.showCta} onChange={(e) => { setHeaderConfig((current) => ({ ...current, showCta: e.target.checked })); setSaved(false); }} />{l('Show CTA button')}</label>
                  {headerConfig.showCta && (
                    <div className="grid grid-cols-2 gap-2">
                      <input value={headerConfig.ctaLabel} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaLabel: e.target.value })); setSaved(false); }} placeholder={l('CTA label')} maxLength={80} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                      <input value={headerConfig.ctaHref} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaHref: e.target.value })); setSaved(false); }} placeholder="#contact or page:about" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                    </div>
                  )}
                  <div className={`rounded-lg border p-2 ${darkMode ? 'border-white/10 bg-black/10' : 'border-emerald-100 bg-emerald-50/50'}`}>
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-emerald-400">{l('Navigation style')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        ['Bg', 'backgroundColor'],
                        ['Text', 'textColor'],
                        ['Active', 'activeColor'],
                        ['Hover', 'hoverColor'],
                        ['CTA Bg', 'ctaBackgroundColor'],
                        ['CTA Text', 'ctaTextColor'],
                        ['Border', 'borderColor'],
                      ] as const).map(([label, key]) => (
                        <label key={key} className="text-[9px] text-gray-500">{label}
                          <input type="color" value={headerConfig[key]} onChange={(e) => { setHeaderConfig((current) => ({ ...current, [key]: e.target.value })); setSaved(false); }} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" />
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Link gap')}<input type="number" min="4" max="48" value={headerConfig.navGap} onChange={(e) => { setHeaderConfig((current) => ({ ...current, navGap: Number(e.target.value) })); setSaved(false); }} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                      </label>
                      <label className="text-[9px] text-gray-500">{l('Brand px')}<input type="number" min="12" max="32" value={headerConfig.brandSize} onChange={(e) => { setHeaderConfig((current) => ({ ...current, brandSize: Number(e.target.value) })); setSaved(false); }} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                      </label>
                      <label className="text-[9px] text-gray-500">{l('Links px')}<input type="number" min="10" max="24" value={headerConfig.navSize} onChange={(e) => { setHeaderConfig((current) => ({ ...current, navSize: Number(e.target.value) })); setSaved(false); }} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/15 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">{l('Footer')}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={footerConfig.enabled} onChange={(e) => { setFooterConfig((current) => ({ ...current, enabled: e.target.checked })); setSaved(false); }} />{l('Enabled')}</label>
                    <label className="flex items-center gap-1.5 text-[9px] text-gray-500"><input type="checkbox" checked={footerConfig.showNavigation} onChange={(e) => { setFooterConfig((current) => ({ ...current, showNavigation: e.target.checked })); setSaved(false); }} />{l('Page links')}</label>
                  </div>
                </div>
                <div className="space-y-2">
                  <input value={footerConfig.text} onChange={(e) => { setFooterConfig((current) => ({ ...current, text: e.target.value })); setSaved(false); }} placeholder={l('Footer text (blank = automatic copyright)')} maxLength={300} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={footerConfig.instagramUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, instagramUrl: e.target.value })); setSaved(false); }} placeholder="Instagram URL" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                    <input value={footerConfig.facebookUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, facebookUrl: e.target.value })); setSaved(false); }} placeholder="Facebook URL" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                    <input value={footerConfig.linkedinUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, linkedinUrl: e.target.value })); setSaved(false); }} placeholder="LinkedIn URL" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                    <input value={footerConfig.xUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, xUrl: e.target.value })); setSaved(false); }} placeholder="X URL" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-emerald-200 bg-white'}`} />
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-4 text-gray-500">{l('Header and footer are global across every page and are included in Preview, ZIP Export and Publish.')}</p>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold">{l('Site Experience')}</span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.scrollProgress} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, scrollProgress: e.target.checked })); setSaved(false); }} />{l('Scroll progress')}</label>
                <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.backToTop} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, backToTop: e.target.checked })); setSaved(false); }} />{l('Back to top')}</label>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.cookieBanner} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, cookieBanner: e.target.checked })); setSaved(false); }} />{l('Cookie / privacy notice')}</label>
              {siteEnhancements.cookieBanner && (
                <div className="grid gap-2">
                  <textarea rows={3} value={siteEnhancements.cookieText} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, cookieText: e.target.value })); setSaved(false); }} maxLength={500} placeholder={l('Privacy notice text')} className={`w-full resize-none rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} />
                  <input value={siteEnhancements.cookieButtonLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, cookieButtonLabel: e.target.value })); setSaved(false); }} maxLength={60} placeholder={l('Accept button label')} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} />
                </div>
              )}
              <div className={`rounded-lg border p-2.5 ${darkMode ? 'border-white/10 bg-black/10' : 'border-cyan-100 bg-white'}`}>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-cyan-400">{l('Marketing & discovery')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.announcementBar} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementBar: e.target.checked })); setSaved(false); }} />{l('Announcement')}</label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.popupEnabled} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupEnabled: e.target.checked })); setSaved(false); }} />{l('Popup')}</label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.siteSearch} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, siteSearch: e.target.checked })); setSaved(false); }} />{l('Site search')}</label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.galleryLightbox} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, galleryLightbox: e.target.checked })); setSaved(false); }} />{l('Gallery lightbox')}</label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.floatingCta} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCta: e.target.checked })); setSaved(false); }} />{l('Floating CTA')}</label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={siteEnhancements.shareButtons} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, shareButtons: e.target.checked })); setSaved(false); }} />{l('Share tools')}</label>
                </div>
                {siteEnhancements.announcementBar && <div className="mt-2 grid gap-2"><input value={siteEnhancements.announcementText} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementText: e.target.value })); setSaved(false); }} placeholder={l('Announcement text')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><div className="grid grid-cols-2 gap-2"><input value={siteEnhancements.announcementLinkLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementLinkLabel: e.target.value })); setSaved(false); }} placeholder={l('Link label')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><input value={siteEnhancements.announcementHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementHref: e.target.value })); setSaved(false); }} placeholder="#anchor / page:about / URL" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /></div></div>}
                {siteEnhancements.popupEnabled && <div className="mt-2 grid gap-2"><input value={siteEnhancements.popupTitle} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupTitle: e.target.value })); setSaved(false); }} placeholder={l('Popup title')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><textarea rows={2} value={siteEnhancements.popupText} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupText: e.target.value })); setSaved(false); }} placeholder={l('Popup message')} className={`resize-none rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><div className="grid grid-cols-3 gap-2"><input value={siteEnhancements.popupButtonLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupButtonLabel: e.target.value })); setSaved(false); }} placeholder={l('Button')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><input value={siteEnhancements.popupButtonHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupButtonHref: e.target.value })); setSaved(false); }} placeholder={l('Button link')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><input type="number" min="0" max="60" value={siteEnhancements.popupDelaySeconds} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupDelaySeconds: Number(e.target.value) })); setSaved(false); }} title={l('Delay in seconds')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /></div></div>}
                {siteEnhancements.floatingCta && <div className="mt-2 grid grid-cols-2 gap-2"><input value={siteEnhancements.floatingCtaLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCtaLabel: e.target.value })); setSaved(false); }} placeholder={l('Floating CTA label')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><input value={siteEnhancements.floatingCtaHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCtaHref: e.target.value })); setSaved(false); }} placeholder={l('CTA link')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /></div>}
              </div>
              <div className={`rounded-lg border p-2.5 ${siteAudit.errors.length ? 'border-red-500/30' : siteAudit.warnings.length ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
                <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-wide text-cyan-400">{l('Pre-publish audit')}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${siteAudit.score >= 90 ? 'bg-emerald-500/15 text-emerald-400' : siteAudit.score >= 70 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>{siteAudit.score}/100</span></div>
                <p className="mt-1 text-[9px] text-gray-500">{siteAudit.errors.length} errors · {siteAudit.warnings.length} warnings · checks SEO, accessibility basics and internal links.</p>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-gray-500"><span>{qualityDiagnostics.pages} pages</span><span>{qualityDiagnostics.sections} sections</span><span>{qualityDiagnostics.elements} elements</span><span>{qualityDiagnostics.snapshotKb} KB snapshot</span></div>
                {qualityDiagnostics.warnings.length > 0 && <div className="mt-2 space-y-1">{qualityDiagnostics.warnings.slice(0, 4).map((item) => <p key={item} className="text-[9px] text-orange-400">• {item}</p>)}</div>}
                {recoveryAvailable && <button onClick={restoreRecoverySnapshot} className="mt-2 rounded-lg border border-cyan-500/30 px-2 py-1 text-[9px] font-bold text-cyan-400">{l('Restore recovery snapshot')}</button>}
                {(siteAudit.errors.length > 0 || siteAudit.warnings.length > 0) && <div className="mt-2 max-h-32 space-y-1 overflow-auto">{siteAudit.errors.slice(0, 5).map((item) => <p key={`e-${item}`} className="text-[9px] text-red-400">• {item}</p>)}{siteAudit.warnings.slice(0, 7).map((item) => <p key={`w-${item}`} className="text-[9px] text-amber-400">• {item}</p>)}</div>}
              </div>
              <p className="text-[9px] leading-4 text-gray-500">{l('FAQ structured data is generated automatically from Accordion elements during Preview, Export and Publish.')}</p>
            </div>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-200 bg-blue-50/60'}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-blue-400" /><span className="text-xs font-semibold">{l('Production Integrations')}</span></div>
              {!billingEntitlements.features.productionIntegrations && <button type="button" onClick={() => openBillingWithMessage('Production tracking integrations require the Pro plan or higher.')} className="rounded-full border border-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">PRO</button>}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input value={productionConfig.ga4Id} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, ga4Id: e.target.value })); setSaved(false); }} placeholder="GA4 · G-XXXX" className={`rounded border px-2 py-1.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
                <input value={productionConfig.gtmId} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, gtmId: e.target.value })); setSaved(false); }} placeholder="GTM · GTM-XXXX" className={`rounded border px-2 py-1.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
                <input value={productionConfig.metaPixelId} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, metaPixelId: e.target.value })); setSaved(false); }} placeholder={l('Meta Pixel ID')} className={`rounded border px-2 py-1.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
                <input value={productionConfig.plausibleDomain} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, plausibleDomain: e.target.value })); setSaved(false); }} placeholder={l('Plausible domain')} className={`rounded border px-2 py-1.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={productionConfig.googleVerification} onChange={(e) => { setProductionConfig((current) => ({ ...current, googleVerification: e.target.value })); setSaved(false); }} placeholder={l('Google verification token')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
                <input value={productionConfig.bingVerification} onChange={(e) => { setProductionConfig((current) => ({ ...current, bingVerification: e.target.value })); setSaved(false); }} placeholder={l('Bing verification token')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
              </div>
              <div className={`rounded-lg border p-2.5 ${darkMode ? 'border-white/10' : 'border-blue-100 bg-white/70'}`}>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={productionConfig.organizationSchema} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationSchema: e.target.checked })); setSaved(false); }} />{l('Organization schema')}</label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-500"><input type="checkbox" checked={productionConfig.localBusinessSchema} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessSchema: e.target.checked })); setSaved(false); }} />{l('Local Business schema')}</label>
                </div>
                {(productionConfig.organizationSchema || productionConfig.localBusinessSchema) && <div className="grid gap-2">
                  <input value={productionConfig.organizationName} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationName: e.target.value })); setSaved(false); }} placeholder={l('Organization / business name')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
                  <div className="grid grid-cols-2 gap-2"><input value={productionConfig.organizationUrl} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationUrl: e.target.value })); setSaved(false); }} placeholder={l('Organization URL')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /><input value={productionConfig.organizationLogo} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationLogo: e.target.value })); setSaved(false); }} placeholder={l('Logo URL')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /></div>
                  {productionConfig.localBusinessSchema && <><div className="grid grid-cols-2 gap-2"><input value={productionConfig.localBusinessType} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessType: e.target.value })); setSaved(false); }} placeholder={l('Schema type · LocalBusiness')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /><input value={productionConfig.localBusinessPhone} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessPhone: e.target.value })); setSaved(false); }} placeholder={l('Phone')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /></div><input value={productionConfig.localBusinessAddress} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessAddress: e.target.value })); setSaved(false); }} placeholder={l('Business address')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /></>}
                </div>}
              </div>
              <div className={`rounded-lg border p-2.5 ${productionConfig.maintenanceMode ? 'border-amber-500/30' : darkMode ? 'border-white/10' : 'border-blue-100 bg-white/70'}`}>
                <label className="flex items-center gap-2 text-[10px] font-semibold text-amber-400"><input type="checkbox" checked={productionConfig.maintenanceMode} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceMode: e.target.checked })); setSaved(false); }} />{l('Maintenance mode')}</label>
                {productionConfig.maintenanceMode && <div className="mt-2 grid gap-2"><input value={productionConfig.maintenanceTitle} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceTitle: e.target.value })); setSaved(false); }} placeholder={l('Maintenance title')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-amber-200 bg-white'}`} /><textarea rows={2} value={productionConfig.maintenanceText} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceText: e.target.value })); setSaved(false); }} placeholder={l('Maintenance message')} className={`resize-none rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-amber-200 bg-white'}`} /></div>}
              </div>
              <label className="block text-[10px] text-gray-500">{l('Global custom CSS')}<textarea rows={5} value={productionConfig.customCss} disabled={!billingEntitlements.features.customCss} onChange={(e) => { if (!requireBillingFeature('customCss', 'Global custom CSS')) return; setProductionConfig((current) => ({ ...current, customCss: e.target.value })); setSaved(false); }} placeholder={billingEntitlements.features.customCss ? '.my-class { ... }' : 'Custom CSS · Pro'} className={`mt-1 w-full resize-y rounded border px-2 py-1.5 font-mono text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
              </label>
              <label className="block text-[10px] text-gray-500">{l('Extra robots.txt rules')}<textarea rows={4} value={productionConfig.customRobotsRules} onChange={(e) => { setProductionConfig((current) => ({ ...current, customRobotsRules: e.target.value })); setSaved(false); }} placeholder={'Disallow: /private\nCrawl-delay: 5'} className={`mt-1 w-full resize-y rounded border px-2 py-1.5 font-mono text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
              </label>
              <p className="text-[9px] leading-4 text-gray-500">{l('Tracking integrations are generated from validated IDs. Custom CSS is included in Preview, Export and Publish; raw script injection is intentionally not allowed here.')}</p>
            </div>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">{l('Global Theme')}</span>
            </div>
            <div className={`mb-3 rounded-lg border p-2 ${designSystemReport.score >= 90 ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
              <div className="flex items-center justify-between text-[10px]"><strong>{l('Design system score')}</strong><span>{designSystemReport.score}/100</span></div>
              <p className="mt-1 text-[9px] text-gray-500">{designSystemReport.metrics.contrastFailures} {l('contrast issues')} · {designSystemReport.metrics.customColors} {l('off-token colors')}</p>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <select value="" onChange={(event) => { const preset = WEBSITE_DESIGN_SYSTEM_PRESETS.find((item) => item.id === event.target.value); if (preset) applyDesignSystemPreset(preset); }} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-violet-200 bg-white'}`}><option value="">{l('Choose a system…')}</option>{WEBSITE_DESIGN_SYSTEM_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{l(preset.name)}</option>)}</select>
                <button type="button" disabled={!designSystemReport.issues.length} onClick={repairActiveDesignSystem} className="rounded border border-violet-500/30 px-2 py-1.5 text-[10px] font-semibold text-violet-400 disabled:opacity-40">{l('Auto-balance tokens')}</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['Primary', 'primaryColor'],
                ['Secondary', 'secondaryColor'],
                ['Background', 'backgroundColor'],
                ['Text', 'textColor'],
                ['Muted', 'mutedTextColor'],
              ] as const).map(([label, key]) => (
                <label key={key} className="text-[10px] text-gray-500">{l(String(label))}
                  <div className="mt-1 flex items-center gap-1.5">
                    <input type="color" value={theme[key]} onChange={(e) => { setTheme((current) => ({ ...current, [key]: e.target.value })); setSaved(false); }} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent" />
                    <span className="truncate text-[9px]">{theme[key]}</span>
                  </div>
                </label>
              ))}
            </div>
            <label className="mt-3 block text-[10px] text-gray-500">{l('Font')}<select value={theme.fontFamily} onChange={(e) => { setTheme((current) => ({ ...current, fontFamily: e.target.value })); setSaved(false); }} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-violet-200 bg-white'}`}>
                {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
              </select>
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="text-[9px] text-gray-500">{l('Width')}<input type="number" min="720" max="1440" step="20" value={theme.contentWidth} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, contentWidth: Number(e.target.value) })); setSaved(false); }} className={`mt-1 w-full rounded border px-1.5 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} />
              </label>
              <label className="text-[9px] text-gray-500">{l('Radius')}<input type="number" min="0" max="40" value={theme.buttonRadius} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, buttonRadius: Number(e.target.value) })); setSaved(false); }} className={`mt-1 w-full rounded border px-1.5 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} />
              </label>
              <label className="text-[9px] text-gray-500">{l('Spacing')}<input type="number" min="40" max="140" value={theme.sectionSpacing} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, sectionSpacing: Number(e.target.value) })); setSaved(false); }} className={`mt-1 w-full rounded border px-1.5 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={applyThemeToCurrentPage} className="rounded-lg bg-violet-600 px-2 py-2 text-[10px] font-semibold text-white hover:bg-violet-500">{l('Apply to page')}</button>
              <button type="button" onClick={applyThemeToAllPages} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${darkMode ? 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10' : 'border-violet-300 text-violet-700 hover:bg-violet-100'}`}>{l('Apply all pages')}</button>
            </div>
            <p className="mt-2 text-[9px] leading-4 text-gray-500">{l('Font, width and spacing apply globally. “Apply” also recolors existing sections and buttons.')}</p>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold">{l('Site SEO & Branding')}</span>
            </div>
            <div className="space-y-2">
              <input value={seo.title} onChange={(e) => { setSeo({ ...seo, title: e.target.value }); setSaved(false); }} placeholder={l('Default SEO title')} maxLength={70} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              <textarea value={seo.description} onChange={(e) => { setSeo({ ...seo, description: e.target.value }); setSaved(false); }} placeholder={l('Default meta description')} maxLength={180} rows={3} className={`w-full resize-none rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              <input value={seo.keywords.join(', ')} onChange={(e) => { setSeo({ ...seo, keywords: e.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20) }); setSaved(false); }} placeholder={l('Keywords, comma separated')} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              <input value={faviconUrl} onChange={(e) => { setFaviconUrl(e.target.value); setSaved(false); }} placeholder={l('Favicon image URL')} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              <p className="text-[9px] leading-4 text-gray-500">{l("Page SEO overrides these defaults. Production export and Publish also include a no-index 404.html page.")}</p>
            </div>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold">{l('Page Templates')}</span>
            </div>
            <div className="space-y-2">
              {PAGE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyPageTemplate(template)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${darkMode ? 'border-white/10 hover:border-amber-400/40 hover:bg-amber-400/5' : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50'}`}
                >
                  <span className="block text-xs font-semibold">{l(template.name)}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-gray-500">{l(template.description)}</span>
                  <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-amber-500">{l('Use template')}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Copy className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold">{l('Section Templates')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {SECTION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => addSectionTemplate(template)}
                  className={`rounded-lg border px-2.5 py-2 text-left transition ${darkMode ? 'border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5' : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50'}`}
                >
                  <span className="block text-xs font-semibold">{l(template.name)}</span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-gray-500">{l(template.description)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-sky-500/20 bg-sky-500/5' : 'border-sky-200 bg-sky-50/60'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-semibold">{l('My Sections')}</span>
              </div>
              <button type="button" onClick={() => void saveSelectedSectionAsReusable()} disabled={!selectedSection || reusableBusy} className="rounded px-2 py-1 text-[9px] font-bold text-sky-400 hover:bg-sky-500/10 disabled:opacity-40">{l('Save selected')}</button>
            </div>
            <p className="mb-2 text-[9px] leading-4 text-gray-500">{l("Reusable section templates are saved to your account when signed in, or this browser when signed out.")}</p>
            {reusableError && <p className="mb-2 text-[10px] text-amber-400">{l(reusableError)}</p>}
            {reusableBusy && !reusableSections.length ? (
              <p className="text-[10px] text-gray-500">{l('Loading templates…')}</p>
            ) : reusableSections.length ? (
              <div className="max-h-44 space-y-1.5 overflow-auto pr-1">
                {reusableSections.map((template) => (
                  <div key={template.id} className={`flex items-center gap-1 rounded-lg border p-1.5 ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-100 bg-white'}`}>
                    <button type="button" onClick={() => insertReusableSection(template)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[10px] font-semibold">{template.title}</span>
                      <span className="block text-[9px] text-gray-500">{SECTION_LABELS[template.section.type]} · Use template</span>
                    </button>
                    <button type="button" onClick={() => void deleteReusableSection(template)} className="rounded p-1 text-rose-400 hover:bg-rose-500/10" title={l('Delete template')}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-gray-500">{l('No saved sections yet.')}</p>
            )}
          </div>

          </>
          )}

            </>
          )}

          {builderPanel === 'add' && (
          <details open className={`rounded-xl border ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60'}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Plus className="h-4 w-4 text-violet-400" />
                {l('Add')}
              </span>
              <span className="flex items-center gap-2 text-[9px] text-gray-500">{l('Sections & elements')}<ChevronDown className="h-3.5 w-3.5" /></span>
            </summary>
            <div className="space-y-3 border-t border-violet-500/10 p-3">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{l('Popular sections')}</p>
                  <span className="text-[9px] text-gray-600">{l('Start simple')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['hero', 'features', 'services', 'contact'] as SectionType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => addSection(type)}
                      className={`rounded-lg border px-2 py-2 text-left text-[11px] transition-colors ${
                        darkMode
                          ? 'border-white/10 text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5"><Plus className="h-3 w-3 text-violet-400" />{SECTION_LABELS[type]}</span>
                    </button>
                  ))}
                </div>
                <details className={`mt-2 rounded-lg border ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white'}`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold text-gray-500 [&::-webkit-details-marker]:hidden">
                    <span>{l('More sections')}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </summary>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-2.5">
                    {(['about', 'pricing', 'testimonials', 'footer'] as SectionType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => addSection(type)}
                        className={`rounded-lg border px-2 py-2 text-left text-[10px] transition-colors ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      >
                        + {SECTION_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              {selectedSection && (
                <details className={`rounded-lg border ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white'}`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5 text-violet-400" />{l('Add element')}</span>
                    <span className="flex items-center gap-2 text-[9px] text-gray-500">{l('Common first')}<ChevronDown className="h-3.5 w-3.5" /></span>
                  </summary>
                  <div className="border-t border-white/10 p-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      {(['heading', 'text', 'button', 'image', 'video', 'list'] as WebsiteElementType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => addElement(type)}
                          className={`rounded-lg border px-2 py-2 text-[10px] ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        >
                          + {ELEMENT_LABELS[type]}
                        </button>
                      ))}
                    </div>
                    <details className={`mt-2 rounded-lg border ${darkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[9px] font-semibold text-gray-500 [&::-webkit-details-marker]:hidden">
                        <span>{l('Advanced elements')}</span>
                        <ChevronDown className="h-3 w-3" />
                      </summary>
                      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-2">
                        {(['divider', 'spacer', 'accordion', 'tabs', 'gallery', 'embed', 'code', 'countdown', 'stats', 'testimonials-slider'] as WebsiteElementType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => addElement(type)}
                            className={`rounded-lg border px-2 py-2 text-[9px] ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'border-gray-200 text-gray-600 hover:bg-white'}`}
                          >
                            + {ELEMENT_LABELS[type]}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                </details>
              )}

              <p className="text-[9px] leading-relaxed text-gray-500">{l('Choose a section first. Add individual elements only when you need more control.')}</p>
            </div>
          </details>

          )}

          {builderPanel === 'layers' && (
          <div className={`mt-3 rounded-xl border ${darkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div>
                <span className="text-xs font-semibold">{l('Layers')}</span>
                <p className="mt-0.5 text-[9px] text-gray-500">{l('Select a section to see its elements.')}</p>
              </div>
              <span className="text-[9px] text-gray-500">{sections.length} {l('sections')}</span>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-auto border-t border-white/10 p-2.5">
              {sections.map((section, sectionIndex) => (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(section.id); setSelectedElementId(null); }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs transition ${selectedId === section.id ? (darkMode ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-100 text-violet-700') : (darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-white')}`}
                  >
                    <span className="min-w-0 truncate">{sectionIndex + 1}. {SECTION_LABELS[section.type]}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-1 text-[9px] text-gray-500">
                      {section.elements.length}
                      <ChevronRight className={`h-3 w-3 transition-transform ${selectedId === section.id ? 'rotate-90' : ''}`} />
                    </span>
                  </button>
                  {selectedId === section.id && (
                    <div className="ml-3 mt-1 space-y-1 border-l border-violet-500/20 pl-2">
                      {section.elements.length ? section.elements.map((element, elementIndex) => (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() => { setSelectedId(section.id); setSelectedElementId(element.id); setInspectorOpen(true); }}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] transition ${selectedElementId === element.id ? (darkMode ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-100 text-violet-700') : (darkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'text-gray-600 hover:bg-white')}`}
                        >
                          <span className="w-4 shrink-0 text-[9px] text-gray-500">{elementIndex + 1}</span>
                          <span className="truncate">{ELEMENT_LABELS[element.type]}{element.content ? ` · ${element.content}` : ''}</span>
                        </button>
                      )) : (
                        <p className="px-2 py-1 text-[9px] text-gray-600">{l('No elements in this section.')}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          )}

          {builderPanel === 'add' && (
            <div className="mt-3 space-y-3">
          <div className={`mt-3 overflow-hidden rounded-2xl border shadow-sm ${darkMode ? 'border-white/10 bg-[#0d1220]/80' : 'border-gray-200 bg-white'}`}>
            <div className={`flex items-start justify-between gap-3 border-b px-3.5 py-3 ${darkMode ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              <div className="min-w-0">
                <span className="flex items-center gap-2 text-xs font-black">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  </span>
                  {l('Tayar AI Builder')}
                </span>
                <p className="mt-1 pl-9 text-[8px] leading-relaxed text-gray-500">{l('Build, refine and undo with natural language.')}</p>
              </div>
              <span className="mt-0.5 rounded-full border border-violet-500/15 bg-violet-500/[0.06] px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-violet-400">{l("Agent")}</span>
            </div>

            <div className="space-y-3.5 p-3.5">
              <div className="max-h-36 space-y-2 overflow-auto pr-1">
                {aiMessages.slice(-4).map((message) => (
                  <div key={message.id} className={`rounded-xl border px-3 py-2.5 text-[10px] leading-relaxed ${message.role === 'user' ? (darkMode ? 'ml-7 border-violet-500/10 bg-violet-500/[0.09] text-violet-50' : 'ml-7 border-violet-100 bg-violet-50 text-violet-900') : (darkMode ? 'mr-2 border-white/[0.06] bg-white/[0.025] text-gray-300' : 'mr-2 border-gray-100 bg-gray-50/80 text-gray-700')}`}>
                    <span className={`mb-1.5 block text-[7px] font-black uppercase tracking-[0.14em] ${message.role === 'user' ? 'text-violet-400' : 'text-gray-500'}`}>{message.role === 'user' ? l('You') : 'Tayar AI'}</span>
                    {l(message.content)}
                  </div>
                ))}
              </div>

              {aiBusy && (
                <div className="grid grid-cols-4 gap-1.5">
                  {AI_BUILDER_STAGE_ORDER.map((stage, index) => {
                    const activeIndex = AI_BUILDER_STAGE_ORDER.indexOf(aiStage === 'idle' || aiStage === 'error' ? 'planning' : aiStage);
                    const complete = aiStage === 'ready' || index < activeIndex;
                    const active = aiStage === stage && aiStage !== 'ready';
                    return (
                      <div key={stage} className={`rounded-lg border px-1 py-1.5 text-center text-[7px] font-black uppercase tracking-wide ${complete ? 'border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-400' : active ? 'border-violet-500/20 bg-violet-500/[0.08] text-violet-300' : darkMode ? 'border-white/[0.06] text-gray-600' : 'border-gray-100 text-gray-400'}`}>
                        {complete ? '✓ ' : ''}{l(stage === 'planning' ? 'Planning' : stage === 'building' ? 'Building' : stage === 'styling' ? 'Styling' : 'Ready')}
                      </div>
                    );
                  })}
                </div>
              )}

              {aiStage === 'ready' && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.035] px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[8px] font-black text-emerald-400">
                    <Check className="h-3 w-3" />
                    {l('Safe patch mode')}
                  </span>
                  <span className="text-right text-[8px] text-gray-500">{l('Unrelated content stays intact')}</span>
                </div>
              )}

              {aiPlan && (
                <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/[0.06] bg-black/10' : 'border-gray-100 bg-gray-50/70'}`}>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-gray-500">{l('Website plan')}</p>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-gray-500">{aiPlan.summary}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {aiPlan.pages.map((page) => (
                      <span key={page.name} className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${darkMode ? 'border-white/[0.07] bg-white/[0.025] text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>
                        {page.name} · {page.sections}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                {(aiStage === 'ready' ? [
                  'Make the hero more premium and concise',
                  'Add a pricing section before contact',
                  'Make selected heading smaller on mobile',
                  'Make selected button full width on mobile',
                  'Make selected section two columns',
                  'Put selected element in column two',
                  'Make selected element span two columns',
                  'Duplicate selected element and keep it editable',
                  'Turn selected element into a reusable component',
                  'Detach selected component instance',
                  'Fix accessibility issues across the website',
                  'Repair mobile and tablet layout without changing desktop',
                  'Polish this page for responsive, accessibility and visual consistency',
                  'Review this site like a premium launch and suggest the next safe edit',
                  'Duplicate this section',
                  'Duplicate the current page',
                  'Make global typography more premium',
                  'Make the header compact and sticky',
                  'Repair mobile spacing on this page without changing desktop',
                  'Make all CTAs on this page visually consistent',
                  'Improve this page without changing unrelated sections',
                  'Wrap selected element in a glass card',
                  'Animate selected heading with fade-up',
                  'Give selected button a premium hover effect',
                  'Make the hero use a subtle gradient',
                  'Add a required phone field to contact form',
                  'Add a second button after the selected element',
                  'Move the selected element after the text',
                  'Remove the selected element',
                  'Reduce selected section spacing on mobile',
                  'Reduce the hero height on mobile',
                  'Use a dark background with gold accents',
                  'Rewrite the current page in Swedish',
                ] : [
                  'Modern business website with Home, Services, About and Contact',
                  'Premium landing page focused on conversions and trust',
                  'Clean portfolio website with projects, about and contact',
                ]).map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => { setAiPrompt(example); setAiError(''); }}
                    disabled={aiBusy}
                    className={`min-h-8 rounded-lg border px-2 py-1.5 text-left text-[8px] font-semibold leading-tight transition ${darkMode ? 'border-white/[0.07] bg-white/[0.02] text-gray-400 hover:border-violet-500/20 hover:bg-violet-500/[0.05] hover:text-violet-300' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'} disabled:opacity-40`}
                  >
                    {example.split(' ').slice(0, 4).join(' ')}
                  </button>
                ))}
              </div>

              <textarea
                value={aiPrompt}
                onChange={(e) => {
                  setAiPrompt(e.target.value);
                  setAiError('');
                  if (aiStage === 'error') setAiStage('idle');
                }}
                rows={4}
                placeholder={aiStage === 'ready'
                  ? 'Ask Tayar to change this website without rebuilding it...'
                  : 'Describe the website: business, audience, pages, style, language, location and goal...'}
                className={`w-full resize-none rounded-xl border px-3.5 py-3 text-xs leading-relaxed outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 ${darkMode ? 'border-white/[0.08] bg-black/15 text-white placeholder:text-gray-600' : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'}`}
              />

              {aiStage === 'ready' ? (
                <div className="space-y-2">
                  <button
                    onClick={() => void applyAIChange()}
                    disabled={!aiPrompt.trim() || aiBusy || aiQualityBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-xs font-black text-white shadow-sm shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {aiBusy ? 'Applying AI change...' : l('Apply AI change')}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void generateWithAI(false)}
                      disabled={!aiPrompt.trim() || aiBusy || aiQualityBusy}
                      className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold transition ${darkMode ? 'border-white/[0.07] text-gray-400 hover:bg-white/[0.03]' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'} disabled:opacity-40`}
                    >
                      {l('Rebuild from prompt')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBuilderPanel('layers'); setLeftSidebarOpen(true); setInspectorOpen(true); }}
                      className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold transition ${darkMode ? 'border-white/[0.07] text-gray-300 hover:bg-white/[0.03]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      {l('Edit manually')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void generateRealImage()}
                      disabled={aiBusy || aiQualityBusy || !selectedSection}
                      className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold transition ${darkMode ? 'border-cyan-500/15 bg-cyan-500/[0.03] text-cyan-300 hover:bg-cyan-500/[0.07]' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'} disabled:opacity-40`}
                    >
                      {l('Generate selected image')}
                    </button>
                    <button
                      type="button"
                      onClick={aiQualityBusy ? stopAIQualityCheck : () => void runAIQualityCheck()}
                      disabled={aiBusy}
                      className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold transition ${darkMode ? 'border-emerald-500/15 bg-emerald-500/[0.03] text-emerald-300 hover:bg-emerald-500/[0.07]' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-40`}
                    >
                      {aiQualityBusy ? l('Stop check') : l('Quality check')}
                    </button>
                  </div>
                  {aiUndoSnapshot && (
                    <button
                      type="button"
                      onClick={undoLastAIChange}
                      disabled={aiBusy}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[9px] font-bold transition ${darkMode ? 'border-amber-500/15 bg-amber-500/[0.035] text-amber-300 hover:bg-amber-500/[0.07]' : 'border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100'} disabled:opacity-40`}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {l('Undo AI change')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => void generateWithAI(true)}
                    disabled={!aiPrompt.trim() || aiBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-xs font-black text-white shadow-sm shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {aiBusy ? aiStageStatus : l('Build with Tayar Agent')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateWithAI(false)}
                    disabled={!aiPrompt.trim() || aiBusy}
                    className={`w-full rounded-xl border px-3 py-2 text-[9px] font-bold transition ${darkMode ? 'border-white/[0.07] text-gray-400 hover:bg-white/[0.03]' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'} disabled:opacity-40`}
                  >
                    {l('Fast build · no generated images')}
                  </button>
                </div>
              )}

              {aiError && <p className={`rounded-lg border px-2.5 py-2 text-[9px] leading-relaxed ${darkMode ? 'border-red-500/15 bg-red-500/[0.04] text-red-300' : 'border-red-100 bg-red-50 text-red-600'}`}>{l(aiError)}</p>}
              <p className="px-1 text-[8px] leading-relaxed text-gray-600">{l('AI creates and patches real Tayar pages and sections. Follow-up changes preserve unrelated content and remain editable in the visual builder.')}</p>
            </div>
          </div>

          <details className={`mt-3 rounded-xl border ${darkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[10px] font-semibold text-gray-500 [&::-webkit-details-marker]:hidden">
              <span>{l('Developer export')}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className="border-t border-white/10 p-3">
              <button
                onClick={copyHtml}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied HTML' : 'Copy HTML'}
              </button>
            </div>
          </details>
            </div>
          )}
          </div>
        </aside>
  );
}
