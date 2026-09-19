Warning: truncated output (original token count: 199968)
Total output lines: 15985

import { arrangeCanvasElements, settledCanvasElementRect } from './core/editor-arrangement';
import { useLocalizer } from '@/lib/ui-localization';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createAIService } from '@/lib/ai/service';
import { usePreferences, type Language } from '@/context/PreferencesContext';
import { useAuth } from '@/context/AuthContext';
import {
  buildPreviewSiteBaseUrl,
  buildPreviewSiteUrl,
  buildPublishedSiteBaseUrl,
  buildPublishedSiteUrl,
  normalizePublishedSiteUrl,
} from '@/lib/published-site-url';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Save,
  RotateCcw,
  Type,
  Palette,
  Eye,
  Sparkles,
  Download,
  Copy,
  ExternalLink,
  Link,
    Globe,
  Check,
  History as HistoryIcon,
  Inbox,
  BarChart3,
  Images,
  Upload,
} from 'lucide-react';

interface WebsiteBuilderToolProps {
  darkMode: boolean;
  projectId?: string | null;
}

import type { Device, ElementAnimation, ElementShadow, SectionBackgroundMode, SectionBackgroundPosition, SectionBackgroundSize, SectionContentWidth, SectionLayout, SectionLayoutAlign, SectionResponsiveStyle, SectionType, WebsiteBrand, WebsiteElement, WebsiteElementContainer, WebsiteElementType, WebsiteFormField, WebsiteFormFieldType, WebsiteSEO, WebsiteSection } from './core/types';
import { ELEMENT_LABELS, SECTION_LABELS, createDefaultContactFormFields, createElement, createSection, defaultBrand, defaultSEO, defaultSections, normalizeSection } from './core/defaults';
import { resolveWebsiteBuilderV2Flags } from './core/editor-feature-flags';
import { WebsiteBuilderV2Bridge } from './v2-ui/WebsiteBuilderV2Bridge';
import { EditorStore } from './core/editor-store';
import type { EditorNativeOperation } from './core/editor-native-operation';
import type { EditorSelection } from './core/editor-selection';
import type { EditorPageLike, EditorSymbolLike } from './core/editor-model';
import {
  DEFAULT_EDITOR_PROJECT_ACCESS,
  createEditorProjectAccessFallback,
  normalizeEditorProjectAccess,
  resolveEditorProjectOwnerId,
  type EditorProjectAccess,
} from './core/editor-project-access';
import {
  clearLocalWebsiteProjects,
  hasRecoveryWebsiteProject,
  loadActiveWebsiteProjectId,
  loadLocalWebsiteProject,
  loadRecoveryWebsiteProject,
  saveActiveWebsiteProjectId,
  saveLocalWebsiteProject,
  saveRecoveryWebsiteProject,
} from './core/editor-project-lifecycle';
import { createWebsiteProjectInCloud, listWebsiteProjectsInCloud, updateWebsiteProjectInCloud, updateWebsiteProjectPublicationState } from './services/projectCloudService';
import {
  archivePublishedWebsiteFiles,
  downloadPublishedWebsiteFile,
  removePublishedWebsiteFiles,
  removeStalePublishedWebsiteFiles,
  replacePublishedWebsiteFiles,
  restorePublishedWebsiteSnapshot,
  snapshotPublishedWebsiteFiles,
  uploadPublishedWebsiteBlob,
  uploadPublishedWebsiteFolderFiles,
  verifyPublishedRoute,
} from './services/publishedWebsiteService';
import { deleteReusableSectionInCloud, listReusableSectionsInCloud, saveReusableSectionInCloud } from './services/reusableSectionService';
import { createWebsitePublishVersion, deleteWebsitePublishVersionArchive, discardWebsitePublishVersionArchive, listWebsitePublishVersions } from './services/publishVersionService';
import { bulkUpdateWebsiteLeadStage, deleteWebsiteLead, listWebsiteLeads, updateWebsiteLeadCrm, updateWebsiteLeadStatus, updateWebsiteLeadsByStatus } from './services/websiteLeadService';
import { listWebsiteAnalyticsEvents } from './services/websiteAnalyticsService';
import { summarizeWebsiteAnalytics } from './core/website-analytics-summary';
import { buildProjectSnapshotDiffSummary } from './core/project-release-metrics';
import { getWebsiteLeadPhone, getWebsiteLeadSource } from './core/website-lead-utils';
import { deleteWebsiteMediaFile, getWebsiteMediaPublicUrl, listWebsiteMediaFiles, uploadWebsiteMediaFile } from './services/websiteMediaService';
import { getWebsiteProjectTeamAccess } from './services/websiteAccessService';
import { createWebsiteCheckoutSession, getWebsiteBuilderBillingState, openWebsiteBillingPortalSession } from './services/websiteBillingService';
import { normalizeWebsiteProjectLoad } from './core/project-normalization';
import {
  DEFAULT_DELIVERY_CONFIG,
  normalizeDeliveryConfig,
  type DeliveryStatus,
  type WebsiteDeliveryConfig,
} from './core/delivery-config';
import { languageCodeLabel, normalizePageLanguage, normalizeSlug, PAGE_LANGUAGE_LABELS } from './core/project-identifiers';
import { createProjectHistoryEntry, decideEditorAutosave } from './core/editor-autosave-policy';
import {
  resolveCanvasDragPosition,
  type CanvasAlignmentTargets,
  type CanvasBounds,
  type CanvasSnapGuides,
} from './core/editor-canvas-geometry';
import {
  editorAIContextMatches,
  editorAIProjectIdentityMatches,
  type EditorAIAsyncContext,
} from './core/editor-ai-operation-context';
import {
  convertLegacyAIGlobalOperationToNative,
  convertLegacyAIAddOperationToNative,
  convertLegacyAIPageOperationToNative,
  convertLegacyAIPageUpdateOperationToNative,
  convertLegacyAIStructuralOperationToNative,
  convertLegacyAIUpdateOperationToNative,
  isLegacyAIGlobalNativeAction,
  isLegacyAIPageNativeAction,
  isLegacyAIStructuralNativeAction,
  isLegacyAIUpdateNativeAction,
} from './core/editor-ai-native-bridge';
import { applyEditorAIWorkingNativeOperations } from './core/editor-ai-working-project';
import {
  humanizeAIWebsitePatchAction,
  aiWebsitePatchReviewKind,
  mergeAIWebsitePatchReviewKind,
  describeAIWebsitePatchTarget,
  describeAIWebsitePatchFields,
  type AIWebsitePageGeneration,
  type AIWebsiteGeneration,
  type AIWebsitePatchChanges,
  type AIWebsitePatchOperation,
  type AIQualityReview,
  type AIWebsiteAgentPlanStep,
  type AIWebsiteAgentPlan,
  type AIWebsitePlanReview,
  type AIWebsitePatchReviewItem,
  type AIWebsiteCanvasPreview,
  type AIWebsitePatchReview,
} from './core/editor-ai-patch-review';
import {
  type AIEditScopeTarget,
  aiOperationMatchesEditScope,
  type AIWebsiteAgentReviewFinding,
  type AIWebsiteAgentReview,
  type AIWebsitePatch,
  type AIBuilderStage,
  type AIEditScope,
  type AIBuilderMessage,
  buildAIConversationContext,
  AI_BUILDER_STAGE_ORDER,
} from './core/editor-ai-scope';
import {
  aiWebsitePatchReviewItemIsGlobal,
  aiWebsitePatchReviewItemTargetsPage,
  aiWebsitePatchReviewItemTargetPage,
  reconcileAIWebsitePatchReviewTargets,
} from './core/editor-ai-review-targets';
import { buildAIEditableSnapshotData } from './core/editor-ai-editable-snapshot';
import { createWebsiteBuilderOutput } from './core/website-builder-output';
import { buildAuditReportText, buildDeliveryReportText, buildV1LaunchReportText } from './core/website-builder-reports';
import { buildWebsiteAnalyticsCsv, buildWebsiteLeadsCsv, buildWebsiteProjectBackupText } from './core/website-builder-export-data';
import {
  type WebsitePage,
  type WebsiteClipboardContext,
  type WebsiteClipboard,
  type AIWebsiteUndoSnapshot,
  type CloudWebsiteProject,
  type ProjectHistoryEntry,
  type LeadStage,
  type WebsiteLead,
  type WebsiteAnalyticsEvent,
  type WebsiteMediaAsset,
  type WebsiteTheme,
  type WebsiteHeaderConfig,
  type WebsiteFooterConfig,
  type WebsiteSiteEnhancements,
  type WebsiteProductionConfig,
  type WebsiteSymbol,
  type AIWebsiteCandidatePreview,
  type PersistedWebsiteProject,
  isWebsiteSymbol,
  type WebsitePublishVersion,
  type LiveVerification,
  type BillingPlan,
  type BillingFeature,
  type BillingState,
  type ReusableSectionTemplate,
} from './core/website-builder-model';
import {
  REUSABLE_SECTIONS_KEY,
  FONT_OPTIONS,
  DEFAULT_THEME,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_FOOTER_CONFIG,
  DEFAULT_SITE_ENHANCEMENTS,
  DEFAULT_PRODUCTION_CONFIG,
  FREE_BILLING_ENTITLEMENTS,
  BUSINESS_BILLING_ENTITLEMENTS,
  BILLING_PLAN_DETAILS,
  sanitizeRobotsRules,
  normalizeProductionConfig,
  normalizeHeaderConfig,
  normalizeFooterConfig,
  normalizeSiteEnhancements,
  normalizeTheme,
  applyThemeToSection,
  resolveEffectiveProductionConfig,
  normalizeBillingStatePayload,
} from './core/website-builder-config';
import {
  sectionColumnCount,
  sectionLayoutGap,
  sectionLayoutAlign,
  sectionBackgroundMode,
  sectionBackgroundPosition,
  sectionBackgroundSize,
  sectionContentWidth,
  sectionVisualNumber,
  safeSectionColor,
  elementColumn,
  clampElementNumber,
  cloneSymbolElement,
  normalizeElementAnimation,
  cloneSectionWithFreshIds,
  createPage,
  type PageTemplateDefinition,
  type SectionTemplateDefinition,
  PAGE_TEMPLATES,
  SECTION_TEMPLATES,
  createSectionFromTemplate,
  normalizeAnchorId,
  sectionDomId,
  safeFormRedirectHref,
  escapeHtml,
  normalizeFormFieldName,
  normalizeSiteUrl,
  downloadTextFile,
  buildCsv,
  crc32,
  createZipBlob,
  effectiveStyle,
  effectiveSectionStyle,
} from './core/website-builder-rendering';
import { SectionPreview } from './components/SectionPreview';

const LAUNCH_CENTER_SEEN_KEY = 'tayar.website-builder.launch-center-seen.v1';
const LAUNCH_MANUAL_CHECKS_KEY = 'tayar.website-builder.launch-manual-checks.v1';


export default function WebsiteBuilderTool({
  darkMode,
  projectId = null,
}: WebsiteBuilderToolProps) {
  const l = useLocalizer();
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const editorV2Flags = useMemo(resolveWebsiteBuilderV2Flags, []);
  const [sections, setSections] = useState<WebsiteSection[]>(defaultSections);
  const [pages, setPages] = useState<WebsitePage[]>([
    { id: 'page-home', name: 'Home', slug: 'home', sections: defaultSections, showInNavigation: true },
  ]);
  const [activePageId, setActivePageId] = useState('page-home');
  const [homePageId, setHomePageId] = useState('page-home');

const [brand, setBrand] = useState<WebsiteBrand>(defaultBrand);
  const [theme, setTheme] = useState<WebsiteTheme>(DEFAULT_THEME);
  const [headerConfig, setHeaderConfig] = useState<WebsiteHeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [footerConfig, setFooterConfig] = useState<WebsiteFooterConfig>(DEFAULT_FOOTER_CONFIG);
  const [siteEnhancements, setSiteEnhancements] = useState<WebsiteSiteEnhancements>(DEFAULT_SITE_ENHANCEMENTS);
  const [productionConfig, setProductionConfig] = useState<WebsiteProductionConfig>(DEFAULT_PRODUCTION_CONFIG);
  const [reusableSections, setReusableSections] = useState<ReusableSectionTemplate[]>([]);
  const [symbols, setSymbols] = useState<WebsiteSymbol[]>([]);
  const [reusableBusy, setReusableBusy] = useState(false);
  const [reusableError, setReusableError] = useState('');

const [seo, setSeo] = useState<WebsiteSEO>(defaultSEO);
  const [selectedId, setSelectedId] = useState<string | null>(defaultSections[0].id);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(defaultSections[0].elements[0]?.id ?? null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(defaultSections[0].elements[0]?.id ? [defaultSections[0].elements[0].id] : []);
  const [editorClipboard, setEditorClipboard] = useState<WebsiteClipboard | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [selectedFormFieldId, setSelectedFormFieldId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [advancedSiteSettingsOpen, setAdvancedSiteSettingsOpen] = useState(false);
  const [builderPanel, setBuilderPanel] = useState<'add' | 'pages' | 'layers'>('add');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [siteName, setSiteName] = useState('My Website');
  const [siteUrl, setSiteUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiStage, setAiStage] = useState<AIBuilderStage>('idle');
  const [aiIntent, setAiIntent] = useState<'edit' | 'build'>('edit');
  const [aiEditScope, setAiEditScope] = useState<AIEditScope>('page');
  const [aiPlan, setAiPlan] = useState<{ summary: string; pages: Array<{ name: string; sections: number }> } | null>(null);
  const [aiPlanReview, setAiPlanReview] = useState<AIWebsitePlanReview | null>(null);
  const [aiPatchReview, setAiPatchReview] = useState<AIWebsitePatchReview | null>(null);
  const [aiCandidatePreview, setAiCandidatePreview] = useState<AIWebsiteCandidatePreview | null>(null);
  const [aiMessages, setAiMessages] = useState<AIBuilderMessage[]>([
    {
      id: 'ai-welcome',
      role: 'assistant',
      content: 'Describe the website you want. I will plan the pages, build the structure and hand it to the visual editor.',
    },
  ]);
  const v2AiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiPlanApproveButtonRef = useRef<HTMLButtonElement | null>(null);
  const aiPatchApproveButtonRef = useRef<HTMLButtonElement | null>(null);
  const aiCandidateApproveButtonRef = useRef<HTMLButtonElement | null>(null);
  const [aiUndoSnapshot, setAiUndoSnapshot] = useState<AIWebsiteUndoSnapshot | null>(null);
  const [aiQualityReview, setAiQualityReview] = useState<AIQualityReview | null>(null);
  const [aiQualityBusy, setAiQualityBusy] = useState(false);
  const [aiQualityOpen, setAiQualityOpen] = useState(false);
  const [history, setHistory] = useState<ProjectHistoryEntry[]>([]);
  const [future, setFuture] = useState<ProjectHistoryEntry[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverSectionPosition, setDragOverSectionPosition] = useState<'before' | 'after' | null>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dragOverElementId, setDragOverElementId] = useState<string | null>(null);
  const [dragOverElementPosition, setDragOverElementPosition] = useState<'before' | 'after' | null>(null);
  const [canvasSnapGuide, setCanvasSnapGuide] = useState<({ sectionId: string } & CanvasSnapGuides) | null>(null);
  const draggedSectionRef = useRef<string | null>(null);
  const draggedSectionPageRef = useRef<string | null>(null);
  const draggedElementRef = useRef<string | null>(null);
  const draggedElementSectionRef = useRef<string | null>(null);
  const freeElementDragRef = useRef<{
    pageId: string;
    device: Device;
    sectionId: string;
    elementId: string;
    symbolId?: string;
    startClientX: number;
    startClientY: number;
    canvasScale: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    groupTargets: Array<{
      id: string;
      symbolId?: string;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }>;
    elementBounds?: CanvasBounds;
    sectionBounds?: CanvasBounds;
    alignmentTargets?: CanvasAlignmentTargets;
    snapHorizontal: boolean;
    snapVertical: boolean;
    started: boolean;
    snapHorizontalPosition?: number;
    snapVerticalPosition?: number;
  } | null>(null);
  const canvasNudgeSessionRef = useRef<string | null>(null);
  const canvasResizeSessionRef = useRef<string | null>(null);
  const [cloudProjects, setCloudProjects] = useState<CloudWebsiteProject[]>([]);
  const [cloudProjectsLoaded, setCloudProjectsLoaded] = useState(false);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [projectTeamAccess, setProjectTeamAccess] = useState<EditorProjectAccess>(DEFAULT_EDITOR_PROJECT_ACCESS);
  const activeProjectOwnerId = useMemo(() => resolveEditorProjectOwnerId({
    currentUserId: user?.id,
    projectId: cloudProjectId,
    activeProjectId: cloudProjectId,
    activeOwnerId: projectTeamAccess.ownerId,
    projects: cloudProjects,
  }), [user?.id, cloudProjectId, cloudProjects, projectTeamAccess.ownerId]);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [releaseHistoryOpen, setReleaseHistoryOpen] = useState(false);
  const [publishVersions, setPublishVersions] = useState<WebsitePublishVersion[]>([]);
  const [publishVersionsLoading, setPublishVersionsLoading] = useState(false);
  const [publishVersionsError, setPublishVersionsError] = useState('');
  const [releaseNote, setReleaseNote] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewToken, setPreviewToken] = useState('');
  const [previewCreatedAt, setPreviewCreatedAt] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [lastPublishedVersionId, setLastPublishedVersionId] = useState<string | null>(null);
  const [lastPublishedFingerprint, setLastPublishedFingerprint] = useState('');
  const [liveVerification, setLiveVerification] = useState<LiveVerification>('idle');
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryConfig, setDeliveryConfig] = useState<WebsiteDeliveryConfig>(DEFAULT_DELIVERY_CONFIG);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingState, setBillingState] = useState<BillingState>({
    plan: 'free',
    entitlements: FREE_BILLING_ENTITLEMENTS,
    subscription: null,
    usage: { websiteProjects: 0, pages: 0, releases: 0, leads: 0, analyticsEvents: 0 },
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [leads, setLeads] = useState<WebsiteLead[]>([]);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | WebsiteLead['status']>('all');
  const [leadStageFilter, setLeadStageFilter] = useState<'all' | LeadStage>('all');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<WebsiteAnalyticsEvent[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [mediaAssets, setMediaAssets] = useState<WebsiteMediaAsset[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [cloudSyncFailed, setCloudSyncFailed] = useState(false);
  const [launchCenterOpen, setLaunchCenterOpen] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem(LAUNCH_CENTER_SEEN_KEY) !== '1'; } catch { return false; }
  });
  const [launchCheckBusy, setLaunchCheckBusy] = useState(false);
  const [launchLastCheckedAt, setLaunchLastCheckedAt] = useState<string | null>(null);
  const [launchManualChecks, setLaunchManualChecks] = useState<Record<'stripe' | 'domain' | 'support', boolean>>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAUNCH_MANUAL_CHECKS_KEY) || '{}');
      return { stripe: parsed?.stripe === true, domain: parsed?.domain === true, support: parsed?.support === true };
    } catch {
      return { stripe: false, domain: false, support: false };
    }
  });
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => hasRecoveryWebsiteProject());
  const lastSavedSnapshotRef = useRef('');
  const autosaveTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const newProjectIntentRef = useRef(false);
  const projectLoadSequenceRef = useRef(0);
  const savedFeedbackSequenceRef = useRef(0);
  const aiOperationSequenceRef = useRef(0);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiPlanReviewResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const aiPatchReviewResolverRef = useRef<((selectedOperationIds: string[] | null) => void) | null>(null);
  const aiPatchReviewSelectionRef = useRef<string[]>([]);
  const aiCandidatePreviewResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const aiPreparedFollowUpRef = useRef<string | null>(null);
  const aiQualityOperationSequenceRef = useRef(0);
  const aiQualityAbortControllerRef = useRef<AbortController | null>(null);
  const aiEditorContextRef = useRef<EditorAIAsyncContext | null>(null);
  const aiUndoContextRef = useRef<EditorAIAsyncContext | null>(null);
  const aiQualityReviewContextRef = useRef<EditorAIAsyncContext | null>(null);
  const cloudProjectsRefreshSequenceRef = useRef(0);
  const cloudProjectsRefreshAbortControllerRef = useRef<AbortController | null>(null);
  const publishOperationSequenceRef = useRef(0);
  const previewOperationSequenceRef = useRef(0);
  const liveVerificationSequenceRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const reusableRefreshSequenceRef = useRef(0);
  const reusableOperationSequenceRef = useRef(0);
  const mediaRefreshSequenceRef = useRef(0);
  const mediaUploadSequenceRef = useRef(0);
  const mediaDeleteSequenceRef = useRef(0);
  const mediaGenerationSequenceRef = useRef(0);
  const billingRefreshSequenceRef = useRef(0);
  const billingOperationSequenceRef = useRef(0);
  const saveProjectRef = useRef<(options?: { automatic?: boolean; createHistory?: boolean }) => Promise<boolean>>(async () => false);

  activeUserIdRef.current = user?.id ?? null;

  useEffect(() => {
    reusableOperationSequenceRef.current += 1;
    mediaUploadSequenceRef.current += 1;
    mediaDeleteSequenceRef.current += 1;
    mediaGenerationSequenceRef.current += 1;
    billingRefreshSequenceRef.current += 1;
    billingOperationSequenceRef.current += 1;
    aiOperationSequenceRef.current += 1;
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    aiPlanReviewResolverRef.current?.(false);
    aiPlanReviewResolverRef.current = null;
    aiPatchReviewResolverRef.current?.(null);
    aiPatchReviewResolverRef.current = null;
    aiPatchReviewSelectionRef.current = [];
    aiCandidatePreviewResolverRef.current?.(false);
    aiCandidatePreviewResolverRef.current = null;
    aiQualityOperationSequenceRef.current += 1;
    aiQualityAbortControllerRef.current?.abort();
    aiQualityAbortControllerRef.current = null;
    aiUndoContextRef.current = null;
    aiQualityReviewContextRef.current = null;
    setReusableBusy(false);
    setMediaLoading(false);
    setMediaUploading(false);
    setBillingLoading(false);
    setBillingBusy(false);
    setAiBusy(false);
    setAiPlanReview(null);
    setAiPatchReview(null);
    setAiCandidatePreview(null);
    setAiQualityBusy(false);
  }, [user?.id]);

  const cancelPendingProjectPersistence = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
      saveAbortControllerRef.current = null;
    }

    saveInFlightRef.current = false;
    draggedSectionRef.current = null;
    draggedSectionPageRef.current = null;
    draggedElementRef.current = null;
    draggedElementSectionRef.current = null;
    freeElementDragRef.current = null;
    canvasNudgeSessionRef.current = null;
    canvasResizeSessionRef.current = null;
    savedFeedbackSequenceRef.current += 1;
    publishOperationSequenceRef.current += 1;
    previewOperationSequenceRef.current += 1;
    liveVerificationSequenceRef.current += 1;
    aiOperationSequenceRef.current += 1;
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    aiPlanReviewResolverRef.current?.(false);
    aiPlanReviewResolverRef.current = null;
    aiPatchReviewResolverRef.current?.(null);
    aiPatchReviewResolverRef.current = null;
    aiPatchReviewSelectionRef.current = [];
    aiCandidatePreviewResolverRef.current?.(false);
    aiCandidatePreviewResolverRef.current = null;
    aiQualityOperationSequenceRef.current += 1;
    aiQualityAbortControllerRef.current?.abort();
    aiQualityAbortControllerRef.current = null;
    aiUndoContextRef.current = null;
    aiQualityReviewContextRef.current = null;
    setCloudBusy(false);
    setSaved(false);
    setAiPlanReview(null);
    setAiPatchReview(null);
    setAiCandidatePreview(null);
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSectionPosition(null);
    setDraggedElementId(null);
    setDragOverElementId(null);
    setDragOverElementPosition(null);
    setCanvasSnapGuide(null);
    setPublishBusy(false);
    setPreviewBusy(false);
    setPublishVersionsLoading(false);
    setLeadsLoading(false);
    setAnalyticsLoading(false);
    setLaunchCheckBusy(false);
    setLiveVerification('idle');
    setAiBusy(false);
    setAiQualityBusy(false);
    setAiError('');
    setAiStage('idle');
    setAiPlan(null);
    setAiUndoSnapshot(null);
    setAiQualityReview(null);
    setAiQualityOpen(false);
    setAiMessages([
      {
        id: 'ai-welcome',
        role: 'assistant',
        content: 'Describe the website you want. I will plan the pages, build the structure and hand it to the visual editor.',
      },
    ]);
  }, []);

  function snapshotProjectIdentity(snapshot: unknown): {
    hasIdentity: boolean;
    projectId: string | null;
  } {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return { hasIdentity: false, projectId: null };
    }

    const record = snapshot as Record<string, unknown>;
    const hasIdentity = Object.prototype.hasOwnProperty.call(record, 'cloudProjectId');
    const rawProjectId = record.cloudProjectId;
    const projectId =
      typeof rawProjectId === 'string' && rawProjectId.trim()
        ? rawProjectId.trim()
        : null;

    return { hasIdentity, projectId };
  }

  function snapshotConflictsWithActiveProject(
    snapshot: unknown,
    requireIdentity = false,
  ): boolean {
    const identity = snapshotProjectIdentity(snapshot);
    const activeId = cloudProjectId?.trim() || null;

    if (!identity.hasIdentity) {
      return requireIdentity && activeId !== null;
    }

    return identity.projectId !== activeId;
  }

  function prepareProjectStateRestore() {
    cancelPendingProjectPersistence();
    projectLoadSequenceRef.current += 1;
    skipNextAutosaveRef.current = true;
  }

  const selectEditorTarget = useCallback((
    sectionId: string | null,
    elementId: string | null = null,
    containerId: string | null = null,
    formFieldId: string | null = null,
  ) => {
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSelectedElementIds(elementId ? [elementId] : []);
    setSelectedContainerId(elementId ? null : containerId);
    setSelectedFormFieldId(elementId || containerId ? null : formFieldId);
  }, []);

  function clearEditorDragState() {
    draggedSectionRef.current = null;
    draggedSectionPageRef.current = null;
    draggedElementRef.current = null;
    draggedElementSectionRef.current = null;
    freeElementDragRef.current = null;
    canvasNudgeSessionRef.current = null;
    canvasResizeSessionRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSectionPosition(null);
    setDraggedElementId(null);
    setDragOverElementId(null);
    setDragOverElementPosition(null);
    setCanvasSnapGuide(null);
  }

  function showSavedFeedback(
    expectedLoadSequence = projectLoadSequenceRef.current,
    expectedUserId = user?.id ?? null,
  ) {
    const feedbackSequence = ++savedFeedbackSequenceRef.current;
    setSaved(true);

    window.setTimeout(() => {
      if (
        savedFeedbackSequenceRef.current !== feedbackSequence ||
        projectLoadSequenceRef.current !== expectedLoadSequence ||
        activeUserIdRef.current !== expectedUserId
      ) {
        return;
      }

      setSaved(false);
    }, 2000);
  }

  const getCurrentPages = useCallback(() => {
    return pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
  }, [pages, activePageId, sections]);

  const buildProjectSnapshot = useCallback(() => {
    return {
      version: 5,
      cloudProjectId,
      siteName,
      siteUrl,
      faviconUrl,
      publishedUrl,
      publishedAt,
      previewUrl,
      previewToken,
      previewCreatedAt,
      lastPublishedVersionId,
      lastPublishedFingerprint,
      activePageId,
      homePageId,
      pages: getCurrentPages(),
      brand,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig,
      deliveryConfig,
      symbols,
      seo,
      language: prefs.language,
      updatedAt: new Date().toISOString(),
    };
  }, [cloudProjectId, siteName, siteUrl, faviconUrl, publishedUrl, publishedAt, previewUrl, previewToken, previewCreatedAt, lastPublishedVersionId, lastPublishedFingerprint, activePageId, homePageId, getCurrentPages, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, deliveryConfig, symbols, seo, prefs.language]);

  const buildProjectFingerprint = useCallback(() => {
    return JSON.stringify({
      siteName,
      siteUrl,
      faviconUrl,
      publishedUrl,
      publishedAt,
      previewUrl,
      previewToken,
      previewCreatedAt,
      lastPublishedVersionId,
      lastPublishedFingerprint,
      activePageId,
      homePageId,
      pages: getCurrentPages(),
      brand,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig,
      deliveryConfig,
      symbols,
      seo,
      language: prefs.language,
    });
  }, [siteName, siteUrl, faviconUrl, publishedUrl, publishedAt, previewUrl, previewToken, previewCreatedAt, lastPublishedVersionId, lastPublishedFingerprint, activePageId, homePageId, getCurrentPages, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, deliveryConfig, symbols, seo, prefs.language]);

  const buildEditableFingerprint = useCallback(() => {
    return JSON.stringify({
      siteName,
      siteUrl,
      faviconUrl,
      homePageId,
      pages: getCurrentPages(),
      brand,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig,
      symbols,
      seo,
      language: prefs.language,
    });
  }, [siteName, siteUrl, faviconUrl, homePageId, getCurrentPages, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, symbols, seo, prefs.language]);

  const currentAIEditableFingerprint = useMemo(
    () => buildEditableFingerprint(),
    [buildEditableFingerprint],
  );

  const currentAIEditorContext: EditorAIAsyncContext = {
    loadSequence: projectLoadSequenceRef.current,
    userId: user?.id ?? null,
    routeProjectId: projectId,
    projectId: cloudProjectId,
    ownerId: activeProjectOwnerId || null,
    editableFingerprint: currentAIEditableFingerprint,
    activePageId,
    sectionId: selectedId,
    elementId: selectedElementId,
    containerId: selectedContainerId,
    formFieldId: selectedFormFieldId,
    device,
  };
  aiEditorContextRef.current = currentAIEditorContext;

  function captureAIEditorContext() {
    return { ...currentAIEditorContext };
  }

  function aiEditorContextIsCurrent(
    expected: EditorAIAsyncContext,
    requireSelection = false,
  ) {
    if (
      projectLoadSequenceRef.current !== expected.loadSequence ||
      activeUserIdRef.current !== expected.userId
    ) {
      return false;
    }

    return editorAIContextMatches(
      expected,
      aiEditorContextRef.current,
      {
        requireEditableFingerprint: true,
        requireSelection,
      },
    );
  }

  function aiProjectIdentityIsCurrent(
    expected: EditorAIAsyncContext,
  ) {
    if (
      projectLoadSequenceRef.current !== expected.loadSequence ||
      activeUserIdRef.current !== expected.userId
    ) {
      return false;
    }

    return editorAIProjectIdentityMatches(
      expected,
      aiEditorContextRef.current,
    );
  }

  function buildDeliveryFingerprint() {
    return buildEditableFingerprint();
  }

  const buildProjectData = useCallback((historyEntries: ProjectHistoryEntry[] = projectHistory) => {
    return {
      ...buildProjectSnapshot(),
      history: historyEntries,
    };
  }, [buildProjectSnapshot, projectHistory]);

  function saveRecoverySnapshot(reason: string) {
    if (saveRecoveryWebsiteProject(buildProjectData(), reason)) {
      setRecoveryAvailable(true);
    }
  }

  function restoreRecoverySnapshot() {
    try {
      const parsed = loadRecoveryWebsiteProject<PersistedWebsiteProject>();
      if (!parsed) { setRecoveryAvailable(false); return; }

      if (snapshotConflictsWithActiveProject(parsed.project, true)) {
        window.alert(l('This recovery snapshot belongs to a different project. Open that project before restoring it.'));
        return;
      }

      if (!window.confirm(`${l('Restore the recovery snapshot from')} ${parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : l('the previous edit')}?`)) return;
      saveRecoverySnapshot('before recovery restore');
      prepareProjectStateRestore();
      applyProjectData(parsed.project);
      setAutoSaveStatus('saving');
      setSaved(false);
      setOperationsOpen(false);
    } catch {
      window.alert(l('The recovery snapshot could not be restored.'));
    }
  }

  function applyProjectData(input: unknown, loadHistory = true, resetEditHistory = true) {
    const normalizedLoad = normalizeWebsiteProjectLoad(input);
    if (normalizedLoad.kind === 'invalid') return;

    const normalizedSections = normalizedLoad.sections;
    const normalizedPages = normalizedLoad.pages as WebsitePage[];

    if (normalizedLoad.kind === 'legacy-array') {
      setSections(normalizedSections);
      setPages(normalizedPages);
      setActivePageId(normalizedLoad.activePageId);
      setHomePageId(normalizedLoad.homePageId);
      setSelectedId(normalizedSections[0].id);
      setSelectedElementId(normalizedSections[0].elements[0]?.id ?? null);
      setFaviconUrl('');
      setTheme(DEFAULT_THEME);
      setHeaderConfig(DEFAULT_HEADER_CONFIG);
      setFooterConfig(DEFAULT_FOOTER_CONFIG);
      setSiteEnhancements(DEFAULT_SITE_ENHANCEMENTS);
      setProductionConfig(DEFAULT_PRODUCTION_CONFIG);
      setDeliveryConfig(DEFAULT_DELIVERY_CONFIG);
      setSymbols([]);
      setPublishedUrl('');
      setPublishedAt(null);
      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setLiveVerification('idle');
      setPublishError('');
      setPreviewError('');
      if (resetEditHistory) {
        setHistory([]);
        setFuture([]);
      }
      if (loadHistory) setProjectHistory([]);
      setSaved(false);
      return;
    }

    const parsed = normalizedLoad.parsed as PersistedWebsiteProject;

    if (normalizedLoad.kind === 'pages') {
      setPages(normalizedPages);
      setActivePageId(normalizedLoad.activePageId);
      setHomePageId(normalizedLoad.homePageId);
      setSections(normalizedSections);
    } else {
      setSections(normalizedSections);
      setPages(normalizedPages);
      setActivePageId(normalizedLoad.activePageId);
      setHomePageId(normalizedLoad.homePageId);
    }

    setSelectedId(normalizedSections[0]?.id ?? null);
    setSelectedElementId(normalizedSections[0]?.elements[0]?.id ?? null);
    setSiteName(parsed.siteName || 'My Website');
    setSiteUrl(parsed.siteUrl || '');
    setFaviconUrl(typeof parsed.faviconUrl === 'string' ? parsed.faviconUrl : '');
    setPublishedUrl(typeof parsed.publishedUrl === 'string' ? normalizePublishedSiteUrl(parsed.publishedUrl) : '');
    setPublishedAt(typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null);
    setPreviewUrl(typeof parsed.previewUrl === 'string' ? normalizePublishedSiteUrl(parsed.previewUrl) : '');
    setPreviewToken(typeof parsed.previewToken === 'string' ? parsed.previewToken : '');
    setPreviewCreatedAt(typeof parsed.previewCreatedAt === 'string' ? parsed.previewCreatedAt : null);
    setLastPublishedVersionId(typeof parsed.lastPublishedVersionId === 'string' ? parsed.lastPublishedVersionId : null);
    setLastPublishedFingerprint(typeof parsed.lastPublishedFingerprint === 'string' ? parsed.lastPublishedFingerprint : '');
    setLiveVerification('idle');
    setPublishError('');
    setPreviewError('');
    if (parsed.brand) setBrand(parsed.brand);
    setTheme(normalizeTheme(parsed.theme));
    setHeaderConfig(normalizeHeaderConfig(parsed.headerConfig));
    setFooterConfig(normalizeFooterConfig(parsed.footerConfig));
    setSiteEnhancements(normalizeSiteEnhancements(parsed.siteEnhancements));
    setProductionConfig(normalizeProductionConfig(parsed.productionConfig));
    setDeliveryConfig(normalizeDeliveryConfig(parsed.deliveryConfig));
    setSymbols(Array.isArray(parsed.symbols) ? parsed.symbols.filter(isWebsiteSymbol).slice(0, 50) : []);
    if (parsed.seo) setSeo(parsed.seo);
    if (resetEditHistory) {
      setHistory([]);
      setFuture([]);
    }
    if (loadHistory) setProjectHistory(Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : []);
    setSaved(false);
  }

  async function refreshProjectTeamAccess(projectId: string | null, expectedLoadSequence?: number) {
    const accessUserId = user?.id ?? null;
    const loadIsCurrent = () =>
      (expectedLoadSequence === undefined ||
        projectLoadSequenceRef.current === expectedLoadSequence) &&
      activeUserIdRef.current === accessUserId;

    if (!accessUserId || !projectId) {
      if (loadIsCurrent()) setProjectTeamAccess(DEFAULT_EDITOR_PROJECT_ACCESS);
      return DEFAULT_EDITOR_PROJECT_ACCESS;
    }

    const project = cloudProjects.find((item) => item.id === projectId);
    const fallback = createEditorProjectAccessFallback(project, accessUserId);

    const { data, error } = await getWebsiteProjectTeamAccess(projectId);
    if (error || !data) {
      if (loadIsCurrent()) setProjectTeamAccess(fallback);
      return fallback;
    }

    const next = normalizeEditorProjectAccess(data, fallback);
    if (loadIsCurrent()) setProjectTeamAccess(next);
    return next;
  }

  const refreshCloudProjects = useCallback(async () => {
    cloudProjectsRefreshSequenceRef.current += 1;
    const refreshSequence = cloudProjectsRefreshSequenceRef.current;
    const refreshUserId = user?.id ?? null;

    if (cloudProjectsRefreshAbortControllerRef.current) {
      cloudProjectsRefreshAbortControllerRef.current.abort();
      cloudProjectsRefreshAbortControllerRef.current = null;
    }

    if (!user) {
      cancelPendingProjectPersistence();
      projectLoadSequenceRef.current += 1;
      setCloudProjects([]);
      setCloudProjectId(null);
      setCloudError('');
      setCloudBusy(false);
      setCloudProjectsLoaded(true);
      return;
    }

    const refreshController = new AbortController();
    cloudProjectsRefreshAbortControllerRef.current = refreshController;

    const refreshIsCurrent = () =>
      !refreshController.signal.aborted &&
      cloudProjectsRefreshSequenceRef.current === refreshSequence &&
      cloudProjectsRefreshAbortControllerRef.current === refreshController &&
      activeUserIdRef.current === refreshUserId;

    setCloudProjectsLoaded(false);
    setCloudBusy(true);
    setCloudError('');

    try {
      const { data, error } = await listWebsiteProjectsInCloud(refreshController.signal);

      if (!refreshIsCurrent()) return;

      if (error) {
        setCloudError('Could not load cloud projects.');
        return;
      }

      setCloudProjects((data || []) as CloudWebsiteProject[]);
    } catch (error) {
      if (!refreshIsCurrent()) return;
      const message = error instanceof Error ? error.message : '';
      if (!/abort|cancel/i.test(message)) {
        setCloudError('Could not load cloud projects.');
      }
    } finally {
      if (refreshIsCurrent()) {
        cloudProjectsRefreshAbortControllerRef.current = null;
        setCloudBusy(false);
        setCloudProjectsLoaded(true);
      }
    }
  }, [user, cancelPendingProjectPersistence]);

  const loadLocalReusableSections = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REUSABLE_SECTIONS_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((item) => item && item.section && item.title)
        .slice(0, 30) as ReusableSectionTemplate[];
    } catch {
      return [];
    }
  }, []);

  const refreshReusableSections = useCallback(async () => {
    const refreshUserId = user?.id ?? null;
    const refreshSequence = ++reusableRefreshSequenceRef.current;
    const refreshIsCurrent = () =>
      reusableRefreshSequenceRef.current === refreshSequence &&
      activeUserIdRef.current === refreshUserId;

    setReusableError('');

    if (!refreshUserId) {
      if (refreshIsCurrent()) {
        setReusableSections(loadLocalReusableSections());
        setReusableBusy(false);
      }
      return;
    }

    setReusableBusy(true);

    const { data, error } = await listReusableSectionsInCloud(refreshUserId);

    if (!refreshIsCurrent()) return;

    if (error) {
      setReusableError('Could not load reusable sections.');
      setReusableBusy(false);
      return;
    }

    const items: ReusableSectionTemplate[] = (data || [])
      .map((item) => {
        const content = item.content as { section?: WebsiteSection } | null;
        if (!content?.section) return null;
        return {
          id: item.id,
          cloudId: item.id,
          title: item.title || SECTION_LABELS[content.section.type],
          section: normalizeSection(content.section),
          updatedAt: item.updated_at,
        } as ReusableSectionTemplate;
      })
      .filter((item): item is ReusableSectionTemplate => Boolean(item));

    setReusableSections(items);
    setReusableBusy(false);
  }, [user?.id, loadLocalReusableSections]);

  async function saveSelectedSectionAsReusable() {
    if (!selectedSection) return;
    const title = window.prompt('Template name', selectedSection.title || SECTION_LABELS[selectedSection.type])?.trim();
    if (!title) return;

    setReusableError('');
    const savedSection = JSON.parse(JSON.stringify(selectedSection)) as WebsiteSection;
    const operationUserId = user?.id ?? null;

    if (!operationUserId) {
      const item: ReusableSectionTemplate = {
        id: `local-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        section: savedSection,
        updatedAt: new Date().toISOString(),
      };
      const next = [item, ...reusableSections].slice(0, 30);
      setReusableSections(next);
      localStorage.setItem(REUSABLE_SECTIONS_KEY, JSON.stringify(next));
      setReusableBusy(false);
      return;
    }

    const operationSequence = ++reusableOperationSequenceRef.current;
    const operationIsCurrent = () =>
      reusableOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;

    setReusableBusy(true);
    let refreshStarted = false;

    try {
      const { error } = await saveReusableSectionInCloud(operationUserId, title, savedSection);

      if (!operationIsCurrent()) return;

      if (error) {
        setReusableError('Could not save this reusable section.');
        return;
      }

      refreshStarted = true;
      await refreshReusableSections();
    } finally {
      if (operationIsCurrent() && !refreshStarted) {
        setReusableBusy(false);
      }
    }
  }


  function insertReusableSection(template: ReusableSectionTemplate) {
    remember(sections);
    const section = cloneSectionWithFreshIds(template.section, sections);
    setSections((current) => [...current, section]);
    setSelectedId(section.id);
    setSelectedElementId(section.elements[0]?.id ?? null);
    setSaved(false);
  }

  async function deleteReusableSection(template: ReusableSectionTemplate) {
    if (!window.confirm(`${l('Delete reusable section')} “${template.title}”?`)) return;
    setReusableError('');

    const operationUserId = user?.id ?? null;

    if (!operationUserId || !template.cloudId) {
      const next = reusableSections.filter((item) => item.id !== template.id);
      setReusableSections(next);
      localStorage.setItem(REUSABLE_SECTIONS_KEY, JSON.stringify(next));
      return;
    }

    const operationSequence = ++reusableOperationSequenceRef.current;
    const operationIsCurrent = () =>
      reusableOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;

    setReusableBusy(true);
    let refreshStarted = false;

    try {
      const { error } = await deleteReusableSectionInCloud(operationUserId, template.cloudId);

      if (!operationIsCurrent()) return;

      if (error) {
        setReusableError('Could not delete this reusable section.');
        return;
      }

      refreshStarted = true;
      await refreshReusableSections();
    } finally {
      if (operationIsCurrent() && !refreshStarted) {
        setReusableBusy(false);
      }
    }
  }
  function applyThemeToCurrentPage() {
    remember(sections);
    setSections(sections.map((section, index) => applyThemeToSection(section, index, theme)));
    setSaved(false);
  }

  function applyThemeToAllPages() {
    remember(sections, 'Apply theme to all pages');
    const currentPages = getCurrentPages();
    const nextPages = currentPages.map((page) => ({
      ...page,
      sections: page.sections.map((section, index) => applyThemeToSection(section, index, theme)),
    }));
    const active = nextPages.find((page) => page.id === activePageId) || nextPages[0];
    setPages(nextPages);
    setSections(active?.sections || []);
    setSelectedId(active?.sections[0]?.id ?? null);
    setSelectedElementId(active?.sections[0]?.elements[0]?.id ?? null);
    setSaved(false);
  }

  function publicWebsiteUrl(projectId: string, ownerId?: string) {
    const resolvedOwnerId = ownerId || resolveEditorProjectOwnerId({
      currentUserId: user?.id,
      projectId,
      activeProjectId: cloudProjectId,
      activeOwnerId: projectTeamAccess.ownerId,
      projects: cloudProjects,
    });
    if (!resolvedOwnerId) return '';
    return buildPublishedSiteUrl(resolvedOwnerId, projectId, 'index.html');
  }

  async function recoverPublishedProjectState(project: CloudWebsiteProject, expectedLoadSequence?: number) {
    const recoveryUserId = user?.id ?? null;
    if (!recoveryUserId) return false;

    const loadIsCurrent = () =>
      (expectedLoadSequence === undefined ||
        projectLoadSequenceRef.current === expectedLoadSequence) &&
      activeUserIdRef.current === recoveryUserId;

    if (!loadIsCurrent()) return false;

    const ownerId = project.user_id || recoveryUserId;
    const path = `${ownerId}/${project.id}/index.html`;
    const { data, error } = await downloadPublishedWebsiteFile(path);

    if (!loadIsCurrent()) return false;

    const storedUrl =
      typeof project.content?.publishedUrl === 'string'
        ? project.content.publishedUrl
        : '';

    if (error || !data || data.size <= 0) {
      setLiveVerification(storedUrl ? 'failed' : 'idle');
      return false;
    }

    const canonicalStoredUrl = normalizePublishedSiteUrl(storedUrl);
    const recoveredUrl = publicWebsiteUrl(project.id, ownerId) || canonicalStoredUrl;
    const recoveredAt =
      typeof project.content?.publishedAt === 'string'
        ? project.content.publishedAt
        : project.updated_at || new Date().toISOString();

    if (!recoveredUrl) {
      setLiveVerification('failed');
      return false;
    }

    const routeHealthy = await verifyPublishedRoute(recoveredUrl);

    if (!loadIsCurrent()) return false;

    setPublishedUrl(recoveredUrl);
    setPublishedAt(recoveredAt);
    setLiveVerification(routeHealthy ? 'healthy' : 'failed');

    if (project.user_id === recoveryUserId && routeHealthy && (!storedUrl || storedUrl !== recoveredUrl || project.status !== 'completed')) {
      const recoveredContent = {
        ...project.content,
        publishedUrl: recoveredUrl,
        publishedAt: recoveredAt,
        updatedAt: new Date().toISOString(),
      };

      const recoverUpdatedAt = new Date().toISOString();
      const { error: recoverError } = await updateWebsiteProjectPublicationState({
        projectId: project.id,
        userId: recoveryUserId,
        content: recoveredContent,
        published: true,
        updatedAt: recoverUpdatedAt,
      });

      if (!recoverError && loadIsCurrent()) {
        setCloudProjects((current) =>
          current.map((item) =>
            item.id === project.id
              ? { ...item, content: recoveredContent, status: 'completed' }
              : item
          )
        );
        saveLocalWebsiteProject({
          ...recoveredContent,
          cloudProjectId: project.id,
        });
      }
    }

    return routeHealthy;
  }

  async function loadCloudProject(projectId: string) {
    const project = cloudProjects.find((item) => item.id === projectId);
    if (!project) return;

    cancelPendingProjectPersistence();

    const loadSequence = ++projectLoadSequenceRef.current;
    const loadUserId = user?.id ?? null;
    const loadIsCurrent = () =>
      projectLoadSequenceRef.current === loadSequence &&
      activeUserIdRef.current === loadUserId;

    newProjectIntentRef.current = false;
    setCloudProjectId(project.id);
    saveActiveWebsiteProjectId(project.id);

    const identifiedContent = {
      ...project.content,
      cloudProjectId: project.id,
    };

    saveLocalWebsiteProject(identifiedContent);

    await refreshProjectTeamAccess(project.id, loadSequence);
    if (!loadIsCurrent()) return;

    setLeads([]);
    setLeadsOpen(false);
    setAnalyticsEvents([]);
    setAnalyticsOpen(false);
    setPublishVersions([]);
    setReleaseHistoryOpen(false);
    setLiveVerification('idle');
    skipNextAutosaveRef.current = true;

    applyProjectData(identifiedContent);
    setSiteName(project.title || 'My Website');

    await recoverPublishedProjectState(
      {
        ...project,
        content: identifiedContent,
      },
      loadSequence,
    );

    if (!loadIsCurrent()) return;
  }

  const loadCloudProjectRef = useRef(loadCloudProject);
  loadCloudProjectRef.current = loadCloudProject;

  const refreshLeads = useCallback(async () => {
    const refreshLoadSequence = projectLoadSequenceRef.current;
    const refreshProjectId = cloudProjectId;
    const refreshUserId = user?.id ?? null;
    const refreshIsCurrent = () =>
      projectLoadSequenceRef.current === refreshLoadSequence &&
      activeUserIdRef.current === refreshUserId;

    if (!refreshUserId || !refreshProjectId) {
      if (refreshIsCurrent()) {
        setLeads([]);
        setLeadsError('');
        setLeadsLoading(false);
      }
      return;
    }

    if (!projectTeamAccess.canManage) {
      if (refreshIsCurrent()) {
        setLeads([]);
        setLeadsError('Lead inbox is available to project owners and workspace admins.');
        setLeadsLoading(false);
      }
      return;
    }

    setLeadsLoading(true);
    setLeadsError('');

    const { data, error } = await listWebsiteLeads(refreshProjectId);

    if (!refreshIsCurrent()) return;

    if (error) {
      setLeadsError('Lead inbox is unavailable. Make sure the Sprint 11 database migration is applied.');
      setLeadsLoading(false);
      return;
    }

    const nextLeads = (data || []) as WebsiteLead[];
    setLeads(nextLeads);
    setSelectedLeadIds((current) => current.filter((id) => nextLeads.some((lead) => lead.id === id)));
    setLeadsLoading(false);
  }, [user, cloudProjectId, projectTeamAccess.canManage]);

  async function updateLeadStatus(leadId: string, status: WebsiteLead['status']) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;
    const updatedAt = new Date().toISOString();

    const { error } = await updateWebsiteLeadStatus({
      leadId,
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      status,
      updatedAt,
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not update this lead.');
      return;
    }

    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, status, updated_at: updatedAt } : lead));
  }

  async function updateLeadCrm(leadId: string, updates: Partial<Pick<WebsiteLead, 'stage' | 'priority' | 'tags' | 'notes'>>) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;
    const sanitized = {
      ...updates,
      ...(updates.tags ? { tags: updates.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12) } : {}),
      ...(typeof updates.notes === 'string' ? { notes: updates.notes.slice(0, 4000) } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error } = await updateWebsiteLeadCrm({
      leadId,
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      updates: sanitized as Record<string, unknown>,
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not update CRM details for this lead.');
      return;
    }

    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, ...sanitized } : lead));
  }

  async function bulkUpdateLeadStage(stage: LeadStage) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage || !selectedLeadIds.length) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;
    const ids = [...selectedLeadIds];
    const updatedAt = new Date().toISOString();

    const { error } = await bulkUpdateWebsiteLeadStage({
      leadIds: ids,
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      stage,
      updatedAt,
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not update the selected leads.');
      return;
    }

    setLeads((current) => current.map((lead) => ids.includes(lead.id) ? { ...lead, stage, updated_at: updatedAt } : lead));
  }


  async function copyLeadSummary(lead: WebsiteLead) {
    const meta = getWebsiteLeadSource(lead);
    const phone = getWebsiteLeadPhone(lead);
    const lines = [
      `Lead: ${lead.name}`,
      lead.email ? `Email: ${lead.email}` : '',
      phone ? `Phone: ${phone}` : '',
      `Stage: ${lead.stage || 'new'}`,
      `Priority: ${Number(lead.priority || 0)}`,
      lead.tags?.length ? `Tags: ${lead.tags.join(', ')}` : '',
      meta.source ? `Source: ${meta.source}${meta.medium ? ` / ${meta.medium}` : ''}` : '',
      meta.campaign ? `Campaign: ${meta.campaign}` : '',
      lead.page_path ? `Page: ${lead.page_path}` : '',
      '',
      lead.message || '',
      lead.notes ? `\nNotes: ${lead.notes}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      window.alert(lines.join('\n'));
    }
  }

  async function deleteLead(leadId: string) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;
    const confirmed = window.confirm(l('Delete this lead permanently?'));
    if (!confirmed) return;

    const deleteLoadSequence = projectLoadSequenceRef.current;
    const deleteUserId = user.id;
    const deleteProjectId = cloudProjectId;
    const deleteOwnerId = activeProjectOwnerId;
    const deleteIsCurrent = () =>
      projectLoadSequenceRef.current === deleteLoadSequence &&
      activeUserIdRef.current === deleteUserId;

    const { error } = await deleteWebsiteLead({
      leadId,
      projectId: deleteProjectId,
      ownerId: deleteOwnerId,
    });

    if (!deleteIsCurrent()) return;

    if (error) {
      setLeadsError('Could not delete this lead.');
      return;
    }

    setLeads((current) => current.filter((lead) => lead.id !== leadId));
    setSelectedLeadIds((current) => current.filter((id) => id !== leadId));
  }

  const refreshAnalytics = useCallback(async () => {
    const refreshLoadSequence = projectLoadSequenceRef.current;
    const refreshProjectId = cloudProjectId;
    const refreshUserId = user?.id ?? null;
    const refreshIsCurrent = () =>
      projectLoadSequenceRef.current === refreshLoadSequence &&
      activeUserIdRef.current === refreshUserId;

    if (!refreshUserId || !refreshProjectId) {
      if (refreshIsCurrent()) {
        setAnalyticsEvents([]);
        setAnalyticsError('');
        setAnalyticsLoading(false);
      }
      return;
    }

    if (!projectTeamAccess.canEdit) {
      if (refreshIsCurrent()) {
        setAnalyticsEvents([]);
        setAnalyticsError('Analytics is available to project owners, admins, and editors.');
        setAnalyticsLoading(false);
      }
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError('');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await listWebsiteAnalyticsEvents(refreshProjectId, since);

    if (!refreshIsCurrent()) return;

    if (error) {
      setAnalyticsError('Analytics is unavailable. Make sure the Sprint 15 database migration is applied.');
      setAnalyticsLoading(false);
      return;
    }

    setAnalyticsEvents((data || []) as WebsiteAnalyticsEvent[]);
    setAnalyticsLoading(false);
  }, [user, cloudProjectId, projectTeamAccess.canEdit]);

  const refreshMedia = useCallback(async (expectedUserId: string | null = user?.id ?? null) => {
    if (activeUserIdRef.current !== expectedUserId) {
      return;
    }

    const refreshSequence = ++mediaRefreshSequenceRef.current;
    const refreshIsCurrent = () =>
      mediaRefreshSequenceRef.current === refreshSequence &&
      activeUserIdRef.current === expectedUserId;

    if (!expectedUserId) {
      if (refreshIsCurrent()) {
        setMediaAssets([]);
        setMediaError('');
        setMediaLoading(false);
      }
      return;
    }

    setMediaLoading(true);
    setMediaError('');

    const { data, error } = await listWebsiteMediaFiles(expectedUserId);

    if (!refreshIsCurrent()) return;

    if (error) {
      setMediaError('Media library is unavailable. Make sure the Sprint 12 storage migration is applied.');
      setMediaLoading(false);
      return;
    }

    const assets: WebsiteMediaAsset[] = (data || [])
      .filter((item) => Boolean(item.name) && item.name !== '.emptyFolderPlaceholder')
      .map((item) => {
        const path = `${expectedUserId}/${item.name}`;
        return {
          name: item.name,
          path,
          url: getWebsiteMediaPublicUrl(path),
          createdAt: item.created_at,
        };
      });

    setMediaAssets(assets);
    setMediaLoading(false);
  }, [user?.id]);
  function applyMediaAsset(asset: WebsiteMediaAsset) {
    if (!selectedSection) return;

    if (selectedElement?.type === 'image') {
      updateSelectedElement({ src: asset.url, content: asset.name });
      return;
    }

    remember(sections);
    const element: WebsiteElement = {
      ...createElement('image', selectedSection.accent),
      src: asset.url,
      content: asset.name,
    };
    setSections((current) => current.map((section) =>
      section.id === selectedSection.id
        ? { ...section, elements: [...section.elements, element] }
        : section
    ));
    setSelectedElementId(element.id);
    setSaved(false);
  }

  async function uploadMediaFile(file: File) {
    const uploadUserId = user?.id ?? null;
    if (!uploadUserId) {
      setMediaError('Sign in before uploading media.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setMediaError('Only image files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMediaError('Images must be 5 MB or smaller.');
      return;
    }

    const uploadSequence = ++mediaUploadSequenceRef.current;
    const uploadProjectSequence = projectLoadSequenceRef.current;
    const uploadEditorContext = captureAIEditorContext();
    const uploadIsCurrentUser = () =>
      mediaUploadSequenceRef.current === uploadSequence &&
      activeUserIdRef.current === uploadUserId;

    setMediaUploading(true);
    setMediaError('');

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    const path = `${uploadUserId}/${Date.now()}-${base}.${extension}`;

    try {
      const { error } = await uploadWebsiteMediaFile(path, file);

      if (!uploadIsCurrentUser()) return;

      if (error) {
        setMediaError('Could not upload this image.');
        return;
      }

      const publicUrl = getWebsiteMediaPublicUrl(path);
      await refreshMedia(uploadUserId);

      if (!uploadIsCurrentUser()) return;

      if (
        projectLoadSequenceRef.current === uploadProjectSequence &&
        aiEditorContextIsCurrent(uploadEditorContext, true) &&
        selectedElement?.type === 'image'
      ) {
        updateSelectedElement({ src: publicUrl, content: file.name });
      }
    } finally {
      if (uploadIsCurrentUser()) {
        setMediaUploading(false);
      }
    }
  }
  async function deleteMediaAsset(asset: WebsiteMediaAsset) {
    const deleteUserId = user?.id ?? null;
    if (!deleteUserId) return;
    if (!window.confirm(`${l('Delete')} ${asset.name} ${l('from your media library?')}`)) return;

    const deleteSequence = ++mediaDeleteSequenceRef.current;
    const deleteProjectSequence = projectLoadSequenceRef.current;
    const deleteEditorContext = captureAIEditorContext();
    const deleteIsCurrentUser = () =>
      mediaDeleteSequenceRef.current === deleteSequence &&
      activeUserIdRef.current === deleteUserId;

    setMediaError('');

    const { error } = await deleteWebsiteMediaFile(asset.path);

    if (!deleteIsCurrentUser()) return;

    if (error) {
      setMediaError('Could not delete this image.');
      return;
    }

    setMediaAssets((current) => current.filter((item) => item.path !== asset.path));

    if (
      projectLoadSequenceRef.current === deleteProjectSequence &&
      aiEditorContextIsCurrent(deleteEditorContext, true) &&
      selectedElement?.type === 'image' &&
      selectedElement.src === asset.url
    ) {
      updateSelectedElement({ src: '' });
    }
  }
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? null,
    [sections, selectedId]
  );

  const selectedElement = useMemo(
    () => selectedSection?.elements.find((element) => element.id === selectedElementId) ?? null,
    [selectedSection, selectedElementId]
  );

  const selectedElements = useMemo(
    () => selectedSection?.elements.filter((element) => selectedElementIds.includes(element.id)) ?? [],
    [selectedSection, selectedElementIds],
  );

  function selectCanvasElement(sectionId: string, elementId: string, additive = false, range = false) {
    const section = sections.find((item) => item.id === sectionId);
    if (range && section && selectedId === sectionId && selectedElementId) {
      const anchorIndex = section.elements.findIndex((element) => element.id === selectedElementId);
      const targetIndex = section.elements.findIndex((element) => element.id === elementId);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeIds = section.elements.slice(start, end + 1).map((element) => element.id);
        const requestedIds = additive ? new Set([...selectedElementIds, ...rangeIds]) : new Set(rangeIds);
        const next = section.elements.filter((element) => requestedIds.has(element.id)).map((element) => element.id);
        setSelectedElementIds(next);
        setSelectedElementId(elementId);
        setSelectedContainerId(null);
        setSelectedFormFieldId(null);
        return;
      }
    }
    if (!additive || selectedId !== sectionId) {
      selectEditorTarget(sectionId, elementId);
      return;
    }

    const exists = selectedElementIds.includes(elementId);
    const next = exists
      ? selectedElementIds.filter((id) => id !== elementId)
      : [...selectedElementIds, elementId];
    setSelectedId(sectionId);
    setSelectedElementIds(next);
    setSelectedElementId(exists && selectedElementId === elementId ? next[next.length - 1] ?? null : elementId);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
  }

  function selectCanvasElements(sectionId: string, elementIds: string[], additive = false) {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    const requestedIds = new Set(elementIds);
    const currentIds = additive && selectedId === sectionId ? new Set(selectedElementIds) : new Set<string>();
    requestedIds.forEach((id) => currentIds.add(id));
    const next = section.elements.filter((element) => currentIds.has(element.id)).map((element) => element.id);
    setSelectedId(sectionId);
    setSelectedElementIds(next);
    setSelectedElementId(next[next.length - 1] ?? null);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
  }

  function selectAllCanvasElements() {
    if (!selectedSection?.elements.length) return;
    setSelectedElementIds(selectedSection.elements.map((element) => element.id));
    setSelectedElementId(selectedSection.elements[selectedSection.elements.length - 1]?.id ?? null);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
  }

  function selectRelatedCanvasElements(scope: 'type' | 'container') {
    if (!selectedSection || !selectedElement) return;
    const next = selectedSection.elements
      .filter((element) => scope === 'type'
        ? element.type === selectedElement.type
        : Boolean(selectedElement.containerId) && element.containerId === selectedElement.containerId)
      .map((element) => element.id);
    if (next.length < 2) return;
    setSelectedElementIds(next);
    setSelectedElementId(selectedElement.id);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
  }

  useEffect(() => {
    setSelectedElementIds((current) => {
      const valid = selectedElementId
        ? current.includes(selectedElementId) ? current : [selectedElementId]
        : [];
      return valid.length === current.length && valid.every((id, index) => id === current[index]) ? current : valid;
    });
  }, [selectedId, selectedElementId]);

  const canvasKeyboardSelectionRef = useRef(Boolean(selectedSection));
  canvasKeyboardSelectionRef.current = Boolean(selectedSection);
  const canvasKeyboardBusyRef = useRef(false);
  canvasKeyboardBusyRef.current = Boolean(cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy);
  const canvasKeyboardActionsRef = useRef({
    copy: copySelectedTarget,
    cut: cutSelectedTarget,
    paste: pasteCopiedTarget,
    duplicate: duplicateSelectedTarget,
    remove: deleteSelectedTarget,
    selectAll: selectAllCanvasElements,
    group: createContainerForSelected,
    ungroup: ungroupSelectedElements,
    moveLayer: moveSelectedElementsLayer,
    nudge: nudgeSelectedElement,
    endNudge: () => { canvasNudgeSessionRef.current = null; },
  });
  canvasKeyboardActionsRef.current = {
    copy: copySelectedTarget,
    cut: cutSelectedTarget,
    paste: pasteCopiedTarget,
    duplicate: duplicateSelectedTarget,
    remove: deleteSelectedTarget,
    selectAll: selectAllCanvasElements,
    group: createContainerForSelected,
    ungroup: ungroupSelectedElements,
    moveLayer: moveSelectedElementsLayer,
    nudge: nudgeSelectedElement,
    endNudge: () => { canvasNudgeSessionRef.current = null; },
  };

  useEffect(() => {
    const handleCanvasKeyDown = (event: KeyboardEvent) => {
      if (!canvasKeyboardSelectionRef.current) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return;

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        canvasKeyboardActionsRef.current.selectAll();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        canvasKeyboardActionsRef.current.copy();
        return;
      }


      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        if (!canvasKeyboardBusyRef.current) canvasKeyboardActionsRef.current.cut();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        if (!canvasKeyboardBusyRef.current) canvasKeyboardActionsRef.current.paste();
        return;
      }

      if (canvasKeyboardBusyRef.current) return;

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        if (event.shiftKey) canvasKeyboardActionsRef.current.ungroup();
        else canvasKeyboardActionsRef.current.group();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
        event.preventDefault();
        if (event.code === 'BracketRight') canvasKeyboardActionsRef.current.moveLayer(event.shiftKey ? 'front' : 'forward');
        else canvasKeyboardActionsRef.current.moveLayer(event.shiftKey ? 'back' : 'backward');
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        canvasKeyboardActionsRef.current.duplicate();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        canvasKeyboardActionsRef.current.remove();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'Escape') {
        event.preventDefault();
        setSelectedElementId(null);
        return;
      }

      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') canvasKeyboardActionsRef.current.nudge(-step, 0);
      if (event.key === 'ArrowRight') canvasKeyboardActionsRef.current.nudge(step, 0);
      if (event.key === 'ArrowUp') canvasKeyboardActionsRef.current.nudge(0, -step);
      if (event.key === 'ArrowDown') canvasKeyboardActionsRef.current.nudge(0, step);
    };

    const handleCanvasKeyUp = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        canvasKeyboardActionsRef.current.endNudge();
      }
    };

    const handleCanvasBlur = () => canvasKeyboardActionsRef.current.endNudge();

    window.addEventListener('keydown', handleCanvasKeyDown);
    window.addEventListener('keyup', handleCanvasKeyUp);
    window.addEventListener('blur', handleCanvasBlur);
    return () => {
      window.removeEventListener('keydown', handleCanvasKeyDown);
      window.removeEventListener('keyup', handleCanvasKeyUp);
      window.removeEventListener('blur', handleCanvasBlur);
    };
  }, []);

  useEffect(() => {
    setSectionSettingsOpen(!selectedElementId);
  }, [selectedElementId]);

  const selectedContainer = useMemo(
    () => selectedElement?.containerId ? selectedSection?.containers?.find((container) => container.id === selectedElement.containerId) ?? null : null,
    [selectedSection, selectedElement]
  );

  const billingPlan = billingState.plan;
  const billingEntitlements = billingState.entitlements;

  function openBillingWithMessage(message = '') {
    setBillingError(message);
    setBillingOpen(true);
  }

  function requireBillingFeature(feature: BillingFeature, label: string): boolean {
    if (!user) {
      openBillingWithMessage(`Sign in to use ${label}.`);
      return false;
    }
    if (billingEntitlements.features[feature]) return true;
    const requiredPlan = feature === 'clientDelivery' || feature === 'whiteLabel' ? 'Business' : 'Pro';
    openBillingWithMessage(`${label} requires the ${requiredPlan} plan.`);
    return false;
  }

  function requirePageCapacity(extraPages = 1): boolean {
    const nextCount = pages.length + extraPages;
    if (nextCount <= billingEntitlements.maxPages) return true;
    openBillingWithMessage(`Your ${BILLING_PLAN_DETAILS[billingPlan].label} plan supports up to ${billingEntitlements.maxPages} pages. Upgrade to add more.`);
    return false;
  }

  function effectiveProductionConfig(): WebsiteProductionConfig {
    return resolveEffectiveProductionConfig(productionConfig, billingEntitlements);
  }

  const refreshBilling = useCallback(async (
    projectId: string | null = cloudProjectId,
    expectedLoadSequence = projectLoadSequenceRef.current,
  ) => {
    const refreshSequence = ++billingRefreshSequenceRef.current;
    const refreshUserId = user?.id ?? null;
    const refreshIsCurrent = () =>
      billingRefreshSequenceRef.current === refreshSequence &&
      activeUserIdRef.current === refreshUserId &&
      projectLoadSequenceRef.current === expectedLoadSequence;

    if (!refreshUserId) {
      if (refreshIsCurrent()) {
        setBillingState({
          plan: 'free',
          entitlements: FREE_BILLING_ENTITLEMENTS,
          subscription: null,
          usage: { websiteProjects: 0, pages: pages.length, releases: 0, leads: 0, analyticsEvents: 0 },
        });
        setBillingLoading(false);
      }
      return;
    }

    setBillingLoading(true);
    setBillingError('');

    const { data, error } = await getWebsiteBuilderBillingState(projectId);
    if (!refreshIsCurrent()) return;

    if (error || !data || typeof data !== 'object') {
      setBillingState((current) => ({
        ...current,
        plan: 'free',
        entitlements: FREE_BILLING_ENTITLEMENTS,
        usage: { ...current.usage, pages: pages.length },
      }));
      setBillingError('Billing status could not be verified, so paid features are temporarily locked. Apply the Sprint 121–132 migration if this is a new install.');
      setBillingLoading(false);
      return;
    }

    setBillingState(normalizeBillingStatePayload(data as Record<string, unknown>, pages.length));
    setBillingLoading(false);
  }, [user?.id, pages.length, cloudProjectId]);
  async function startBillingCheckout(plan: 'pro' | 'business') {
    const checkoutUserId = user?.id ?? null;
    if (!checkoutUserId) {
      openBillingWithMessage('Sign in before upgrading your plan.');
      return;
    }

    const subscriptionStatus = billingState.subscription?.status || '';
    const hasManagedPaidSubscription = Boolean(
      billingState.subscription?.stripeCustomerId &&
      ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(subscriptionStatus),
    );

    if (hasManagedPaidSubscription) {
      await openBillingPortal();
      return;
    }

    const operationSequence = ++billingOperationSequenceRef.current;
    const operationIsCurrent = () =>
      billingOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === checkoutUserId;

    setBillingBusy(true);
    setBillingError('');

    try {
      const { data, error } = await createWebsiteCheckoutSession(plan);
      if (!operationIsCurrent()) return;
      if (error) throw error;

      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error(data?.error || 'Stripe Checkout is not configured yet.');

      window.location.assign(url);
    } catch (error) {
      if (!operationIsCurrent()) return;
      setBillingError(error instanceof Error ? error.message : 'Could not open Stripe Checkout.');
      setBillingBusy(false);
    }
  }
  async function openBillingPortal() {
    const portalUserId = user?.id ?? null;
    if (!portalUserId) return;

    const operationSequence = ++billingOperationSequenceRef.current;
    const operationIsCurrent = () =>
      billingOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === portalUserId;

    setBillingBusy(true);
    setBillingError('');

    try {
      const { data, error } = await openWebsiteBillingPortalSession();
      if (!operationIsCurrent()) return;
      if (error) throw error;

      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error(data?.error || 'Billing portal is not available yet.');

      window.location.assign(url);
    } catch (error) {
      if (!operationIsCurrent()) return;
      setBillingError(error instanceof Error ? error.message : 'Could not open the billing portal.');
      setBillingBusy(false);
    }
  }
  useEffect(() => {
    if (projectId) return;
    try {
      const savedProject = loadLocalWebsiteProject();
      if (savedProject) {
        const savedIdentity =
          savedProject &&
          typeof savedProject === 'object' &&
          !Array.isArray(savedProject) &&
          typeof (savedProject as PersistedWebsiteProject).cloudProjectId === 'string'
            ? (savedProject as PersistedWebsiteProject).cloudProjectId?.trim() || null
            : null;

        if (savedIdentity) {
          saveActiveWebsiteProjectId(savedIdentity);
        }

        skipNextAutosaveRef.current = true;
        applyProjectData(savedProject);
      }
    } catch {
      // Ignore invalid project data.
    }
  }, [projectId]);

  useEffect(() => {
    void refreshCloudProjects();
    void refreshReusableSections();
  }, [refreshCloudProjects, refreshReusableSections]);

  useEffect(() => {
    if (!user || !cloudProjectsLoaded || newProjectIntentRef.current) return;

    let desiredProjectId = projectId || loadActiveWebsiteProjectId();

    if (desiredProjectId) {
      if (cloudProjectId === desiredProjectId) return;

      const exists = cloudProjects.some((project) => project.id === desiredProjectId);
      if (exists) {
        void loadCloudProjectRef.current(desiredProjectId);
        return;
      }

      if (projectId) {
        setCloudError('The requested website is not visible in your current cloud projects.');
        return;
      }

      saveActiveWebsiteProjectId(null);
      desiredProjectId = null;
    }

    const fallbackProject =
      cloudProjects.find((project) => project.user_id === user.id) ??
      cloudProjects[0];

    if (!desiredProjectId && fallbackProject && cloudProjectId !== fallbackProject.id) {
      saveActiveWebsiteProjectId(fallbackProject.id);
      void loadCloudProjectRef.current(fallbackProject.id);
    }
  }, [user, cloudProjectsLoaded, cloudProjects, projectId, cloudProjectId]);

  useEffect(() => {
    if (!user || !cloudProjectId) return;
    saveActiveWebsiteProjectId(cloudProjectId);
  }, [user, cloudProjectId]);

  useEffect(() => {
    void refreshBilling(cloudProjectId);
  }, [cloudProjectId, refreshBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingResult = params.get('billing');
    if (!billingResult) return;

    const billingLoadSequence = projectLoadSequenceRef.current;
    const billingProjectId = cloudProjectId;
    const billingUserId = user?.id ?? null;
    let syncTimer: number | null = null;

    setBillingOpen(true);
    if (billingResult === 'success') {
      setBillingError('Payment completed. Stripe is syncing your subscription; refresh billing if the badge does not update immediately.');
      syncTimer = window.setTimeout(() => {
        if (
          projectLoadSequenceRef.current !== billingLoadSequence ||
          activeUserIdRef.current !== billingUserId
        ) {
          return;
        }

        void refreshBilling(billingProjectId, billingLoadSequence);
      }, 1200);
    } else if (billingResult === 'canceled') {
      setBillingError('Checkout was canceled. Your current plan was not changed.');
    }
    params.delete('billing');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);

    return () => {
      if (syncTimer !== null) window.clearTimeout(syncTimer);
    };
  }, [cloudProjectId, refreshBilling, user?.id]);

  useEffect(() => {
    if (leadsOpen) void refreshLeads();
  }, [leadsOpen, refreshLeads]);

  useEffect(() => {
    if (mediaOpen) void refreshMedia();
  }, [mediaOpen, refreshMedia]);

  useEffect(() => {
    if (analyticsOpen) void refreshAnalytics();
  }, [analyticsOpen, refreshAnalytics]);

  useEffect(() => {
    const updateNetwork = () => setNetworkOnline(navigator.onLine);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (!networkOnline || !cloudSyncFailed || !user?.id || !projectTeamAccess.canEdit) return;

    const retryLoadSequence = projectLoadSequenceRef.current;
    const retryUserId = user.id;
    const timer = window.setTimeout(() => {
      if (
        projectLoadSequenceRef.current !== retryLoadSequence ||
        activeUserIdRef.current !== retryUserId
      ) {
        return;
      }

      void saveProjectRef.current({ automatic: true, createHistory: false });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [networkOnline, cloudSyncFailed, user?.id, cloudProjectId, projectTeamAccess.canEdit]);

  const desktopShortcutActionsRef = useRef({
    busy: false,
    save: () => saveProject(),
    undo: () => undo(),
    redo: () => redo(),
    preview: () => previewWebsite(),
  });
  desktopShortcutActionsRef.current = {
    busy: cloudBusy || publishBusy || aiBusy || aiQualityBusy,
    save: () => saveProject(),
    undo: () => undo(),
    redo: () => redo(),
    preview: () => previewWebsite(),
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const target = event.target;
      const editingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')));

      if (editingText && key === 'z') return;
      if (mod && key === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery('');
        return;
      }
      if (!mod) return;

      const action =
        key === 's' ? 'save'
          : key === 'z' && event.shiftKey ? 'redo'
            : key === 'y' ? 'redo'
              : key === 'z' ? 'undo'
              : key === 'p' && event.shiftKey ? 'preview'
                : null;
      if (!action) return;

      event.preventDefault();
      const actions = desktopShortcutActionsRef.current;
      if (actions.busy) return;
      if (action === 'save') void actions.save();
      else if (action === 'redo') actions.redo();
      else if (action === 'undo') actions.undo();
      else actions.preview();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function closeCommandPalette() {
    setCommandOpen(false);
    setCommandQuery('');
  }

  function commandFocusable(container: HTMLElement) {
    return Array.from(
      container.querySelectorAll<HTMLElement>('[data-command-focus]:not(:disabled)'),
    );
  }

  function handleCommandDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCommandPalette();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = commandFocusable(event.currentTarget);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleCommandInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== 'ArrowDown' && event.key !== 'Enter') return;
    const firstCommand = event.currentTarget
      .closest<HTMLElement>('[role="dialog"]')
      ?.querySelector<HTMLButtonElement>('[data-command-item]:not(:disabled)');
    if (!firstCommand) return;
    event.preventDefault();
    if (event.key === 'Enter') firstCommand.click();
    else firstCommand.focus();
  }

  function handleCommandItemKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const dialog = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const items = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>('[data-command-item]:not(:disabled)'),
    );
    const currentIndex = items.indexOf(event.currentTarget);
    if (currentIndex < 0 || !items.length) return;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
    event.preventDefault();
    items[nextIndex]?.focus();
  }

  useEffect(() => {
    setPages((current) => current.map((page) =>
      page.id === activePageId ? { ...page, sections } : page
    ));
  }, [sections, activePageId]);

  useEffect(() => {
    const scopedSection = selectedId
      ? sections.find((section) => section.id === selectedId) ?? null
      : null;

    if (!scopedSection) {
      const fallbackSection = sections[0] ?? null;
      selectEditorTarget(
        fallbackSection?.id ?? null,
        fallbackSection?.elements[0]?.id ?? null,
      );
      return;
    }

    const elementValid = selectedElementId
      ? scopedSection.elements.some((element) => element.id === selectedElementId)
      : false;
    setSelectedElementIds((current) => {
      const valid = current.filter((elementId) => scopedSection.elements.some((element) => element.id === elementId));
      return valid.length === current.length ? current : valid;
    });
    const containerValid = selectedContainerId
      ? (scopedSection.containers || []).some((container) => container.id === selectedContainerId)
      : false;
    const formFieldValid = selectedFormFieldId
      ? (scopedSection.formFields || []).some((field) => field.id === selectedFormFieldId)
      : false;

    if (selectedElementId && !elementValid) setSelectedElementId(null);
    if (selectedContainerId && (!containerValid || elementValid)) setSelectedContainerId(null);
    if (selectedFormFieldId && (!formFieldValid || elementValid || containerValid)) {
      setSelectedFormFieldId(null);
    }
  }, [
    sections,
    selectedId,
    selectedElementId,
    selectedContainerId,
    selectedFormFieldId,
    selectEditorTarget,
  ]);

  useEffect(() => {
    const fingerprint = buildProjectFingerprint();
    const decision = decideEditorAutosave({
      fingerprint,
      lastSavedFingerprint: lastSavedSnapshotRef.current,
      skipNext: skipNextAutosaveRef.current,
      signedIn: Boolean(user),
      cloudProjectsLoaded,
      requestedProjectId: projectId,
      activeProjectId: cloudProjectId,
    });

    if (decision === 'blocked' || decision === 'unchanged') return;

    if (decision === 'initialize') {
      lastSavedSnapshotRef.current = fingerprint;
      return;
    }

    if (decision === 'skip-once') {
      skipNextAutosaveRef.current = false;
      lastSavedSnapshotRef.current = fingerprint;
      setAutoSaveStatus('saved');
      return;
    }

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);

    const autosaveLoadSequence = projectLoadSequenceRef.current;
    const autosaveUserId = user?.id ?? null;

    setAutoSaveStatus('saving');
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;

      if (
        projectLoadSequenceRef.current !== autosaveLoadSequence ||
        activeUserIdRef.current !== autosaveUserId
      ) {
        return;
      }

      void saveProjectRef.current({ automatic: true, createHistory: false });
    }, 1800);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [buildProjectFingerprint, user, cloudProjectsLoaded, projectId, cloudProjectId]);

  const analyticsSummary = useMemo(
    () => summarizeWebsiteAnalytics(analyticsEvents),
    [analyticsEvents],
  );

  const filteredLeads = useMemo(() => {
    const query = leadQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (leadStatusFilter !== 'all' && lead.status !== leadStatusFilter) return false;
      if (leadStageFilter !== 'all' && (lead.stage || 'new') !== leadStageFilter) return false;
      if (!query) return true;
      const dataText = JSON.stringify(lead.form_data || {}).toLowerCase();
      const haystack = [lead.name, lead.email, lead.message, lead.notes || '', (lead.tags || []).join(' '), dataText].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [leads, leadQuery, leadStatusFilter, leadStageFilter]);

  const leadCrmSummary = useMemo(() => {
    const stageCount = (stage: LeadStage) => leads.filter((lead) => (lead.stage || 'new') === stage).length;
    const won = stageCount('won');
    return {
      total: leads.length,
      newCount: stageCount('new'),
      qualified: stageCount('qualified'),
      contacted: stageCount('contacted'),
      won,
      lost: stageCount('lost'),
      winRate: leads.length ? Math.round((won / leads.length) * 1000) / 10 : 0,
      highPriority: leads.filter((lead) => Number(lead.priority || 0) >= 2).length,
    };
  }, [leads]);

  const deliveryUsage = useMemo(() => {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const allSections = currentPages.flatMap((page) => page.sections || []);
    const allElements = allSections.flatMap((section) => section.elements || []);
    return {
      pages: currentPages.length,
      sections: allSections.length,
      elements: allElements.length,
      forms: allSections.filter((section) => section.type === 'contact').length,
      symbols: symbols.length,
      reusableSections: reusableSections.length,
      leads: leads.length,
      analyticsEvents: analyticsEvents.length,
      releases: publishVersions.length,
      mediaLoaded: mediaAssets.length,
    };
  }, [pages, activePageId, sections, symbols, reusableSections, leads, analyticsEvents, publishVersions, mediaAssets]);

  const approvalCurrent = Boolean(
    deliveryConfig.approvedFingerprint && deliveryConfig.approvedFingerprint === buildDeliveryFingerprint()
  );

  const activePage = useMemo(() => {
    const storedActivePage = pages.find((page) => page.id === activePageId);
    if (storedActivePage) {
      return {
        ...storedActivePage,
        sections,
      };
    }

    return pages[0] ?? null;
  }, [pages, activePageId, sections]);

  const aiCandidateShowingBefore = aiCandidatePreview?.viewMode === 'before';
  const canvasPages = aiCandidatePreview
    ? aiCandidateShowingBefore ? aiCandidatePreview.baselinePages : aiCandidatePreview.pages
    : pages;
  const canvasActivePageId = aiCandidatePreview?.activePageId ?? activePageId;
  const canvasActivePage = aiCandidatePreview
    ? canvasPages.find((page) => page.id === canvasActivePageId) ?? canvasPages[0] ?? null
    : activePage;
  const canvasSections = aiCandidatePreview ? canvasActivePage?.sections ?? [] : sections;
  const canvasSiteName = aiCandidatePreview
    ? aiCandidateShowingBefore ? aiCandidatePreview.baselineSiteName : aiCandidatePreview.siteName
    : siteName;
  const canvasTheme = aiCandidatePreview
    ? aiCandidateShowingBefore ? aiCandidatePreview.baselineTheme : aiCandidatePreview.theme
    : theme;
  const canvasHeaderConfig = aiCandidatePreview
    ? aiCandidateShowingBefore ? aiCandidatePreview.baselineHeaderConfig : aiCandidatePreview.headerConfig
    : headerConfig;

  const aiCandidateReviewPages = useMemo(() => {
    if (!aiCandidatePreview) return [];
    const changedIds = new Set(aiCandidatePreview.changedPageIds);
    const addedIds = new Set(aiCandidatePreview.addedPageIds);
    const removedIds = new Set(aiCandidatePreview.removedPageIds);
    const surviving = aiCandidatePreview.pages
      .filter((page) => changedIds.has(page.id) || page.id === aiCandidatePreview.activePageId)
      .map((page) => ({
        page,
        status: addedIds.has(page.id) ? 'added' as const : changedIds.has(page.id) ? 'changed' as const : 'current' as const,
        operationCount: aiCandidatePreview.review.operations.filter((operation) => aiWebsitePatchReviewItemTargetsPage(operation, page)).length,
      }));
    const removed = aiCandidatePreview.baselinePages
      .filter((page) => removedIds.has(page.id))
      .map((page) => ({
        page,
        status: 'removed' as const,
        operationCount: aiCandidatePreview.review.operations.filter((operation) => aiWebsitePatchReviewItemTargetsPage(operation, page)).length,
      }));
    return [...surviving, ...removed];
  }, [aiCandidatePreview]);
  const aiCandidateCanShowBefore = Boolean(aiCandidatePreview?.baselinePages.some((page) => page.id === aiCandidatePreview.activePageId));
  const aiCandidateCanShowAfter = Boolean(aiCandidatePreview?.pages.some((page) => page.id === aiCandidatePreview.activePageId));
  const aiCandidateReviewedPageCount = useMemo(() => {
    if (!aiCandidatePreview) return 0;
    const reviewedIds = new Set(aiCandidatePreview.reviewedPageIds);
    return aiCandidateReviewPages.reduce((count, item) => count + (reviewedIds.has(item.page.id) ? 1 : 0), 0);
  }, [aiCandidatePreview, aiCandidateReviewPages]);
  const aiCandidateGlobalOperations = useMemo(
    () => aiCandidatePreview?.review.operations.filter(aiWebsitePatchReviewItemIsGlobal) ?? [],
    [aiCandidatePreview],
  );
  const aiCandidateActiveOperations = useMemo(() => {
    if (!aiCandidatePreview) return [];
    const activePage = aiCandidatePreview.pages.find((page) => page.id === aiCandidatePreview.activePageId)
      ?? aiCandidatePreview.baselinePages.find((page) => page.id === aiCandidatePreview.activePageId);
    if (!activePage) return aiCandidateGlobalOperations;
    return aiCandidatePreview.review.operations.filter((operation) =>
      aiWebsitePatchReviewItemIsGlobal(operation) || aiWebsitePatchReviewItemTargetsPage(operation, activePage),
    );
  }, [aiCandidatePreview, aiCandidateGlobalOperations]);
  const aiCandidateTargetableOperations = useMemo(
    () => aiCandidatePreview?.review.operations.filter((operation) => operation.sectionId || operation.elementId || operation.containerId) ?? [],
    [aiCandidatePreview],
  );
  const aiCandidateReviewedOperationCount = useMemo(() => {
    if (!aiCandidatePreview) return 0;
    const reviewedIds = new Set(aiCandidatePreview.reviewedOperationIds);
    return aiCandidateTargetableOperations.reduce((count, operation) => count + (reviewedIds.has(operation.id) ? 1 : 0), 0);
  }, [aiCandidatePreview, aiCandidateTargetableOperations]);

  const aiCanvasPreview = useMemo<AIWebsiteCanvasPreview | null>(() => {
    const review = aiCandidatePreview?.review ?? aiPatchReview;
    if (!review) return null;
    const visibleOperations = aiCandidatePreview
      ? review.operations
      : review.operations.filter((operation) => review.selectedOperationIds.includes(operation.id));
    const preview: AIWebsiteCanvasPreview = {
      global: false,
      sectionKinds: {},
      elementKinds: {},
      containerKinds: {},
    };
    const activeSlug = normalizeSlug(canvasActivePage?.slug || '');

    visibleOperations.forEach((operation) => {
      const targetsPage = Boolean(operation.pageId || operation.pageSlug);
      const targetsActivePage = !targetsPage || Boolean(
        canvasActivePage && (
          operation.pageId === canvasActivePage.id ||
          normalizeSlug(operation.pageSlug || '') === activeSlug
        ),
      );
      if (!targetsActivePage) return;

      if (operation.elementId) {
        preview.elementKinds[operation.elementId] = mergeAIWebsitePatchReviewKind(
          preview.elementKinds[operation.elementId],
          operation.kind,
        );
      }
      if (operation.containerId) {
        preview.containerKinds[operation.containerId] = mergeAIWebsitePatchReviewKind(
          preview.containerKinds[operation.containerId],
          operation.kind,
        );
      }

      const highlightsParentSection = Boolean(
        operation.sectionId && (
          operation.kind === 'add' ||
          (Boolean(aiCandidatePreview) && operation.kind === 'remove') ||
          (!operation.elementId && !operation.containerId)
        ),
      );
      if (operation.sectionId && highlightsParentSection) {
        preview.sectionKinds[operation.sectionId] = mergeAIWebsitePatchReviewKind(
          preview.sectionKinds[operation.sectionId],
          operation.kind,
        );
      }
      if (!operation.sectionId && !operation.elementId && !operation.containerId) {
        preview.global = true;
      }
    });

    return preview;
  }, [aiCandidatePreview, aiPatchReview, canvasActivePage]);

  const siteAudit = useMemo(() => {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const errors: string[] = [];
    const warnings: string[] = [];
    const slugs = new Map<string, number>();
    const pageSlugs = new Set(currentPages.map((page) => normalizeSlug(page.slug)));
    const anchors = new Set<string>();
    const canonicalOverrides = new Map<string, number>();

    const translationLanguages = new Map<string, Set<Language>>();
    currentPages.forEach((page) => {
      const slug = normalizeSlug(page.slug);
      slugs.set(slug, (slugs.get(slug) || 0) + 1);
      const translationGroup = page.translationKey?.trim();
      if (translationGroup) {
        const language = normalizePageLanguage(page.language, prefs.language);
        const languages = translationLanguages.get(translationGroup) || new Set<Language>();
        if (languages.has(language)) warnings.push(`Translation group "${translationGroup}" has more than one ${languageCodeLabel(language)} page.`);
        languages.add(language);
        translationLanguages.set(translationGroup, languages);
      }
      if (page.canonicalUrl?.trim()) {
        const canonical = normalizeSiteUrl(page.canonicalUrl);
        if (canonical) canonicalOverrides.set(canonical, (canonicalOverrides.get(canonical) || 0) + 1);
      }
      page.sections.forEach((section) => {
        anchors.add((section.anchorId || section.type || '').replace(/^#/, ''));
        if (section.type === 'contact' && section.formSuccessAction === 'redirect') {
          const redirectTarget = (section.formRedirectUrl || '').trim();
          if (!redirectTarget) warnings.push(`${page.name}: contact form redirect is enabled but no target is set.`);
          if (redirectTarget.startsWith('page:') && !pageSlugs.has(normalizeSlug(redirectTarget.slice(5)))) errors.push(`${page.name}: contact form redirects to a missing page.`);
          if (redirectTarget && !safeFormRedirectHref(redirectTarget, currentPages.find((candidate) => candidate.id === homePageId)?.slug || 'home')) warnings.push(`${page.name}: contact form redirect URL is not allowed.`);
        }
        (section.elements || []).forEach((element) => {
          if (element.type === 'image' && element.src && !element.content.trim()) warnings.push(`${page.name}: image is missing alt text.`);
          if (element.type === 'image' && !element.src) warnings.push(`${page.name}: image element has no source.`);
          if (element.type === 'button' && element.href?.startsWith('page:')) {
            const target = normalizeSlug(element.href.slice(5));
            if (!pageSlugs.has(target)) errors.push(`${page.name}: broken page link → ${target}.`);
          }
          if (element.type === 'button' && element.href?.startsWith('#') && element.href.length > 1) {
            const target = element.href.slice(1);
            if (!anchors.has(target) && !currentPages.some((candidate) => candidate.sections.some((section) => (section.anchorId || section.type) === target))) warnings.push(`${page.name}: anchor #${target} was not found.`);
          }
        });
      });
      const hasHeading = page.sections.some((section) => (section.elements || []).some((element) => element.type === 'heading' && element.content.trim()));
      if (!hasHeading) warnings.push(`${page.name}: no heading element found.`);
      const description = page.seoDescription?.trim() || seo.description.trim();
      if (!description) warnings.push(`${page.name}: meta description is empty.`);
      if (description.length > 180) warnings.push(`${page.name}: meta description is longer than 180 characters.`);
    });

    translationLanguages.forEach((languages, key) => {
      if (languages.size === 1) warnings.push(`Translation group "${key}" has only one language version.`);
    });
    slugs.forEach((count, slug) => { if (count > 1) errors.push(`Duplicate page slug: /${slug}.`); });
    canonicalOverrides.forEach((count, canonical) => { if (count > 1) warnings.push(`Multiple pages use the same canonical URL: ${canonical}.`); });
    const validatedProduction = normalizeProductionConfig(productionConfig);
    if (productionConfig.ga4Id.trim() && !validatedProduction.ga4Id) warnings.push('GA4 Measurement ID is invalid. Expected G-XXXX.');
    if (productionConfig.gtmId.trim() && !validatedProduction.gtmId) warnings.push('Google Tag Manager ID is invalid. Expected GTM-XXXX.');
    if (productionConfig.metaPixelId.trim() && !validatedProduction.metaPixelId) warnings.push('Meta Pixel ID is invalid.');
    if (productionConfig.plausibleDomain.trim() && !validatedProduction.plausibleDomain) warnings.push('Plausible domain is invalid. Use a domain without https://.');
    if (!seo.title.trim()) errors.push('Global SEO title is empty.');
    if (!normalizeSiteUrl(siteUrl)) warnings.push('Production URL is not configured.');
    if (!faviconUrl.trim()) warnings.push('Favicon is not configured.');
    if (!headerConfig.enabled) warnings.push('Global header/navigation is disabled.');
    if (productionConfig.maintenanceMode) warnings.push('Maintenance mode is enabled; visitors will not see the website content.');
    if (productionConfig.organizationSchema && !(productionConfig.organizationName.trim() || siteName.trim())) warnings.push('Organization schema has no organization name.');
    if (productionConfig.localBusinessSchema && !productionConfig.localBusinessAddress.trim()) warnings.push('Local Business schema has no address.');

    const uniqueErrors = [...new Set(errors)];
    const uniqueWarnings = [...new Set(warnings)];
    const score = Math.max(0, 100 - uniqueErrors.length * 15 - uniqueWarnings.length * 5);
    return { errors: uniqueErrors.slice(0, 20), warnings: uniqueWarnings.slice(0, 30), score };
  }, [pages, activePageId, homePageId, sections, seo, siteUrl, faviconUrl, headerConfig.enabled, productionConfig, siteName, prefs.language]);

  const qualityDiagnostics = useMemo(() => {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const allSections = currentPages.flatMap((page) => page.sections || []);
    const allElements = allSections.flatMap((section) => section.elements || []);
    const snapshotChars = JSON.stringify(buildProjectData()).length;
    const warnings: string[] = [];
    if (currentPages.length > 50) warnings.push('Large site: more than 50 pages may slow the editor.');
    if (allSections.length > 250) warnings.push('Large site: more than 250 sections may slow autosave.');
    if (allElements.length > 1200) warnings.push('Large site: more than 1,200 elements may affect browser performance.');
    if (snapshotChars > 2_000_000) warnings.push('Project snapshot is above 2 MB; optimize large content and image URLs.');
    if (!networkOnline) warnings.push('Offline mode: cloud sync and publishing are unavailable.');
    if (cloudSyncFailed) warnings.push('Cloud sync needs retry before publishing.');
    return {
      pages: currentPages.length,
      sections: allSections.length,
      elements: allElements.length,
      snapshotKb: Math.max(1, Math.round(snapshotChars / 1024)),
      warnings,
      healthy: networkOnline && !cloudSyncFailed && siteAudit.errors.length === 0,
    };
  }, [pages, activePageId, sections, networkOnline, cloudSyncFailed, siteAudit.errors.length, buildProjectData]);

  function switchPage(pageId: string) {
    const target = pages.find((page) => page.id === pageId);
    if (!target || target.id === activePageId) return;
    clearEditorDragState();
    setPages((current) => current.map((page) =>
      page.id === activePageId ? { ...page, sections } : page
    ));
    setActivePageId(target.id);
    setSections(target.sections);
    selectEditorTarget(
      target.sections[0]?.id ?? null,
      target.sections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function addPage() {
    if (!requirePageCapacity(1)) return;
    remember(sections, 'Add page');
    const base = `page-${pages.length + 1}`;
    const used = new Set(pages.map((page) => page.slug));
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const page = { ...createPage(`Page ${pages.length + 1}`, slug), language: prefs.language };
    clearEditorDragState();
    setPages((current) => [
      ...current.map((item) =>
        item.id === activePageId
          ? { ...item, sections }
          : item
      ),
      page,
    ]);
    setActivePageId(page.id);
    setSections(page.sections);
    selectEditorTarget(
      page.sections[0]?.id ?? null,
      page.sections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function duplicateActivePage() {
    if (!activePage) return;
    if (!requirePageCapacity(1)) return;
    remember(sections, 'Duplicate page');
    const used = new Set(pages.map((page) => normalizeSlug(page.slug)));
    const base = `${normalizeSlug(activePage.slug)}-copy`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const clonedSections = activePage.sections.map((section) => cloneSectionWithFreshIds(section));
    const page: WebsitePage = {
      ...activePage,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${activePage.name} Copy`,
      slug,
      sections: clonedSections,
      showInNavigation: false,
      canonicalUrl: '',
    };
    clearEditorDragState();
    setPages((current) => [
      ...current.map((item) =>
        item.id === activePageId
          ? { ...item, sections }
          : item
      ),
      page,
    ]);
    setActivePageId(page.id);
    setSections(clonedSections);
    selectEditorTarget(
      clonedSections[0]?.id ?? null,
      clonedSections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function duplicatePageAsTranslation(language: Language) {
    if (!activePage) return;
    if (!requireBillingFeature('multilingual', 'Multilingual pages')) return;
    if (!requirePageCapacity(1)) return;
    const currentLanguage = normalizePageLanguage(activePage.language, prefs.language);
    if (language === currentLanguage) return;
    const groupKey = activePage.translationKey?.trim() || `translation-${activePage.id}`;
    if (pages.some((page) => page.translationKey === groupKey && normalizePageLanguage(page.language, prefs.language) === language)) {
      window.alert(`${l('A')} ${l(PAGE_LANGUAGE_LABELS[language])} ${l('version already exists in this translation group.')}`);
      return;
    }
    const used = new Set(pages.map((page) => normalizeSlug(page.slug)));
    const base = `${normalizeSlug(activePage.slug)}-${language}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const clonedSections = activePage.sections.map((section) => cloneSectionWithFreshIds(section));
    const page: WebsitePage = {
      ...activePage,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${activePage.name} · ${languageCodeLabel(language)}`,
      slug,
      sections: clonedSections,
      language,
      translationKey: groupKey,
      canonicalUrl: '',
    };
    clearEditorDragState();
    setPages((current) => current
      .map((item) =>
        item.id === activePage.id
          ? {
              ...item,
              sections,
              translationKey: groupKey,
            }
          : item
      )
      .concat(page));
    setActivePageId(page.id);
    setSections(clonedSections);
    selectEditorTarget(
      clonedSections[0]?.id ?? null,
      clonedSections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function updateActivePageMeta(changes: Partial<Pick<WebsitePage, 'name' | 'slug' | 'showInNavigation' | 'seoTitle' | 'seoDescription' | 'socialImage' | 'canonicalUrl' | 'language' | 'translationKey' | 'noIndex'>>) {
    remember(sections, 'Edit page settings');
    setPages((current) => current.map((page) => {
      if (page.id !== activePageId) return page;
      return {
        ...page,
        sections,
        ...changes,
        slug: changes.slug !== undefined ? normalizeSlug(changes.slug) : page.slug,
      };
    }));
    setSaved(false);
  }

  function movePage(pageId: string, direction: 'up' | 'down') {
    remember(sections, 'Move page');
    setPages((current) => {
      const withLiveActivePage = current.map((page) =>
        page.id === activePageId
          ? { ...page, sections }
          : page
      );
      const index = withLiveActivePage.findIndex((page) => page.id === pageId);
      if (index === -1) return current;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= withLiveActivePage.length) {
        return withLiveActivePage;
      }
      const next = [...withLiveActivePage];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function makeActivePageHome() {
    if (!activePage) return;
    remember(sections, 'Set home page');
    setHomePageId(activePage.id);
    setSaved(false);
  }

  function deleteActivePage() {
    if (pages.length <= 1) return;
    remember(sections, 'Delete page');
    const remaining = pages.filter((page) => page.id !== activePageId);
    const next = remaining[0];
    clearEditorDragState();
    setPages(remaining);
    if (activePageId === homePageId) setHomePageId(next.id);
    setActivePageId(next.id);
    setSections(next.sections);
    selectEditorTarget(
      next.sections[0]?.id ?? null,
      next.sections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function createEditHistoryEntry(label: string): ProjectHistoryEntry {
    const savedAt = new Date().toISOString();
    return {
      id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt,
      label,
      snapshot: buildProjectSnapshot(),
    };
  }

  function remember(_current: WebsiteSection[], label = 'Manual edit') {
    const entry = createEditHistoryEntry(label);
    setHistory((current) => [...current.slice(-49), entry]);
    setFuture([]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    if (snapshotConflictsWithActiveProject(previous.snapshot)) return;

    const redoEntry = createEditHistoryEntry(previous.label);
    prepareProjectStateRestore();
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [redoEntry, ...current].slice(0, 50));
    skipNextAutosaveRef.current = true;
    applyProjectData(previous.snapshot, false, false);
    setSaved(false);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    if (snapshotConflictsWithActiveProject(next.snapshot)) return;

    const undoEntry = createEditHistoryEntry(next.label);
    prepareProjectStateRestore();
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current.slice(-49), undoEntry]);
    skipNextAutosaveRef.current = true;
    applyProjectData(next.snapshot, false, false);
    setSaved(false);
  }

  function restoreEditHistoryEntry(entryId: string) {
    const targetIndex = history.findIndex((entry) => entry.id === entryId);
    if (targetIndex < 0) return;

    const target = history[targetIndex];
    if (snapshotConflictsWithActiveProject(target.snapshot)) return;
    if (!window.confirm(l('Restore this history state? Your current unsaved changes will move to the Redo queue.'))) return;

    saveRecoverySnapshot('before restoring edit history entry');
    const currentEntry = createEditHistoryEntry('Current state before history restore');
    prepareProjectStateRestore();
    const redoPath = [
      ...history.slice(targetIndex + 1),
      currentEntry,
      ...future,
    ].slice(0, 50);

    setHistory(history.slice(0, targetIndex));
    setFuture(redoPath);
    skipNextAutosaveRef.current = true;
    applyProjectData(target.snapshot, false, false);
    setSaved(false);
  }

  function updateSelected(
    changes: Partial<Omit<WebsiteSection, 'id' | 'type'>>
  ) {
    if (!selectedId) return;

    remember(sections);
    setSections((current) =>
      current.map((section) => {
        if (section.id !== selectedId) return section;
        const next = { ...section, ...changes };
        const elements = section.elements.map((element) => {
          if (changes.title !== undefined && element.type === 'heading') return { ...element, content: changes.title };
          if (changes.description !== undefined && element.type === 'text') return { ...element, content: changes.description };
          if (element.type === 'button') {
            return {
              ...element,
              content: changes.buttonText !== undefined ? changes.buttonText : element.content,
              href: changes.buttonUrl !== undefined ? changes.buttonUrl : element.href,
              style: changes.accent !== undefined ? { ...element.style, backgroundColor: changes.accent } : element.style,
            };
          }
          return element;
        });
        return { ...next, elements };
      })
    );
    setSaved(false);
  }

  function updateSelectedSectionResponsive(changes: SectionResponsiveStyle) {
    if (!selectedId) return;
    if (device === 'desktop') {
      updateSelected(changes);
      return;
    }
    remember(sections, `Edit ${device} section layout`);
    setSections((current) => current.map((section) => section.id === selectedId ? {
      ...section,
      responsive: {
        ...section.responsive,
        [device]: {
          ...(section.responsive?.[device] || {}),
          ...changes,
        },
      },
    } : section));
    setSaved(false);
  }

  function resetSelectedSectionResponsive() {
    if (!selectedId || device === 'desktop') return;
    remember(sections, `Reset ${device} section layout`);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedId) return section;
      const responsive = { ...(section.responsive || {}) };
      delete responsive[device];
      return { ...section, responsive };
    }));
    setSaved(false);
  }

  function copySelectedSectionResponsiveFrom(sourceDevice: Device) {
    if (!selectedSection || sourceDevice === device) return;
    const source = effectiveSectionStyle(selectedSection, sourceDevice);
    updateSelectedSectionResponsive({
      minHeight: source.minHeight,
      sectionPaddingY: source.sectionPaddingY,
      sectionPaddingX: source.sectionPaddingX,
      layoutGap: source.layoutGap,
    });
  }

  function setSelectedSectionLayout(layout: SectionLayout) {
    if (!selectedSection) return;
    const previousColumns = sectionColumnCount(selectedSection.layout);
    const nextColumns = sectionColumnCount(layout);
    remember(sections);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      return {
        ...section,
        layout,
        layoutGap: sectionLayoutGap(section),
        layoutAlign: sectionLayoutAlign(section),
        elements: section.elements.map((element, index) => ({
          ..…139968 tokens truncated…     </div>
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

        <main data-tayar-v1-canvas="true"
          className={`min-h-[600px] flex-1 overflow-auto p-3 lg:p-5 ${
            darkMode ? 'bg-[#050914]' : 'bg-[#f3f4f6]'
          }`}
        >
          {aiCanvasPreviewBanner}
          <div
            aria-disabled={aiCanvasPreview ? true : undefined}
            onFocusCapture={(event) => {
              if (!aiCanvasPreview) return;
              event.stopPropagation();
              (aiCandidatePreview ? aiCandidateApproveButtonRef : aiPatchApproveButtonRef).current?.focus();
            }}
            className={`mx-auto overflow-hidden rounded-xl border shadow-xl transition-all duration-200 ${aiCanvasPreview ? 'pointer-events-none select-none' : ''} ${
              device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : 'w-full max-w-6xl'
            } ${aiCanvasPreview?.global ? 'ring-2 ring-violet-400 shadow-[0_0_32px_rgba(139,92,246,0.25)]' : ''} ${darkMode ? 'border-white/10 bg-[#0f172a]' : 'border-gray-200 bg-white'}`}
            style={{ fontFamily: `${canvasTheme.fontFamily}, Arial, sans-serif` }}
          >
            {canvasHeaderConfig.enabled && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ background: canvasHeaderConfig.backgroundColor, color: canvasHeaderConfig.textColor, borderColor: canvasHeaderConfig.borderColor }}>
                <div className="flex min-w-0 items-center gap-2 font-bold" style={{ fontSize: `${canvasHeaderConfig.brandSize}px` }}>
                  {canvasHeaderConfig.logoUrl && <img src={canvasHeaderConfig.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span className="truncate">{canvasHeaderConfig.brandText.trim() || canvasSiteName}</span>
                </div>
                {device === 'mobile' && canvasHeaderConfig.mobileMenu ? (
                  <div className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold" style={{ color: canvasHeaderConfig.textColor, borderColor: canvasHeaderConfig.borderColor }}>☰ Menu</div>
                ) : (
                  <div className="flex flex-wrap items-center justify-end text-[10px]" style={{ color: canvasHeaderConfig.textColor, gap: `${canvasHeaderConfig.navGap}px`, fontSize: `${canvasHeaderConfig.navSize}px` }}>
                    {canvasPages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id} className={page.id === canvasActivePageId ? 'font-bold' : ''} style={{ color: page.id === canvasActivePageId ? canvasHeaderConfig.activeColor : canvasHeaderConfig.textColor }}>{page.name}</span>)}
                    {canvasHeaderConfig.showCta && <span className="px-2.5 py-1.5 font-bold" style={{ background: canvasHeaderConfig.ctaBackgroundColor, color: canvasHeaderConfig.ctaTextColor, borderRadius: `${canvasTheme.buttonRadius}px` }}>{canvasHeaderConfig.ctaLabel}</span>}
                  </div>
                )}
              </div>
            )}
            {canvasSections.map((section, sectionIndex) => (
  <div
    key={section.id}
    onDragStart={(e) => handleDragStart(section.id, e)}
    onDragOver={(e) => handleDragOver(e, section.id)}
    onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, section.id)}
              draggable={true}
    className={`relative transition-all duration-150 ${
      draggedId === section.id ? 'scale-[0.995] opacity-45' : 'opacity-100'
      }
    }`}
  >
    {dragOverId === section.id && dragOverSectionPosition && draggedId !== section.id && (
      <span className={`pointer-events-none absolute left-2 right-2 z-[60] h-1 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.8)] ${dragOverSectionPosition === 'before' ? '-top-0.5' : '-bottom-0.5'}`} />
    )}
    <SectionPreview
      section={section}
      selected={selectedId === section.id}
      selectedElementId={selectedId === section.id ? selectedElementId : null}
      selectedElementIds={selectedId === section.id ? selectedElementIds : []}
      onSelect={() => selectEditorTarget(section.id)}
      onSelectElement={(elementId, additive, range) => selectCanvasElement(section.id, elementId, additive, range)}
      onMarqueeSelect={(elementIds, additive) => selectCanvasElements(section.id, elementIds, additive)}
      draggedElementId={draggedElementId}
      dragOverElementId={dragOverElementId}
      dragOverElementPosition={dragOverElementPosition}
      snapGuides={canvasSnapGuide?.sectionId === section.id ? canvasSnapGuide : null}
      onElementDragStart={(elementId, e) => handleElementDragStart(section.id, elementId, e)}
      onElementDragMove={(elementId, e) => handleElementDragMove(section.id, elementId, e)}
      onElementPointerDragStart={(elementId, e) => handleElementPointerDragStart(section.id, elementId, e)}
      onElementDragOver={(elementId, e) => handleElementDragOver(section.id, elementId, e)}
      onElementDrop={(elementId, e) => handleElementDrop(section.id, elementId, e)}
      onElementDragEnd={handleElementDragEnd}
      onResizeElementStart={(elementId) => beginElementResize(section.id, elementId)}
      onResizeElementFrame={(elementId, frame) => resizeElementFrame(section.id, elementId, frame)}
      onResizeElementEnd={endElementResize}
      onResetElementPosition={(elementId) => resetElementPosition(section.id, elementId)}
      onQuickUpdateElement={(elementId, changes) => quickUpdateElement(section.id, elementId, changes)}
      onOpenMediaLibrary={() => { selectEditorTarget(section.id); setMediaOpen(true); }}
      onOpenInspector={() => setInspectorOpen(true)}
      onDuplicateSelectedElement={duplicateSelectedElement}
      onDeleteSelectedElement={deleteSelectedElement}
      onInlineContentChange={(elementId, content) => updateInlineElementContent(section.id, elementId, content)}
      onInlineSourceChange={(elementId, src) => updateInlineElementSource(section.id, elementId, src)}
      onAddElement={(type) => addElementToSection(section.id, type)}
      onMoveSection={(direction) => moveSection(section.id, direction)}
      onDeleteSection={() => deleteSection(section.id)}
      canMoveSectionUp={sectionIndex > 0}
      canMoveSectionDown={sectionIndex < canvasSections.length - 1}
      canDeleteSection={canvasSections.length > 1}
      device={device}
      theme={canvasTheme}
      aiPreview={aiCanvasPreview}
    />
    <div data-tayar-v1-root="true"
      className="group/add-section relative flex h-8 items-center justify-center"
      draggable={false}
      onDragStart={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="h-px w-full bg-violet-500/0 transition group-hover/add-section:bg-violet-500/20" />
      <details className="absolute z-40">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-violet-400/20 bg-[#111122]/90 px-2.5 py-1 text-[9px] font-bold text-violet-300 opacity-60 shadow transition hover:opacity-100 [&::-webkit-details-marker]:hidden">
          <Plus className="h-3 w-3" /> {l('Add section')}
        </summary>
        <div className="absolute left-1/2 top-7 z-50 grid w-56 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#111122] p-2 shadow-2xl">
          {(Object.keys(SECTION_LABELS) as SectionType[]).map((type) => (
            <button key={type} type="button" onClick={() => insertSectionAfter(section.id, type)} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">
              + {SECTION_LABELS[type]}
            </button>
          ))}
        </div>
      </details>
    </div>
  </div>
))}
            {footerConfig.enabled && (
              <div className="border-t border-white/10 px-5 py-5" style={{ background: canvasTheme.secondaryColor, color: canvasTheme.textColor }}>
                <div className="flex flex-wrap items-start justify-between gap-4 text-[10px]">
                  <div><p className="font-bold">{canvasHeaderConfig.brandText.trim() || canvasSiteName}</p><p className="mt-1" style={{ color: canvasTheme.mutedTextColor }}>{footerConfig.text.trim() || `© ${new Date().getFullYear()} ${canvasSiteName}. All rights reserved.`}</p></div>
                  {footerConfig.showNavigation && <div className="flex flex-wrap gap-3" style={{ color: canvasTheme.mutedTextColor }}>{canvasPages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id}>{page.name}</span>)}</div>}
                  <div className="flex flex-wrap gap-3" style={{ color: canvasTheme.mutedTextColor }}>{footerConfig.instagramUrl && <span>Instagram</span>}{footerConfig.facebookUrl && <span>Facebook</span>}{footerConfig.linkedinUrl && <span>LinkedIn</span>}{footerConfig.xUrl && <span>X</span>}</div>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside data-tayar-v1-inspector="true" data-tayar-v1-left="true"
          className={`w-full shrink-0 border-t p-3 transition-[width,padding] duration-200 lg:border-l lg:border-t-0 ${inspectorOpen ? 'lg:w-72 xl:w-80 lg:p-3' : 'lg:w-12 lg:p-2'} ${
            darkMode
              ? 'border-white/10 bg-[#0a0a1a]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-2 hidden lg:flex lg:justify-start">
            <button
              type="button"
              onClick={() => setInspectorOpen((open) => !open)}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              title={l(inspectorOpen ? 'Collapse inspector' : 'Expand inspector')}
              aria-label={l(inspectorOpen ? 'Collapse inspector' : 'Expand inspector')}
              aria-expanded={inspectorOpen}
            >
              {inspectorOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <div className={inspectorOpen ? 'block' : 'lg:hidden'}>
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            <div>
              <h2 className="text-xs font-bold">{selectedElement ? `${l('Edit')} ${ELEMENT_LABELS[selectedElement.type]}` : l('Inspector')}</h2>
              <p className="mt-0.5 text-[9px] text-gray-500">{selectedElement ? (selectedElement.type === 'heading' || selectedElement.type === 'text' ? l('Double-click the text on the page for quick editing, or use the controls here.') : l('Change the basics here. Open Advanced only when you need it.')) : l('Select something on the page to start editing.')}</p>
            </div>
          </div>

          {selectedElement && (
            <div className={`mb-3 space-y-2.5 rounded-xl border p-2.5 ${darkMode ? 'border-violet-500/25 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{ELEMENT_LABELS[selectedElement.type]}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSelectedElement('up')} title={l('Move element up')} className={`rounded p-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveSelectedElement('down')} title={l('Move element down')} className={`rounded p-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="ml-1 text-[10px] uppercase text-gray-500">{device}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">{l("Drag this element on the canvas to reorder it.")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={duplicateSelectedElement} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}>
                  <Copy className="h-3.5 w-3.5" />{l('Duplicate')}</button>
                <button onClick={deleteSelectedElement} className="flex items-center justify-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" />{l('Delete')}</button>
              </div>
              <details className={`rounded-lg border ${darkMode ? 'border-white/10 bg-black/10' : 'border-violet-200 bg-white/70'}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{l('Structure')}</span><span className="sr-only">{l('Structure & reusable components')}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                </summary>
                <div className="space-y-2 border-t border-white/10 p-2">
<div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-sky-500/20 bg-sky-500/5' : 'border-sky-200 bg-sky-50/70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{l('Container / Group')}</span>
                  {!selectedContainer && <button type="button" onClick={createContainerForSelected} className="text-[9px] font-semibold text-sky-400">{l('+ New container')}</button>}
                </div>
                <select value={selectedElement.containerId || ''} onChange={(e) => assignSelectedToContainer(e.target.value || undefined)} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}>
                  <option value="">{l('No container')}</option>
                  {(selectedSection?.containers || []).map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}
                </select>
                {selectedContainer && (
                  <div className="space-y-2">
                    <input value={selectedContainer.name} onChange={(e) => updateSelectedContainer({ name: e.target.value })} maxLength={80} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Layout')}<select value={selectedContainer.layout} onChange={(e) => updateSelectedContainer({ layout: e.target.value as 'stack' | 'row' })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}><option value="stack">{l('Stack')}</option><option value="row">{l('Row')}</option></select>
                      </label>
                      <label className="text-[9px] text-gray-500">{l('Align')}<select value={selectedContainer.align} onChange={(e) => updateSelectedContainer({ align: e.target.value as 'start' | 'center' | 'end' | 'stretch' })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}><option value="start">{l('Start')}</option><option value="center">{l('Center')}</option><option value="end">{l('End')}</option><option value="stretch">{l('Stretch')}</option></select>
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Gap')}<input type="number" min="0" max="80" value={selectedContainer.gap} onChange={(e) => updateSelectedContainer({ gap: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                      <label className="text-[9px] text-gray-500">{l('Padding')}<input type="number" min="0" max="120" value={selectedContainer.padding} onChange={(e) => updateSelectedContainer({ padding: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                      <label className="text-[9px] text-gray-500">{l('Radius')}<input type="number" min="0" max="120" value={selectedContainer.borderRadius} onChange={(e) => updateSelectedContainer({ borderRadius: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Background')}<input type="color" value={/^#[0-9a-f]{6}$/i.test(selectedContainer.backgroundColor) ? selectedContainer.backgroundColor : '#111827'} onChange={(e) => updateSelectedContainer({ backgroundColor: e.target.value })} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" /></label>
                      <label className="text-[9px] text-gray-500">{l('Border')}<input type="color" value={/^#[0-9a-f]{6}$/i.test(selectedContainer.borderColor) ? selectedContainer.borderColor : '#374151'} onChange={(e) => updateSelectedContainer({ borderColor: e.target.value })} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" /></label>
                      <label className="text-[9px] text-gray-500">{l('Width')}<input type="number" min="0" max="16" value={selectedContainer.borderWidth} onChange={(e) => updateSelectedContainer({ borderWidth: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                    </div>
                    <select value={selectedContainer.shadow} onChange={(e) => updateSelectedContainer({ shadow: e.target.value as ElementShadow })} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}><option value="none">{l('No shadow')}</option><option value="sm">{l('Small shadow')}</option><option value="md">{l('Medium shadow')}</option><option value="lg">{l('Large shadow')}</option><option value="xl">{l('XL shadow')}</option></select>
              {selectedContainer && selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[9px] text-gray-500">{l('Container column')}<input type="number" min="1" max={sectionColumnCount(selectedSection.layout)} value={selectedContainer.layoutColumn || 1} onChange={(e) => updateSelectedContainer({ layoutColumn: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                        <label className="text-[9px] text-gray-500">{l('Span')}<input type="number" min="1" max={sectionColumnCount(selectedSection.layout)} value={selectedContainer.columnSpan || 1} onChange={(e) => updateSelectedContainer({ columnSpan: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                      </div>
                    )}
                    <button type="button" onClick={deleteSelectedContainer} className="w-full rounded border border-red-500/20 px-2 py-1.5 text-[10px] font-semibold text-red-400">{l('Delete container & ungroup')}</button>
                  </div>
                )}
              </div>

              <div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50/70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">{l('Reusable Symbols')}</span>
                  {selectedElement.symbolId ? <button type="button" onClick={detachSelectedSymbol} className="text-[9px] font-semibold text-amber-400">{l('Detach')}</button> : <button type="button" onClick={createSymbolFromSelected} className="text-[9px] font-semibold text-amber-400">{l('Create symbol')}</button>}
                </div>
                {selectedElement.symbolId && <p className="text-[9px] text-amber-300">{l("Linked symbol — edits sync across all pages automatically.")}</p>}
                {!symbols.length ? <p className="text-[9px] text-gray-500">{l('No symbols yet. Create one from this element.')}</p> : (
                  <div className="max-h-40 space-y-1.5 overflow-auto">
                    {symbols.map((symbol) => (
                      <div key={symbol.id} className={`flex items-center gap-1.5 rounded border p-1.5 ${darkMode ? 'border-white/10' : 'border-amber-200 bg-white'}`}>
                        <button type="button" onClick={() => insertSymbol(symbol)} className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold">+ {symbol.name}</button>
                        <button type="button" onClick={() => deleteSymbol(symbol.id)} title={l('Delete symbol')} className="text-[10px] text-red-400">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </div>
              </details>
              {selectedElement.type === 'image' ? (
                <div className="space-y-2">
                  <input
                    value={selectedElement.src || ''}
                    onChange={(e) => updateSelectedElement({ src: e.target.value })}
                    placeholder="https://..."
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMediaOpen(true)} disabled={!user} className={`flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] disabled:opacity-50 ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}><Images className="h-3.5 w-3.5" />{l('Library')}</button>
                    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] ${!user || mediaUploading ? 'pointer-events-none opacity-50' : ''} ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}><Upload className="h-3.5 w-3.5" />{l('Upload')}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={!user || mediaUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMediaFile(file); event.currentTarget.value = ''; }} /></label>
                  </div>
                </div>
              ) : selectedElement.type === 'video' ? (
                <div className="space-y-2">
                  <input value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder={l('YouTube, Vimeo or direct video URL')} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} placeholder={l('Video title / accessibility label')} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              ) : selectedElement.type === 'embed' ? (
                <div className="space-y-2">
                  <input value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder="https://... map or embed URL" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} placeholder={l('Accessibility title')} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              ) : selectedElement.type === 'gallery' ? (
                <textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={7} placeholder={l('One image URL per line')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              ) : selectedElement.type === 'accordion' || selectedElement.type === 'tabs' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={8} placeholder={l('Title | Content — one item per line')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">{l('Use one line per item: Title | Content')}</p></div>
              ) : selectedElement.type === 'countdown' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={3} placeholder={l('2026-12-31T23:59:59 | Launching soon')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">{l('Format: ISO date/time | label')}</p></div>
              ) : selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={7} placeholder={selectedElement.type === 'stats' ? '120 | Projects completed\n98 | Satisfaction %' : 'Alex | Amazing experience\nSarah | Great service'} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">{l('One item per line')}: {selectedElement.type === 'stats' ? l('value | label') : l('name | quote')}</p></div>
              ) : selectedElement.type === 'code' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={10} placeholder={l('Custom HTML (scripts and inline event handlers are stripped)')} className={`w-full resize-none rounded-lg border px-3 py-2 font-mono text-[10px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-emerald-500">{l('Safe HTML mode: script/object/embed tags and on* handlers are removed before preview/publish.')}</p></div>
              ) : selectedElement.type === 'divider' || selectedElement.type === 'spacer' ? (
                <p className="text-[10px] text-gray-500">{l('Use the styling controls below to adjust')} {selectedElement.type === 'divider' ? l('width, color and opacity') : l('height (Padding × 2)')}.</p>
              ) : (
                <textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={selectedElement.type === 'text' || selectedElement.type === 'list' ? 4 : 2} placeholder={selectedElement.type === 'list' ? l('One list item per line') : undefined} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              )}
              {selectedElement.type === 'button' && (
                <div className="space-y-2">
                  <input
                    value={selectedElement.href || ''}
                    onChange={(e) => updateSelectedElement({ href: e.target.value })}
                    placeholder="#contact, https://... or page:about"
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  />
                  <select
                    value={(selectedElement.href || '').startsWith('page:') ? selectedElement.href : ''}
                    onChange={(e) => e.target.value && updateSelectedElement({ href: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  >
                    <option value="">{l('Link to internal page…')}</option>
                    {pages.map((page) => <option key={page.id} value={`page:${page.slug}`}>{page.name} (/{page.slug})</option>)}
                  </select>
                </div>
              )}
              <div className={`space-y-2 rounded-lg border p-2.5 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">{l('Quick style')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                {(selectedElement.type === 'heading' || selectedElement.type === 'text' || selectedElement.type === 'button' || selectedElement.type === 'list') && (
                  <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-gray-500">{l('Size')}<input type="number" min="10" max="120" value={effectiveStyle(selectedElement, device).fontSize || 16} onChange={(e) => updateSelectedElement({ style: { fontSize: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label>
                <label className="text-[10px] text-gray-500">{l('Text color')}<input type="color" value={effectiveStyle(selectedElement, device).color || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { color: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" /></label>
              </div>
              <label className="block text-[10px] text-gray-500">{l('Alignment')}<select value={effectiveStyle(selectedElement, device).textAlign || 'center'} onChange={(e) => updateSelectedElement({ style: { textAlign: e.target.value as 'left' | 'center' | 'right' } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}><option value="left">{l('Left')}</option><option value="center">{l('Center')}</option><option value="right">{l('Right')}</option></select></label>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Width %')}<input type="number" min="10" max="100" value={effectiveStyle(selectedElement, device).width || 100} onChange={(e) => updateSelectedElement({ style: { width: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label>
                  {selectedElement.type === 'button' ? (
              <label className="text-[10px] text-gray-500">{l('Background')}<input type="color" value={effectiveStyle(selectedElement, device).backgroundColor || '#7c3aed'} onChange={(e) => updateSelectedElement({ style: { backgroundColor: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" /></label>
                  ) : <div />}
                </div>

              </div>

              {selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
                <div className={`rounded-lg border p-2 ${darkMode ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/60'}`}>
                  <label className="block text-[10px] font-semibold text-indigo-400">{l("Column")}<select value={Math.min(sectionColumnCount(selectedSection.layout), Math.max(1, Number(selectedElement.layoutColumn) || 1))} onChange={(e) => updateSelectedElement({ layoutColumn: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-indigo-200 bg-white'}`}>
                      {Array.from({ length: sectionColumnCount(selectedSection.layout) }, (_, index) => <option key={index + 1} value={index + 1}>Column {index + 1}</option>)}
                    </select>
                  </label>
                </div>
              )}

              <details className={`rounded-lg border ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white/70'}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{l('Advanced')}</span><span className="sr-only">{l('Advanced design & responsive')}</span>
                  <span className="flex items-center gap-2 text-[9px] uppercase text-gray-500">{device}<ChevronDown className="h-3.5 w-3.5" /></span>
                </summary>
                <div className="space-y-3 border-t border-white/10 p-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={resetSelectedElementResponsive} className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {l('Reset')} {l(device)}
                    </button>
                    {(['desktop', 'tablet', 'mobile'] as Device[]).filter((sourceDevice) => sourceDevice !== device).map((sourceDevice) => (
                      <button
                        key={sourceDevice}
                        type="button"
                        onClick={() => copySelectedElementResponsiveFrom(sourceDevice)}
                        className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${darkMode ? 'border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-50'}`}
                        title={`${l('Copy')} ${l(sourceDevice)} → ${l(device)}`}
                      >
                        {l('Copy')} {l(sourceDevice)}
                      </button>
                    ))}
                  </div>
<div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">{l('Responsive layout')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                <label className="flex items-center justify-between gap-3 text-[10px] text-gray-500">
                  Visible on {device}
                  <input
                    type="checkbox"
                    checked={!effectiveStyle(selectedElement, device).hidden}
                    onChange={(e) => updateSelectedElement({ style: { hidden: !e.target.checked } }, true)}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Max width px')}<input
                      type="number"
                      min="0"
                      max="2000"
                      placeholder={l('Auto')}
                      value={effectiveStyle(selectedElement, device).maxWidth ?? ''}
                      onChange={(e) => updateSelectedElement({ style: { maxWidth: e.target.value ? Number(e.target.value) : undefined } }, true)}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`}
                    />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Order')}<input
                      type="number"
                      min="-50"
                      max="50"
                      value={effectiveStyle(selectedElement, device).order ?? 0}
                      onChange={(e) => updateSelectedElement({ style: { order: Number(e.target.value) } }, true)}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`}
                    />
                  </label>
                </div>
                <div className={`rounded-lg border p-2.5 ${darkMode ? 'border-violet-500/15 bg-violet-500/[0.04]' : 'border-violet-200 bg-violet-50/50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-violet-400">{l('Free position')}</span>
                    <button type="button" onClick={() => updateSelectedElement({ style: { positionX: 0, positionY: 0 } }, true)} className="text-[9px] font-semibold text-violet-400 hover:text-violet-300">{l('Reset')}</button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">X<input type="number" min="-4000" max="4000" value={effectiveStyle(selectedElement, device).positionX ?? 0} onChange={(e) => updateSelectedElement({ style: { positionX: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} /></label>
                    <label className="text-[10px] text-gray-500">Y<input type="number" min="-4000" max="4000" value={effectiveStyle(selectedElement, device).positionY ?? 0} onChange={(e) => updateSelectedElement({ style: { positionY: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} /></label>
                  </div>
                  <p className="mt-1.5 text-[9px] text-gray-500">{l('Drag freely on the canvas. Hold Shift while dragging to reorder instead.')}</p>
                </div>
                <label className="block text-[10px] text-gray-500">{l('Element position')}<select
                    value={effectiveStyle(selectedElement, device).alignSelf || 'auto'}
                    onChange={(e) => updateSelectedElement({ style: { alignSelf: e.target.value as 'auto' | 'start' | 'center' | 'end' | 'stretch' } }, true)}
                    className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-cyan-200 bg-white'}`}
                  >
                    <option value="auto">{l('Auto')}</option>
                    <option value="start">{l('Start')}</option>
                    <option value="center">{l('Center')}</option>
                    <option value="end">{l('End')}</option>
                    <option value="stretch">{l('Stretch')}</option>
                  </select>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([['T', 'marginTop'], ['R', 'marginRight'], ['B', 'marginBottom'], ['L', 'marginLeft']] as const).map(([label, key]) => (
                    <label key={key} className="text-[9px] text-gray-500">M {label}
                      <input
                        type="number"
                        min="-200"
                        max="400"
                        value={effectiveStyle(selectedElement, device)[key] ?? 0}
                        onChange={(e) => updateSelectedElement({ style: { [key]: Number(e.target.value) } }, true)}
                        className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`}
                      />
                    </label>
                  ))}
                </div>
                {device === 'desktop' && selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
                  <label className="block text-[10px] text-gray-500">{l('Column span')}<select
                      value={Math.min(sectionColumnCount(selectedSection.layout), Math.max(1, Number(effectiveStyle(selectedElement, device).columnSpan) || 1))}
                      onChange={(e) => updateSelectedElement({ style: { columnSpan: Number(e.target.value) } }, true)}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-cyan-200 bg-white'}`}
                    >
                      {Array.from({ length: sectionColumnCount(selectedSection.layout) }, (_, index) => <option key={index + 1} value={index + 1}>Span {index + 1} column{index ? 's' : ''}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {(selectedElement.type === 'heading' || selectedElement.type === 'text' || selectedElement.type === 'button' || selectedElement.type === 'list' || selectedElement.type === 'accordion' || selectedElement.type === 'tabs' || selectedElement.type === 'code' || selectedElement.type === 'countdown' || selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Size')}<input type="number" min="10" max="120" value={effectiveStyle(selectedElement, device).fontSize || 16} onChange={(e) => updateSelectedElement({ style: { fontSize: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                    </label>
                    <label className="text-[10px] text-gray-500">{l('Weight')}<select value={effectiveStyle(selectedElement, device).fontWeight || 400} onChange={(e) => updateSelectedElement({ style: { fontWeight: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                        <option value="400">400</option><option value="500">500</option><option value="600">600</option><option value="700">700</option><option value="800">800</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Text color')}<input type="color" value={effectiveStyle(selectedElement, device).color || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { color: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                    <label className="text-[10px] text-gray-500">{l('Background')}<input type="color" value={effectiveStyle(selectedElement, device).backgroundColor || '#7c3aed'} onChange={(e) => updateSelectedElement({ style: { backgroundColor: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                  </div>
                  <label className="text-[10px] text-gray-500">{l('Alignment')}<select value={effectiveStyle(selectedElement, device).textAlign || 'center'} onChange={(e) => updateSelectedElement({ style: { textAlign: e.target.value as 'left' | 'center' | 'right' } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                      <option value="left">{l('Left')}</option><option value="center">{l('Center')}</option><option value="right">{l('Right')}</option>
                    </select>
                  </label>
                </>
              )}
              {(selectedElement.type === 'heading' || selectedElement.type === 'text' || selectedElement.type === 'button' || selectedElement.type === 'list' || selectedElement.type === 'accordion' || selectedElement.type === 'tabs' || selectedElement.type === 'code' || selectedElement.type === 'countdown' || selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider') && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Line height')}<input type="number" min="0.7" max="4" step="0.05" value={effectiveStyle(selectedElement, device).lineHeight ?? 1.4} onChange={(e) => updateSelectedElement({ style: { lineHeight: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Letter spacing')}<input type="number" min="-10" max="30" step="0.25" value={effectiveStyle(selectedElement, device).letterSpacing ?? 0} onChange={(e) => updateSelectedElement({ style: { letterSpacing: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                  </label>
                </div>
              )}

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-fuchsia-500/20 bg-fuchsia-500/5' : 'border-fuchsia-200 bg-fuchsia-50/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-400">{l('Effects')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Opacity %')}<input type="number" min="0" max="100" value={Math.round((effectiveStyle(selectedElement, device).opacity ?? 1) * 100)} onChange={(e) => updateSelectedElement({ style: { opacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Rotate °')}<input type="number" min="-180" max="180" value={effectiveStyle(selectedElement, device).rotate ?? 0} onChange={(e) => updateSelectedElement({ style: { rotate: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Border width')}<input type="number" min="0" max="24" value={effectiveStyle(selectedElement, device).borderWidth ?? 0} onChange={(e) => updateSelectedElement({ style: { borderWidth: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Border style')}<select value={effectiveStyle(selectedElement, device).borderStyle || 'solid'} onChange={(e) => updateSelectedElement({ style: { borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                      <option value="solid">{l('Solid')}</option><option value="dashed">{l('Dashed')}</option><option value="dotted">{l('Dotted')}</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Border color')}<input type="color" value={effectiveStyle(selectedElement, device).borderColor || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { borderColor: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Shadow')}<select value={effectiveStyle(selectedElement, device).shadow || 'none'} onChange={(e) => updateSelectedElement({ style: { shadow: e.target.value as ElementShadow } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                      <option value="none">{l('None')}</option><option value="sm">{l('Small')}</option><option value="md">{l('Medium')}</option><option value="lg">{l('Large')}</option><option value="xl">{l('XL')}</option>
                    </select>
                  </label>
                </div>
                <div className="border-t border-fuchsia-500/15 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-fuchsia-400">{l('Entrance Animation')}</span>
                    <span className="text-[9px] text-gray-500">{device}</span>
                  </div>
                  <label className="mt-2 block text-[10px] text-gray-500">{l('Animation')}<select value={normalizeElementAnimation(effectiveStyle(selectedElement, device).animation)} onChange={(e) => updateSelectedElement({ style: { animation: e.target.value as ElementAnimation } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                      <option value="none">{l('None')}</option>
                      <option value="fade">{l('Fade')}</option>
                      <option value="fade-up">{l('Fade Up')}</option>
                      <option value="fade-down">{l('Fade Down')}</option>
                      <option value="fade-left">{l('Fade Left')}</option>
                      <option value="fade-right">{l('Fade Right')}</option>
                      <option value="zoom-in">{l('Zoom In')}</option>
                      <option value="zoom-out">{l('Zoom Out')}</option>
                    </select>
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-[9px] text-gray-500">{l('Duration ms')}<input type="number" min="100" max="4000" step="50" value={effectiveStyle(selectedElement, device).animationDuration ?? 650} onChange={(e) => updateSelectedElement({ style: { animationDuration: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Delay ms')}<input type="number" min="0" max="5000" step="50" value={effectiveStyle(selectedElement, device).animationDelay ?? 0} onChange={(e) => updateSelectedElement({ style: { animationDelay: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Distance px')}<input type="number" min="0" max="300" step="2" value={effectiveStyle(selectedElement, device).animationDistance ?? 36} onChange={(e) => updateSelectedElement({ style: { animationDistance: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                    <input type="checkbox" checked={selectedElement.animationOnce !== false} onChange={(e) => updateSelectedElement({ animationOnce: e.target.checked })} />{l("Play once per page view")}</label>
                  <p className="mt-1 text-[9px] text-gray-500">{l("Turn this off to replay when the element leaves and re-enters the viewport.")}</p>
                </div>

                <div className="border-t border-fuchsia-500/15 pt-3">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-fuchsia-400">{l('Hover')}</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Scale')}<input type="number" min="0.5" max="1.6" step="0.01" value={effectiveStyle(selectedElement, device).hoverScale ?? 1} onChange={(e) => updateSelectedElement({ style: { hoverScale: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[10px] text-gray-500">{l('Opacity %')}<input type="number" min="0" max="100" value={Math.round((effectiveStyle(selectedElement, device).hoverOpacity ?? effectiveStyle(selectedElement, device).opacity ?? 1) * 100)} onChange={(e) => updateSelectedElement({ style: { hoverOpacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-[9px] text-gray-500">{l('Text')}<input type="color" value={effectiveStyle(selectedElement, device).hoverColor || effectiveStyle(selectedElement, device).color || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { hoverColor: e.target.value } }, true)} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Background')}<input type="color" value={effectiveStyle(selectedElement, device).hoverBackgroundColor || effectiveStyle(selectedElement, device).backgroundColor || '#7c3aed'} onChange={(e) => updateSelectedElement({ style: { hoverBackgroundColor: e.target.value } }, true)} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Shadow')}<select value={effectiveStyle(selectedElement, device).hoverShadow || 'none'} onChange={(e) => updateSelectedElement({ style: { hoverShadow: e.target.value as ElementShadow } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                        <option value="none">{l('None')}</option><option value="sm">S</option><option value="md">M</option><option value="lg">L</option><option value="xl">{l('XL')}</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="text-[10px] text-gray-500">{l('Width %')}<input type="number" min="10" max="100" value={effectiveStyle(selectedElement, device).width || 100} onChange={(e) => updateSelectedElement({ style: { width: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                </label>
                <label className="text-[10px] text-gray-500">{l('Padding')}<input type="number" min="0" max="80" value={effectiveStyle(selectedElement, device).padding || 0} onChange={(e) => updateSelectedElement({ style: { padding: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                </label>
                <label className="text-[10px] text-gray-500">{l('Radius')}<input type="number" min="0" max="80" value={effectiveStyle(selectedElement, device).borderRadius || 0} onChange={(e) => updateSelectedElement({ style: { borderRadius: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                </label>
              </div>
                </div>
              </details>
            </div>
          )}

          {!selectedSection ? (
            <div className="py-10 text-center text-xs text-gray-500">{l("Select a section to edit it.")}</div>
          ) : (
            <details
              open={sectionSettingsOpen}
              onToggle={(event) => setSectionSettingsOpen(event.currentTarget.open)}
              className={`rounded-xl border ${darkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{l('Section settings')}</p>
                  <p className="truncate text-[9px] text-gray-500">{SECTION_LABELS[selectedSection.type]}{selectedElement ? ` · ${l('collapsed while editing element')}` : ''}</p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${sectionSettingsOpen ? 'rotate-180' : ''}`} />
              </summary>
              <div className="space-y-5 border-t border-white/10 p-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Section")}</label>
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-gray-300'
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {SECTION_LABELS[selectedSection.type]}
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Type className="h-3.5 w-3.5" />{l("Title")}</label>
                <input
                  value={selectedSection.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Description")}</label>
                <textarea
                  value={selectedSection.description}
                  onChange={(e) =>
                    updateSelected({ description: e.target.value })
                  }
                  rows={4}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                <label className="block text-[10px] font-semibold text-cyan-400">{l('Section Anchor / ID')}<input value={selectedSection.anchorId || ''} onChange={(e) => updateSelected({ anchorId: normalizeAnchorId(e.target.value, selectedSection.type) })} placeholder={selectedSection.type} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-cyan-200 bg-white text-gray-900'}`} />
                </label>
                <p className="mt-1 text-[9px] text-gray-500">Link to this section with #{sectionDomId(selectedSection)}.</p>
              </div>

              <div className={`rounded-xl border p-2.5 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">{l('Responsive layout')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                {device === 'desktop' ? (
                  <p className="text-[9px] text-gray-500">{l('Desktop')} · {l('styles')}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={resetSelectedSectionResponsive} className={`rounded-lg border px-2 py-1.5 text-[9px] font-semibold ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-violet-200 bg-white text-violet-700'}`}>{l('Reset')} {l(device)}</button>
                    {(['desktop', 'tablet', 'mobile'] as Device[]).filter((sourceDevice) => sourceDevice !== device).map((sourceDevice) => (
                      <button key={sourceDevice} type="button" onClick={() => copySelectedSectionResponsiveFrom(sourceDevice)} className={`rounded-lg border px-2 py-1.5 text-[9px] font-semibold ${darkMode ? 'border-violet-500/20 text-violet-300 hover:bg-violet-500/10' : 'border-violet-200 bg-white text-violet-700'}`}>{l('Copy')} {l(sourceDevice)}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/60'}`}>
                <div>
                  <p className="text-xs font-bold text-indigo-400">{l('Section Layout')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{l("Choose columns for this section. Mobile automatically collapses to one column.")}</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['stack', 'Stack'], ['two-column', '2 Columns'], ['three-column', '3 Columns']] as const).map(([layout, label]) => (
                    <button key={layout} type="button" onClick={() => setSelectedSectionLayout(layout)} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${(selectedSection.layout || 'stack') === layout ? 'border-indigo-400 bg-indigo-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100'}`}>{label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Gap')}<input type="number" min="0" max="80" value={sectionLayoutGap(effectiveSectionStyle(selectedSection, device))} onChange={(e) => updateSelectedSectionResponsive({ layoutGap: Math.min(80, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-indigo-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Alignment')}<select value={sectionLayoutAlign(selectedSection)} onChange={(e) => updateSelected({ layoutAlign: e.target.value as SectionLayoutAlign })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-indigo-200 bg-white'}`}>
                      <option value="start">{l('Start')}</option><option value="center">{l('Center')}</option><option value="end">{l('End')}</option><option value="stretch">{l('Stretch')}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-fuchsia-500/20 bg-fuchsia-500/5' : 'border-fuchsia-200 bg-fuchsia-50/60'}`}>
                <div>
                  <p className="text-xs font-bold text-fuchsia-400">{l('Section Visuals')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{l("Control background, spacing, height and content width for this section.")}</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {([['color', 'Color'], ['gradient', 'Gradient'], ['image', 'Image']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSelected({ backgroundMode: mode as SectionBackgroundMode })}
                      className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${sectionBackgroundMode(selectedSection) === mode ? 'border-fuchsia-400 bg-fuchsia-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {sectionBackgroundMode(selectedSection) === 'gradient' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-gray-500">{l('From')}<div className="mt-1 flex gap-1.5">
                          <input type="color" value={safeSectionColor(selectedSection.gradientFrom, selectedSection.background || '#111827')} onChange={(e) => updateSelected({ gradientFrom: e.target.value })} className="h-8 w-10 rounded border-0 bg-transparent" />
                          <input value={safeSectionColor(selectedSection.gradientFrom, selectedSection.background || '#111827')} onChange={(e) => updateSelected({ gradientFrom: e.target.value })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                        </div>
                      </label>
                      <label className="text-[10px] text-gray-500">{l('To')}<div className="mt-1 flex gap-1.5">
                          <input type="color" value={safeSectionColor(selectedSection.gradientTo, selectedSection.accent || '#7c3aed')} onChange={(e) => updateSelected({ gradientTo: e.target.value })} className="h-8 w-10 rounded border-0 bg-transparent" />
                          <input value={safeSectionColor(selectedSection.gradientTo, selectedSection.accent || '#7c3aed')} onChange={(e) => updateSelected({ gradientTo: e.target.value })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                        </div>
                      </label>
                    </div>
                    <label className="block text-[10px] text-gray-500">{l('Gradient angle')}<input type="range" min="0" max="360" value={sectionVisualNumber(selectedSection.gradientAngle, 135, 0, 360)} onChange={(e) => updateSelected({ gradientAngle: Number(e.target.value) })} className="mt-1 w-full" />
                      <span className="text-[9px] text-gray-500">{sectionVisualNumber(selectedSection.gradientAngle, 135, 0, 360)}°</span>
                    </label>
                  </div>
                )}

                {sectionBackgroundMode(selectedSection) === 'image' && (
                  <div className="space-y-2">
                    <label className="block text-[10px] text-gray-500">{l('Background image URL')}<input
                        value={selectedSection.backgroundImage || ''}
                        onChange={(e) => updateSelected({ backgroundImage: e.target.value })}
                        placeholder="https://..."
                        className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`}
                      />
                    </label>
                    {selectedElement?.type === 'image' && selectedElement.src && (
                      <button type="button" onClick={() => updateSelected({ backgroundImage: selectedElement.src, backgroundMode: 'image' })} className="w-full rounded-lg border border-fuchsia-500/30 px-2 py-1.5 text-[10px] font-semibold text-fuchsia-400">{l("Use selected image as background")}</button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-gray-500">{l('Position')}<select value={sectionBackgroundPosition(selectedSection)} onChange={(e) => updateSelected({ backgroundPosition: e.target.value as SectionBackgroundPosition })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                          <option value="center">{l('Center')}</option><option value="top">{l('Top')}</option><option value="bottom">{l('Bottom')}</option><option value="left">{l('Left')}</option><option value="right">{l('Right')}</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-gray-500">{l('Size')}<select value={sectionBackgroundSize(selectedSection)} onChange={(e) => updateSelected({ backgroundSize: e.target.value as SectionBackgroundSize })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                          <option value="cover">{l('Cover')}</option><option value="contain">{l('Contain')}</option><option value="auto">{l('Auto')}</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-gray-500">{l('Overlay')}<input type="color" value={safeSectionColor(selectedSection.overlayColor, '#000000')} onChange={(e) => updateSelected({ overlayColor: e.target.value })} className="mt-1 h-8 w-full rounded border-0 bg-transparent" />
                      </label>
                      <label className="text-[10px] text-gray-500">{l('Opacity')}<input type="range" min="0" max="1" step="0.05" value={sectionVisualNumber(selectedSection.overlayOpacity, 0.35, 0, 1)} onChange={(e) => updateSelected({ overlayOpacity: Number(e.target.value) })} className="mt-2 w-full" />
                        <span className="text-[9px] text-gray-500">{Math.round(sectionVisualNumber(selectedSection.overlayOpacity, 0.35, 0, 1) * 100)}%</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Min height')}<input type="number" min="0" max="1200" value={sectionVisualNumber(effectiveSectionStyle(selectedSection, device).minHeight, 0, 0, 1200)} onChange={(e) => updateSelectedSectionResponsive({ minHeight: Math.min(1200, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Corner radius')}<input type="number" min="0" max="80" value={sectionVisualNumber(selectedSection.sectionRadius, 0, 0, 80)} onChange={(e) => updateSelected({ sectionRadius: Math.min(80, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Vertical padding')}<input type="number" min="0" max="240" value={sectionVisualNumber(effectiveSectionStyle(selectedSection, device).sectionPaddingY, theme.sectionSpacing, 0, 240)} onChange={(e) => updateSelectedSectionResponsive({ sectionPaddingY: Math.min(240, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Horizontal padding')}<input type="number" min="0" max="160" value={sectionVisualNumber(effectiveSectionStyle(selectedSection, device).sectionPaddingX, 24, 0, 160)} onChange={(e) => updateSelectedSectionResponsive({ sectionPaddingX: Math.min(160, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {([['boxed', 'Boxed'], ['full', 'Full width']] as const).map(([width, label]) => (
                    <button key={width} type="button" onClick={() => updateSelected({ contentWidth: width as SectionContentWidth })} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${sectionContentWidth(selectedSection) === width ? 'border-fuchsia-400 bg-fuchsia-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-100'}`}>{label}</button>
                  ))}
                </div>
              </div>

              {selectedSection.type === 'contact' && (
                <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-cyan-400">{l('Form Builder')}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l("Add, edit and reorder the fields visitors must fill in.")}</p>
                    </div>
                    <button type="button" onClick={resetContactForm} className="text-[10px] font-semibold text-cyan-400">{l('Reset')}</button>
                  </div>

                  <div className="space-y-2">
                    {(selectedSection.formFields ?? createDefaultContactFormFields()).map((field, fieldIndex, fieldList) => (
                      <div key={field.id} className={`rounded-lg border p-2 ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white'}`}>
                        <div className="mb-2 flex items-center gap-1">
                          <select
                            value={field.type}
                            onChange={(e) => updateFormField(field.id, {
                              type: e.target.value as WebsiteFormFieldType,
                              options: e.target.value === 'select' ? (field.options?.length ? field.options : ['Option 1', 'Option 2']) : undefined,
                            })}
                            className={`min-w-0 flex-1 rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}
                          >
                            <option value="text">{l('Text')}</option>
                            <option value="email">{l('Email')}</option>
                            <option value="tel">{l('Phone')}</option>
                            <option value="textarea">{l('Textarea')}</option>
                            <option value="select">{l('Select')}</option>
                            <option value="checkbox">{l('Checkbox')}</option>
                          </select>
                          <button type="button" onClick={() => moveFormField(field.id, 'up')} disabled={fieldIndex === 0} className="rounded p-1 text-gray-400 disabled:opacity-25" title={l('Move up')}><ChevronUp className="h-3 w-3" /></button>
                          <button type="button" onClick={() => moveFormField(field.id, 'down')} disabled={fieldIndex === fieldList.length - 1} className="rounded p-1 text-gray-400 disabled:opacity-25" title={l('Move down')}><ChevronDown className="h-3 w-3" /></button>
                          <button type="button" onClick={() => deleteFormField(field.id)} className="rounded p-1 text-rose-400" title={l('Delete field')}><Trash2 className="h-3 w-3" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={field.label}
                            onChange={(e) => updateFormField(field.id, { label: e.target.value })}
                            placeholder={l('Label')}
                            className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                          <input
                            value={field.name}
                            onChange={(e) => updateFormField(field.id, { name: e.target.value })}
                            placeholder="field_name"
                            className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                        </div>
                        {field.type !== 'checkbox' && (
                          <input
                            value={field.placeholder || ''}
                            onChange={(e) => updateFormField(field.id, { placeholder: e.target.value })}
                            placeholder={l('Placeholder')}
                            className={`mt-2 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                        )}
                        {field.type === 'select' && (
                          <textarea
                            value={(field.options || []).join('\n')}
                            onChange={(e) => updateFormField(field.id, { options: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })}
                            rows={3}
                            placeholder={'One option per line'}
                            className={`mt-2 w-full resize-none rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                        )}
                        <label className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateFormField(field.id, { required: e.target.checked })} />{l("Required field")}</label>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(['text', 'email', 'tel', 'textarea', 'select', 'checkbox'] as WebsiteFormFieldType[]).map((type) => (
                      <button key={type} type="button" onClick={() => addFormField(type)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${darkMode ? 'border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-100'}`}>
                        + {type === 'tel' ? 'Phone' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>

                  <label className="block text-[10px] text-gray-500">{l('After submit')}<select
                      value={selectedSection.formSuccessAction === 'redirect' ? 'redirect' : 'message'}
                      onChange={(e) => updateSelected({ formSuccessAction: e.target.value === 'redirect' ? 'redirect' : 'message' })}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}
                    >
                      <option value="message">{l('Show success message')}</option>
                      <option value="redirect">{l('Redirect to thank-you page / URL')}</option>
                    </select>
                  </label>

                  {selectedSection.formSuccessAction === 'redirect' ? (
                    <div className="space-y-2">
                      <label className="block text-[10px] text-gray-500">{l('Redirect target')}<input
                          value={selectedSection.formRedirectUrl || ''}
                          onChange={(e) => updateSelected({ formRedirectUrl: e.target.value })}
                          placeholder="page:thank-you or https://example.com/thanks"
                          className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                        />
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {pages.map((page) => (
                          <button key={page.id} type="button" onClick={() => updateSelected({ formRedirectUrl: `page:${page.slug}` })} className={`rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 text-gray-300' : 'border-gray-200 text-gray-600'}`}>{page.name}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <label className="block text-[10px] text-gray-500">{l('Success message')}<input
                        value={selectedSection.formSuccessMessage || 'Thanks! Your message has been sent.'}
                        onChange={(e) => updateSelected({ formSuccessMessage: e.target.value })}
                        className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                      />
                    </label>
                  )}
                </div>
              )}

              {selectedSection.type !== 'footer' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Button Text")}</label>
                    <input
                      value={selectedSection.buttonText}
                      onChange={(e) =>
                        updateSelected({ buttonText: e.target.value })
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                        darkMode
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <Link className="h-3.5 w-3.5" />{l("Button Link")}</label>
                    <input
                      value={selectedSection.buttonUrl}
                      onChange={(e) =>
                        updateSelected({ buttonUrl: e.target.value })
                      }
                      placeholder="#contact or https://..."
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                        darkMode
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      }`}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Palette className="h-3.5 w-3.5" />{l('Background')}</label>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSection.background}
                    onChange={(e) =>
                      updateSelected({ background: e.target.value })
                    }
                    className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    value={selectedSection.background}
                    onChange={(e) =>
                      updateSelected({ background: e.target.value })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Accent")}</label>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSection.accent}
                    onChange={(e) =>
                      updateSelected({ accent: e.target.value })
                    }
                    className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    value={selectedSection.accent}
                    onChange={(e) =>
                      updateSelected({ accent: e.target.value })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-300">{l("AI Image")}</label>

                  <textarea
                    value={selectedSection.imagePrompt || ''}
                    onChange={(e) =>
                      updateSelected({ imagePrompt: e.target.value })
                    }
                    rows={3}
                    placeholder={l('Describe the image you want for this section...')}
                    className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>

                <button
                  onClick={generateImagePrompt}
                  disabled={aiBusy || aiQualityBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiBusy ? 'Generating...' : '✨ Generate AI Prompt'}
                </button>

                <button
                  onClick={generateRealImage}
                  disabled={aiBusy || aiQualityBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiBusy ? 'Generating Image...' : '🖼️ Generate Image'}
                </button>

                {selectedSection.image &&
                  /^https?:\/\//i.test(selectedSection.image) && (
                    <img
                      src={selectedSection.image}
                      alt={selectedSection.title}
                      className="mt-2 w-full rounded-lg border border-white/10 object-cover"
                    />
                  )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => moveSection(selectedSection.id, 'up')}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Up
                </button>

                <button
                  onClick={() => moveSection(selectedSection.id, 'down')}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />{l("Down")}</button>
              </div>

              <button
                onClick={() => deleteSection(selectedSection.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />{l("Delete Section")}</button>
              </div>
            </details>
          )}
          </div>
        </aside>
      </div>
    </div>
  );

  if (!editorV2Flags.shell) {
    return legacyBuilder;
  }

  return (
    <WebsiteBuilderV2Bridge
      canvas={v2Canvas}
      overlaySlot={commandPaletteOverlay}
      aiPanel={v2AiPanel}
      topbarTrailingSlot={
        <>
          <button
            type="button"
            className="tayar-v2-command-button"
            onClick={() => setCommandOpen(true)}
            aria-label={l('Open command palette')}
            title={l('Open command palette')}
          >
            ⌘K
          </button>
          {selectedElements.length > 1 && (
            <div className="tayar-v2-multi-selection" role="group" aria-label={l('Selected elements actions')}>
              <span>{l('Selected elements')}: {selectedElements.length}</span>
              <select
                value=""
                onChange={(event) => {
                  const action = event.target.value;
                  if (action === 'match-width' || action === 'match-appearance' || action === 'reset-position' || action === 'show' || action === 'hide') normalizeSelectedElementFrames(action);
                  else if (action === 'bring-front') moveSelectedElementsLayer('front');
                  else if (action === 'bring-forward') moveSelectedElementsLayer('forward');
                  else if (action === 'send-backward') moveSelectedElementsLayer('backward');
                  else if (action === 'send-back') moveSelectedElementsLayer('back');
                  else if (action) arrangeSelectedElements(action as Parameters<typeof arrangeSelectedElements>[0]);
                }}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                aria-label={l('Arrange selected elements')}
                title={l('Arrange selected elements')}
              >
                <option value="" disabled>{l('Arrange')}</option>
                <optgroup label={l('Align')}>
                  <option value="left">{l('Align left')}</option>
                  <option value="center">{l('Align center')}</option>
                  <option value="right">{l('Align right')}</option>
                  <option value="top">{l('Align top')}</option>
                  <option value="middle">{l('Align middle')}</option>
                  <option value="bottom">{l('Align bottom')}</option>
                </optgroup>
                <optgroup label={l('Distribute')}>
                  <option value="distribute-horizontal" disabled={selectedElements.length < 3}>{l('Distribute horizontally')}</option>
                  <option value="distribute-vertical" disabled={selectedElements.length < 3}>{l('Distribute vertically')}</option>
                </optgroup>
                <optgroup label={l('Size')}>
                  <option value="match-width">{l('Match width')}</option>
                  <option value="match-appearance">{l('Match appearance')}</option>
                  <option value="reset-position">{l('Reset selected transforms')}</option>
                </optgroup>
                <optgroup label={l('Layer order')}>
                  <option value="bring-front">{l('Bring to front')}</option>
                  <option value="bring-forward">{l('Bring forward')}</option>
                  <option value="send-backward">{l('Send backward')}</option>
                  <option value="send-back">{l('Send to back')}</option>
                </optgroup>
                <optgroup label={l('Visibility')}>
                  <option value="show">{l('Show selected')}</option>
                  <option value="hide">{l('Hide selected')}</option>
                </optgroup>
              </select>
              <button
                type="button"
                onClick={createContainerForSelected}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                title={l('Group selected elements')}
              >
                {l('Group')}
              </button>
              {selectedElements.some((element) => element.containerId) && (
                <button
                  type="button"
                  onClick={ungroupSelectedElements}
                  disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                  title={l('Ungroup selected elements')}
                >
                  {l('Ungroup')}
                </button>
              )}
              <button
                type="button"
                onClick={duplicateSelectedTarget}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                title={l('Duplicate selected elements')}
              >
                {l('Duplicate')}
              </button>
              <button
                type="button"
                onClick={deleteSelectedTarget}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy || selectedElements.length >= (selectedSection?.elements.length || 0)}
                title={l('Delete selected elements')}
              >
                {l('Delete')}
              </button>
            </div>
          )}
          {canPasteCopiedTarget() && editorClipboard && (
            <button
              type="button"
              className="tayar-v2-clipboard-button"
              onClick={pasteCopiedTarget}
              disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
              title={l(editorClipboard.kind === 'section' ? 'Paste copied section' : editorClipboard.kind === 'elements' ? 'Paste copied elements' : 'Paste copied element')}
            >
              {l(editorClipboard.kind === 'section' ? 'SECTION READY' : editorClipboard.kind === 'elements' ? 'ELEMENTS READY' : 'ELEMENT READY')}
            </button>
          )}
          {publishedUrl && (
          <button
            type="button"
            className="tayar-v2-live-button"
            onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}
            title={publishedUrl}
          >
            {liveVerification === 'healthy' ? 'LIVE ↗' : 'Open ↗'}
          </button>
          )}
        </>
      }
      sitePanel={v2SitePanel}
      settingsPanel={v2SettingsPanel}
      symbols={symbols as unknown as EditorSymbolLike[]}
      onCreateSymbol={createSymbolFromSelected}
      onDetachSymbol={detachSelectedSymbol}
      onInsertSymbol={(symbolId) => {
        const symbol = symbols.find((item) => item.id === symbolId);
        if (symbol) insertSymbol(symbol);
      }}
      onDeleteSymbol={deleteSymbol}
      onRenameSymbol={renameSymbol}
      onDuplicateSymbol={duplicateSymbol}
      onSelectSymbolInstance={selectNextSymbolInstance}
      pages={pages.map((page) =>
        page.id === activePageId
          ? { ...page, sections }
          : page
      ) as unknown as EditorPageLike[]}
      homePageId={homePageId}

      mediaAssets={mediaAssets.map((asset) => ({
        id: asset.path,
        kind: 'image' as const,
        origin: 'upload' as const,
        url: asset.url,
        name: asset.name,
        createdAt: asset.createdAt
          ? Date.parse(asset.createdAt)
          : undefined,
      }))}

      onMediaOpen={() => {
        void refreshMedia();
      }}

      onMediaUpload={openV2MediaUpload}

      onGenerateMediaWithAI={async (prompt) => {
        await generateMediaLibraryImage(prompt);
      }}

      onAddPage={addPage}

      onMovePage={movePage}

      onDuplicatePage={
        duplicateActivePage
      }

      onDeletePage={
        deleteActivePage
      }

      onSetHomePage={
        makeActivePageHome
      }

      onMoveSection={
        moveSection
      }

      onDuplicateSection={
        v2DuplicateSectionDirect
      }

      onDeleteSection={
        deleteSection
      }

      onMoveElement={
        v2MoveElementDirect
      }

      onDuplicateElement={
        v2DuplicateElementDirect
      }

      onCopySelection={copySelectedTarget}
      onCutSelection={cutSelectedTarget}
      onPasteSelection={pasteCopiedTarget}
      clipboardKind={canPasteCopiedTarget() ? editorClipboard?.kind : undefined}

      onDeleteElement={
        v2DeleteElementDirect
      }

      onApplyOperations={applyV2NativeOperations}
      onRestoreHistoryEntry={restoreEditHistoryEntry}

      accent={
        selectedSection?.accent ||
        brand.colors.primary
      }
      activePageId={activePageId}
      selectedSectionId={selectedId}
      selectedElementId={selectedElementId}
      selectedElementIds={selectedElementIds}
      selectedContainerId={selectedContainerId}
      selectedFormFieldId={selectedFormFieldId}
      device={device}
      dirty={hasUnsavedChanges}
      canUndo={history.length > 0}
      canRedo={future.length > 0}
      historyEntries={history.map((entry) => ({
        id: entry.id,
        label: entry.label,
        createdAt: Date.parse(entry.savedAt) || Date.now(),
        source: 'manual' as const,
      }))}
      futureEntries={future.map((entry) => ({
        id: entry.id,
        label: entry.label,
        createdAt: Date.parse(entry.savedAt) || Date.now(),
        source: 'manual' as const,
      }))}
      saving={cloudBusy || autoSaveStatus === 'saving'}
      publishing={publishBusy}
      checking={launchCheckBusy}
      mutating={cloudBusy || publishBusy || launchCheckBusy || aiBusy || aiQualityBusy}
      saveError={cloudError || (autoSaveStatus === 'failed' ? 'Autosave needs attention.' : undefined)}
      publishError={publishError || undefined}
      checkScore={siteAudit.score}
      checkErrors={siteAudit.errors.length}
      checkWarnings={siteAudit.warnings.length}
      lastCheckedAt={launchLastCheckedAt ? Date.parse(launchLastCheckedAt) : undefined}
      publishedUrl={publishedUrl || undefined}
      publishedAt={publishedAt ? Date.parse(publishedAt) : undefined}
      publishedOutdated={hasUnpublishedChanges}
      liveVerification={liveVerification}
      publishBlockers={[
        !user ? 'Sign in before publishing.' : '',
        !networkOnline ? 'Reconnect before publishing.' : '',
        user && cloudProjectId && !projectTeamAccess.canPublish ? 'Only the project owner can publish.' : '',
        siteAudit.errors.length ? `Fix ${siteAudit.errors.length} critical Check issue${siteAudit.errors.length === 1 ? '' : 's'} before publishing.` : '',
      ].filter(Boolean)}
      onUndo={undo}
      onRedo={redo}
      onSave={() => void saveProject()}
      onPreview={previewWebsite}
      onPublish={() => void publishWebsite()}
      onRunCheck={() => void runV1LaunchChecks()}
      onSetDevice={(nextDevice) => {
        clearEditorDragState();
        setDevice(nextDevice as Device);
      }}
      onSelect={(selection) => {
        const currentPages = getCurrentPages();
        const targetPageId = selection.pageId || activePageId;
        const targetPage = currentPages.find((page) => page.id === targetPageId);
        if (!targetPage) return;

        if (targetPage.id !== activePageId) {
          switchPage(targetPage.id);
        }

        if (!selection.sectionId) return;

        const targetSection = targetPage.sections.find(
          (section) => section.id === selection.sectionId,
        );
        if (!targetSection) return;

        const elementId =
          selection.elementId &&
          targetSection.elements.some((element) => element.id === selection.elementId)
            ? selection.elementId
            : null;
        const containerId =
          !elementId &&
          selection.containerId &&
          (targetSection.containers || []).some((container) => container.id === selection.containerId)
            ? selection.containerId
            : null;
        const formFieldId =
          !elementId &&
          !containerId &&
          selection.formFieldId &&
          (targetSection.formFields || []).some((field) => field.id === selection.formFieldId)
            ? selection.formFieldId
            : null;

        selectEditorTarget(
          targetSection.id,
          elementId,
          containerId,
          formFieldId,
        );
        setInspectorOpen(true);
      }}
      onSelectElement={(sectionId, elementId, additive, range) => {
        selectCanvasElement(sectionId, elementId, additive, range);
        setInspectorOpen(true);
      }}
    />
  );
}
