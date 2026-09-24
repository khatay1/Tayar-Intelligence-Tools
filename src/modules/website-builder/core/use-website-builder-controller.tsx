import { useAuth } from '@/context/AuthContext';
import { usePreferences,type Language } from '@/context/PreferencesContext';
import { createAIService } from '@/lib/ai/service';
import {
buildPublishedSiteUrl
} from '@/lib/published-site-url';
import { useLocalizer } from '@/lib/ui-localization';
import { useCallback,useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createCandidateReviewHandlers } from './editor-ai-candidate-review-handlers';
import { createAIRequestHandlers } from './editor-ai-request-handlers';
import { createAIImagePromptHandler } from './editor-ai-image-prompt-handler';
import { createAIUndoHandler } from './editor-ai-undo-handler';
import { createLazyAIChangeHandler } from './editor-ai-change-loader';
import { createAIGenerationHandler } from './editor-ai-generation-handler';
import { createAIImageHandler } from './editor-ai-image-handler';
import { createAIQualityCheckHandler } from './editor-ai-quality-handler';
import { createApplyProjectDataHandler } from './editor-apply-project-handler';
import { createArrangeSelectedElementsHandler } from './editor-arrange-handler';
import { createClientHandoffHandler } from './editor-client-handoff-handler';
import { createPrepareElementFreeDragHandler } from './editor-drag-prepare-handler';
import { createUpdateElementFreeDragHandler } from './editor-drag-update-handler';
import { createDuplicateProjectHandler } from './editor-duplicate-project-handler';
import { createImportProjectBackupHandler } from './editor-import-backup-handler';
import { createLeadManagementHandlers } from './editor-lead-management-handlers';
import { createMediaManagementHandlers } from './editor-media-management-handlers';
import { createPageManagementHandlers } from './editor-page-management-handlers';
import { createFormManagementHandlers } from './editor-form-management-handlers';
import { createElementContentHandlers } from './editor-element-content-handlers';
import { createElementDragHandlers } from './editor-element-drag-handlers';
import { createEditorExportHandlers } from './editor-export-handlers';
import { createLivePreviewHandlers } from './editor-live-preview-handlers';
import { createReleaseHistoryHandlers } from './editor-release-history-handlers';
import { createLaunchActions } from './editor-launch-actions';
import { calculateLaunchReadiness, calculateV1LaunchStatus } from './editor-launch-readiness';
import { createEditHistoryHandlers } from './editor-edit-history-handlers';
import { createDeliveryActions } from './editor-delivery-actions';
import { createV2DirectActions } from './editor-v2-direct-actions';
import { createElementArrangementHandlers } from './editor-element-arrangement-handlers';
import { createEditorClipboardHandlers } from './editor-clipboard-handlers';
import { createPublishWebsiteHandler } from './editor-publish-handler';
import { createRecoverPublishedStateHandler } from './editor-recover-published-handler';
import { createResetProjectHandler } from './editor-reset-project-handler';
import { createReusableElementHandlers } from './editor-reusable-element-handlers';
import { createRollbackPublishVersionHandler } from './editor-rollback-handler';
import { createSaveProjectHandler } from './editor-save-handler';
import { createSectionManagementHandlers } from './editor-section-management-handlers';
import { createSectionEditingHandlers } from './editor-section-editing-handlers';
import { createSharePreviewHandler } from './editor-share-preview-handler';
import { createUnpublishWebsiteHandler } from './editor-unpublish-handler';
import { createV2DeleteElementHandler } from './editor-v2-delete-handler';
import { createV2DuplicateElementHandler } from './editor-v2-duplicate-handler';
import { createV2NativeOperationsHandler } from './editor-v2-native-handler';

export interface WebsiteBuilderToolProps {
  darkMode: boolean;
  projectId?: string | null;
}

import { listWebsiteProjectsInCloud } from '../services/projectCloudService';
import { listWebsitePublishVersions } from '../services/publishVersionService';
import { deleteReusableSectionInCloud,listReusableSectionsInCloud,saveReusableSectionInCloud } from '../services/reusableSectionService';
import { getWebsiteProjectTeamAccess } from '../services/websiteAccessService';
import { listWebsiteAnalyticsEvents } from '../services/websiteAnalyticsService';
import { createWebsiteCheckoutSession,getWebsiteBuilderBillingState,openWebsiteBillingPortalSession } from '../services/websiteBillingService';
import {
checkWebsiteCustomDomain,
connectWebsiteCustomDomain,
getWebsiteCustomDomain,
removeWebsiteCustomDomain,
type WebsiteCustomDomain,
} from '../services/websiteDomainService';
import { listWebsiteFormDeliveries,type WebsiteFormDelivery } from '../services/websiteFormService';
import { listWebsiteLeads } from '../services/websiteLeadService';
import { getWebsiteMediaPublicUrl,listWebsiteMediaFiles } from '../services/websiteMediaService';
import { SECTION_LABELS,defaultBrand,defaultSEO,defaultSections,normalizeSection } from './defaults';
import {
DEFAULT_DELIVERY_CONFIG,
type WebsiteDeliveryConfig
} from './delivery-config';
import { buildAIEditableSnapshotData } from './editor-ai-editable-snapshot';
import {
editorAIContextMatches,
editorAIProjectIdentityMatches,
type EditorAIAsyncContext,
} from './editor-ai-operation-context';
import {
mergeAIWebsitePatchReviewKind,
type AIQualityReview,
type AIWebsiteCanvasPreview,
type AIWebsitePatchReview,
type AIWebsitePlanReview
} from './editor-ai-patch-review';
import {
aiWebsitePatchReviewItemIsGlobal,
aiWebsitePatchReviewItemTargetsPage
} from './editor-ai-review-targets';
import {
type AIBuilderMessage,
type AIBuilderStage,
type AIEditScope,
type AIEditScopeTarget
} from './editor-ai-scope';
import { decideEditorAutosave } from './editor-autosave-policy';
import {
type CanvasAlignmentTargets,
type CanvasBounds,
type CanvasSnapGuides
} from './editor-canvas-geometry';
import { resolveWebsiteBuilderV2Flags } from './editor-feature-flags';
import {
DEFAULT_EDITOR_PROJECT_ACCESS,
createEditorProjectAccessFallback,
normalizeEditorProjectAccess,
resolveEditorProjectOwnerId,
type EditorProjectAccess,
} from './editor-project-access';
import {
hasRecoveryWebsiteProject,
loadActiveWebsiteProjectId,
loadLocalWebsiteProject,
loadRecoveryWebsiteProject,
saveActiveWebsiteProjectId,
saveLocalWebsiteProject,
saveRecoveryWebsiteProject
} from './editor-project-lifecycle';
import { languageCodeLabel,normalizePageLanguage,normalizeSlug } from './project-identifiers';
import type { Device,WebsiteBrand,WebsiteElement,WebsiteSEO,WebsiteSection } from './types';
import { summarizeWebsiteAnalytics } from './website-analytics-summary';
import {
BILLING_PLAN_DETAILS,
DEFAULT_FOOTER_CONFIG,
DEFAULT_HEADER_CONFIG,
DEFAULT_PRODUCTION_CONFIG,
DEFAULT_SITE_ENHANCEMENTS,
DEFAULT_THEME,
FREE_BILLING_ENTITLEMENTS,
REUSABLE_SECTIONS_KEY,
applyThemeToSection,
normalizeBillingStatePayload,
normalizeProductionConfig,
normalizeTheme,
resolveEffectiveProductionConfig
} from './website-builder-config';
import {
type AIWebsiteCandidatePreview,
type AIWebsiteUndoSnapshot,
type BillingFeature,
type BillingState,
type CloudWebsiteProject,
type LeadStage,
type LiveVerification,
type PersistedWebsiteProject,
type ProjectHistoryEntry,
type ReusableSectionTemplate,
type WebsiteAnalyticsEvent,
type WebsiteClipboard,
type WebsiteFooterConfig,
type WebsiteHeaderConfig,
type WebsiteLead,
type WebsiteMediaAsset,
type WebsitePage,
type WebsiteProductionConfig,
type WebsitePublishVersion,
type WebsiteSiteEnhancements,
type WebsiteSymbol,
type WebsiteTheme
} from './website-builder-model';
import { createWebsiteBuilderOutput } from './website-builder-output';
import {
cloneSectionWithFreshIds,
cloneSymbolElement,
downloadTextFile,
normalizeSiteUrl,
safeFormRedirectHref,
} from './website-builder-rendering';
import { buildV1LaunchReportText } from './website-builder-reports';
import { EMPTY_WEBSITE_CMS,materializeWebsiteCmsSections,queryWebsiteCmsEntries,validateWebsiteCms,type WebsiteCmsState } from './website-cms';
import {
analyzeWebsiteDesignSystem,
repairWebsiteDesignTokens,
type WebsiteDesignSystemPreset
} from './website-design-system';
import {
DEFAULT_WEBSITE_LOCALIZATION,
validateWebsiteLocalization,
type WebsiteLocalizationConfig
} from './website-localization';

const LAUNCH_CENTER_SEEN_KEY = 'tayar.website-builder.launch-center-seen.v1';
const LAUNCH_MANUAL_CHECKS_KEY = 'tayar.website-builder.launch-manual-checks.v1';


export function useWebsiteBuilderController({
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
  const [cms, setCms] = useState<WebsiteCmsState>(EMPTY_WEBSITE_CMS);
  const [localization, setLocalization] = useState<WebsiteLocalizationConfig>(() => ({
    ...DEFAULT_WEBSITE_LOCALIZATION,
    defaultLanguage: prefs.language,
  }));

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
  const canvasArrangementRef = useRef<{ key: string; appliedAt: number } | null>(null);
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
  const [customDomain, setCustomDomain] = useState<WebsiteCustomDomain | null>(null);
  const [customDomainDraft, setCustomDomainDraft] = useState('');
  const [customDomainBusy, setCustomDomainBusy] = useState(false);
  const [customDomainError, setCustomDomainError] = useState('');
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
  const [previewFingerprint, setPreviewFingerprint] = useState('');
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
  const [formDeliveries, setFormDeliveries] = useState<WebsiteFormDelivery[]>([]);
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
  const cloudRevisionRef = useRef<{ projectId: string; updatedAt: string | null } | null>(null);
  const saveInFlightRef = useRef(false);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const newProjectIntentRef = useRef(false);
  const projectLoadSequenceRef = useRef(0);
  const savedFeedbackSequenceRef = useRef(0);
  const aiOperationSequenceRef = useRef(0);
  const aiChangeModuleLoadingRef = useRef<number | null>(null);
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

  const refreshCustomDomain = useCallback(async () => {
    if (!cloudProjectId || !user) {
      setCustomDomain(null);
      setCustomDomainDraft('');
      return;
    }
    const loadSequence = projectLoadSequenceRef.current;
    const project = cloudProjectId;
    const userId = user.id;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      const domain = await getWebsiteCustomDomain(project);
      if (projectLoadSequenceRef.current !== loadSequence || activeUserIdRef.current !== userId) return;
      setCustomDomain(domain);
      setCustomDomainDraft(domain?.hostname || '');
    } catch (error) {
      if (projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId) {
        setCustomDomainError(error instanceof Error ? error.message : 'Could not load the custom domain.');
      }
    } finally {
      if (projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId) setCustomDomainBusy(false);
    }
  }, [cloudProjectId, user]);

  async function connectCustomDomain() {
    if (!cloudProjectId || !customDomainDraft.trim()) return;
    const loadSequence = projectLoadSequenceRef.current;
    const project = cloudProjectId;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      const domain = await connectWebsiteCustomDomain(project, customDomainDraft);
      if (projectLoadSequenceRef.current !== loadSequence) return;
      setCustomDomain(domain);
      setCustomDomainDraft(domain?.hostname || customDomainDraft.trim().toLowerCase());
      if (domain?.warning) setCustomDomainError(domain.warning);
      if (domain?.status === 'verified') { setSiteUrl(`https://${domain.hostname}`); setSaved(false); }
    } catch (error) {
      if (projectLoadSequenceRef.current === loadSequence) setCustomDomainError(error instanceof Error ? error.message : 'Could not connect the domain.');
    } finally {
      if (projectLoadSequenceRef.current === loadSequence) setCustomDomainBusy(false);
    }
  }

  async function checkCustomDomain() {
    if (!cloudProjectId || !customDomain?.hostname) return;
    const loadSequence = projectLoadSequenceRef.current;
    const project = cloudProjectId;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      const domain = await checkWebsiteCustomDomain(project, customDomain.hostname);
      if (projectLoadSequenceRef.current !== loadSequence) return;
      setCustomDomain(domain);
      if (domain?.status === 'verified') { setSiteUrl(`https://${domain.hostname}`); setSaved(false); }
    } catch (error) {
      if (projectLoadSequenceRef.current === loadSequence) setCustomDomainError(error instanceof Error ? error.message : 'Could not verify the domain.');
    } finally {
      if (projectLoadSequenceRef.current === loadSequence) setCustomDomainBusy(false);
    }
  }

  async function removeCustomDomain() {
    if (!cloudProjectId || !customDomain) return;
    if (!window.confirm(l('Disconnect this custom domain?'))) return;
    const loadSequence = projectLoadSequenceRef.current;
    const project = cloudProjectId;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      await removeWebsiteCustomDomain(project);
      if (projectLoadSequenceRef.current !== loadSequence) return;
      setCustomDomain(null);
      setCustomDomainDraft('');
    } catch (error) {
      if (projectLoadSequenceRef.current === loadSequence) setCustomDomainError(error instanceof Error ? error.message : 'Could not disconnect the domain.');
    } finally {
      if (projectLoadSequenceRef.current === loadSequence) setCustomDomainBusy(false);
    }
  }

  useEffect(() => { void refreshCustomDomain(); }, [refreshCustomDomain]);

  const getCurrentPages = useCallback(() => {
    return pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
  }, [pages, activePageId, sections]);

  const buildProjectSnapshot = useCallback(() => {
    return {
      version: 6,
      cloudProjectId,
      siteName,
      siteUrl,
      faviconUrl,
      publishedUrl,
      publishedAt,
      previewUrl,
      previewToken,
      previewCreatedAt,
      previewFingerprint,
      lastPublishedVersionId,
      lastPublishedFingerprint,
      activePageId,
      homePageId,
      pages: getCurrentPages(),
      cms,
      localization,
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
  }, [cloudProjectId, siteName, siteUrl, faviconUrl, publishedUrl, publishedAt, previewUrl, previewToken, previewCreatedAt, previewFingerprint, lastPublishedVersionId, lastPublishedFingerprint, activePageId, homePageId, getCurrentPages, cms, localization, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, deliveryConfig, symbols, seo, prefs.language]);

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
      previewFingerprint,
      lastPublishedVersionId,
      lastPublishedFingerprint,
      activePageId,
      homePageId,
      pages: getCurrentPages(),
      cms,
      localization,
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
  }, [siteName, siteUrl, faviconUrl, publishedUrl, publishedAt, previewUrl, previewToken, previewCreatedAt, previewFingerprint, lastPublishedVersionId, lastPublishedFingerprint, activePageId, homePageId, getCurrentPages, cms, localization, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, deliveryConfig, symbols, seo, prefs.language]);

  const buildEditableFingerprint = useCallback(() => {
    return JSON.stringify({
      siteName,
      siteUrl,
      faviconUrl,
      homePageId,
      pages: getCurrentPages(),
      cms,
      localization,
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
  }, [siteName, siteUrl, faviconUrl, homePageId, getCurrentPages, cms, localization, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, symbols, seo, prefs.language]);

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

    const applyProjectData = createApplyProjectDataHandler({
    prefs,
    setActivePageId,
    setBrand,
    setCms,
    setDeliveryConfig,
    setFaviconUrl,
    setFooterConfig,
    setFuture,
    setHeaderConfig,
    setHistory,
    setHomePageId,
    setLastPublishedFingerprint,
    setLastPublishedVersionId,
    setLiveVerification,
    setLocalization,
    setPages,
    setPreviewCreatedAt,
    setPreviewError,
    setPreviewFingerprint,
    setPreviewToken,
    setPreviewUrl,
    setProductionConfig,
    setProjectHistory,
    setPublishedAt,
    setPublishedUrl,
    setPublishError,
    setSaved,
    setSections,
    setSelectedElementId,
    setSelectedId,
    setSeo,
    setSiteEnhancements,
    setSiteName,
    setSiteUrl,
    setSymbols,
    setTheme,
  });

  // Local draft restoration is keyed to the opened project, while the handler
  // receives the current language and state setters on each render.
  const applyProjectDataRef = useRef(applyProjectData);
  useEffect(() => {
    applyProjectDataRef.current = applyProjectData;
  }, [applyProjectData]);

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
      cloudRevisionRef.current = null;
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

  function applyDesignSystemTheme(nextTheme: WebsiteTheme, label: string) {
    const normalized = normalizeTheme(nextTheme);
    remember(sections, label);
    const nextPages = getCurrentPages().map((page) => ({
      ...page,
      sections: page.sections.map((section, index) => applyThemeToSection(section, index, normalized)),
    }));
    const active = nextPages.find((page) => page.id === activePageId) || nextPages[0];
    setTheme(normalized);
    setPages(nextPages);
    setSections(active?.sections || []);
    setSelectedId(active?.sections[0]?.id ?? null);
    setSelectedElementId(active?.sections[0]?.elements[0]?.id ?? null);
    setSaved(false);
  }

  function applyDesignSystemPreset(preset: WebsiteDesignSystemPreset) {
    applyDesignSystemTheme(preset.theme, `Apply ${preset.name} design system`);
  }

  function repairActiveDesignSystem() {
    const repaired = repairWebsiteDesignTokens(theme, getCurrentPages());
    remember(sections, 'Repair design system tokens');
    setTheme(repaired.theme);
    setPages(repaired.pages);
    setSections((repaired.pages.find((page) => page.id === activePageId) || repaired.pages[0])?.sections || []);
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

    const recoverPublishedProjectState = createRecoverPublishedStateHandler({
    activeUserIdRef,
    cloudRevisionRef,
    projectLoadSequenceRef,
    publicWebsiteUrl,
    setCloudProjects,
    setLiveVerification,
    setPublishedAt,
    setPublishedUrl,
    user,
  });

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
    cloudRevisionRef.current = { projectId: project.id, updatedAt: project.updated_at || null };
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
    setFormDeliveries([]);
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
        setFormDeliveries([]);
        setLeadsError('');
        setLeadsLoading(false);
      }
      return;
    }

    if (!projectTeamAccess.canManage) {
      if (refreshIsCurrent()) {
        setLeads([]);
        setFormDeliveries([]);
        setLeadsError('Lead inbox is available to project owners and workspace admins.');
        setLeadsLoading(false);
      }
      return;
    }

    setLeadsLoading(true);
    setLeadsError('');

    const [leadResult, deliveryResult] = await Promise.all([
      listWebsiteLeads(refreshProjectId),
      listWebsiteFormDeliveries(refreshProjectId),
    ]);

    if (!refreshIsCurrent()) return;

    if (leadResult.error) {
      setLeadsError('Lead inbox is unavailable. Make sure the Sprint 11 database migration is applied.');
      setLeadsLoading(false);
      return;
    }

    const nextLeads = (leadResult.data || []) as WebsiteLead[];
    setLeads(nextLeads);
    setFormDeliveries((deliveryResult.data || []) as WebsiteFormDelivery[]);
    if (deliveryResult.error) setLeadsError('Automation delivery history is unavailable. Apply the Forms + Automations MAX database migration.');
    setSelectedLeadIds((current) => current.filter((id) => nextLeads.some((lead) => lead.id === id)));
    setLeadsLoading(false);
  }, [user, cloudProjectId, projectTeamAccess.canManage]);

  const { updateLeadStatus, updateLeadCrm, bulkUpdateLeadStage, copyLeadSummary, deleteLead, openWebsiteFormUpload, markAllLeadsRead, archiveReadLeads } = createLeadManagementHandlers({
    user,
    cloudProjectId,
    projectTeamAccess,
    activeProjectOwnerId,
    projectLoadSequenceRef,
    activeUserIdRef,
    leads,
    selectedLeadIds,
    setLeads,
    setSelectedLeadIds,
    setLeadsError,
    l,
  });

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
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? null,
    [sections, selectedId]
  );

  const selectedElement = useMemo(
    () => selectedSection?.elements.find((element) => element.id === selectedElementId) ?? null,
    [selectedSection, selectedElementId]
  );

  const { applyMediaAsset, uploadMediaFile, deleteMediaAsset, openV2MediaUpload } = createMediaManagementHandlers({
    user,
    l,
    sections,
    selectedSection,
    selectedElement,
    setSections,
    setSelectedElementId,
    setSaved,
    setMediaError,
    setMediaUploading,
    setMediaAssets,
    mediaUploadSequenceRef,
    mediaDeleteSequenceRef,
    projectLoadSequenceRef,
    activeUserIdRef,
    captureAIEditorContext,
    aiEditorContextIsCurrent,
    refreshMedia,
    remember,
    updateSelectedElement,
  });

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
        applyProjectDataRef.current(savedProject);
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
    if (!networkOnline || !cloudSyncFailed || !user?.id || !projectTeamAccess.canEdit || publishBusy || previewBusy) return;

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
  }, [networkOnline, cloudSyncFailed, user?.id, cloudProjectId, projectTeamAccess.canEdit, publishBusy, previewBusy]);

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
    if (publishBusy || previewBusy) return;
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
  }, [buildProjectFingerprint, user, cloudProjectsLoaded, projectId, cloudProjectId, publishBusy, previewBusy]);

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
  const cmsIssues = useMemo(() => validateWebsiteCms(cms, getCurrentPages()), [cms, getCurrentPages]);
  const cmsErrors = useMemo(() => cmsIssues.filter((issue) => issue.severity === 'error'), [cmsIssues]);
  const localizationIssues = useMemo(
    () => validateWebsiteLocalization(getCurrentPages(), homePageId, localization),
    [getCurrentPages, homePageId, localization],
  );

  const aiCandidateShowingBefore = aiCandidatePreview?.viewMode === 'before';
  const canvasPages = aiCandidatePreview
    ? aiCandidateShowingBefore ? aiCandidatePreview.baselinePages : aiCandidatePreview.pages
    : pages;
  const canvasActivePageId = aiCandidatePreview?.activePageId ?? activePageId;
  const canvasActivePage = aiCandidatePreview
    ? canvasPages.find((page) => page.id === canvasActivePageId) ?? canvasPages[0] ?? null
    : activePage;
  const cmsPreviewEntryId = activePage?.cmsTemplate
    ? (() => {
        const collection = cms.collections.find((candidate) => candidate.id === activePage.cmsTemplate?.collectionId);
        return collection ? queryWebsiteCmsEntries(collection, activePage.cmsTemplate.viewId)[0]?.id : undefined;
      })()
    : undefined;
  const canvasSections = aiCandidatePreview
    ? canvasActivePage?.sections ?? []
    : materializeWebsiteCmsSections(sections, cms, cmsPreviewEntryId);
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

  const designSystemReport = useMemo(() => analyzeWebsiteDesignSystem(
    theme,
    pages.map((page) => page.id === activePageId ? { ...page, sections } : page),
  ), [activePageId, pages, sections, theme]);

  const siteAudit = useMemo(() => {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const errors: string[] = [];
    const warnings: string[] = [];
    const pageSlugs = new Set(currentPages.map((page) => normalizeSlug(page.slug)));
    const anchors = new Set<string>();
    const canonicalOverrides = new Map<string, number>();

    const translationLanguages = new Map<string, Set<Language>>();
    currentPages.forEach((page) => {
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
    localizationIssues.forEach((issue) => {
      if (issue.code === 'missing-default-translation') warnings.push(issue.message);
      else errors.push(issue.message);
    });
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
    designSystemReport.issues.forEach((issue) => {
      const detail = `Design system: ${issue.title}. ${issue.detail}`;
      if (issue.severity === 'critical') errors.push(detail);
      else warnings.push(detail);
    });

    const uniqueErrors = [...new Set(errors)];
    const uniqueWarnings = [...new Set(warnings)];
    const score = Math.max(0, 100 - uniqueErrors.length * 15 - uniqueWarnings.length * 5);
    return { errors: uniqueErrors.slice(0, 20), warnings: uniqueWarnings.slice(0, 30), score };
  }, [pages, activePageId, homePageId, sections, seo, siteUrl, faviconUrl, headerConfig.enabled, productionConfig, siteName, prefs.language, localizationIssues, designSystemReport]);

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

  const { switchPage, addPage, duplicateActivePage, duplicatePageAsTranslation, updateActivePageMeta, movePage, makeActivePageHome, deleteActivePage } = createPageManagementHandlers({
    pages,
    activePage,
    activePageId,
    homePageId,
    sections,
    language: prefs.language,
    setPages,
    setActivePageId,
    setHomePageId,
    setSections,
    setSaved,
    clearEditorDragState,
    selectEditorTarget,
    remember,
    requirePageCapacity,
    requireBillingFeature,
    l,
  });

  const editHistoryHandlers = createEditHistoryHandlers({
    activePageId, history, future, buildProjectSnapshot, setHistory, setFuture,
    setSaved, skipNextAutosaveRef, snapshotConflictsWithActiveProject,
    prepareProjectStateRestore, applyProjectData, saveRecoverySnapshot, l,
    setCloudError, setHistoryOpen, setAutoSaveStatus,
  });
  function remember(current: WebsiteSection[], label = 'Manual edit') {
    editHistoryHandlers.remember(current, label);
  }
  function undo() { editHistoryHandlers.undo(); }
  function redo() { editHistoryHandlers.redo(); }
  function restoreEditHistoryEntry(entryId: string) { editHistoryHandlers.restoreEditHistoryEntry(entryId); }
  function restoreHistoryEntry(entry: ProjectHistoryEntry) { editHistoryHandlers.restoreHistoryEntry(entry); }

  const { updateSelected, updateSelectedSectionResponsive, resetSelectedSectionResponsive, copySelectedSectionResponsiveFrom, setSelectedSectionLayout } = createSectionEditingHandlers({
    selectedId,
    selectedSection,
    device,
    sections,
    remember,
    setSections,
    setSaved,
  });

  const { addFormField, updateFormField, addFormAutomation, updateFormAutomation, deleteFormAutomation, deleteFormField, moveFormField, resetContactForm } = createFormManagementHandlers({
    selectedSection,
    updateSelected,
    userEmail: user?.email,
  });

  const { addElementToSection, addElement, updateInlineElementContent, updateInlineElementSource, beginElementResize, endElementResize, resizeElementFrame, quickUpdateElement, resetSelectedElementResponsive, copySelectedElementResponsiveFrom, moveSelectedElement } = createElementContentHandlers({
    sections,
    selectedSection,
    selectedElement,
    selectedElementId,
    activePageId,
    device,
    updateSelectedElement,
    canvasResizeSessionRef,
    setSections,
    setPages,
    setSymbols,
    setSelectedId,
    setSelectedElementId,
    setSaved,
    selectEditorTarget,
    remember,
  });

  const elementArrangementHandlers = createElementArrangementHandlers({
    activePageId,
    device,
    sections,
    selectedSection,
    selectedElement,
    selectedElements,
    canvasNudgeSessionRef,
    remember,
    setSections,
    setPages,
    setSymbols,
    setSaved,
    setSelectedContainerId,
  });
  function nudgeSelectedElement(deltaX: number, deltaY: number) {
    elementArrangementHandlers.nudgeSelectedElement(deltaX, deltaY);
  }

    const arrangeSelectedElements = createArrangeSelectedElementsHandler({
    activePageId,
    canvasArrangementRef,
    device,
    remember,
    sections,
    selectedElements,
    selectedSection,
    setPages,
    setSaved,
    setSections,
    setSymbols,
  });

  function normalizeSelectedElementFrames(action: 'match-width' | 'match-appearance' | 'reset-position' | 'show' | 'hide') {
    elementArrangementHandlers.normalizeSelectedElementFrames(action);
  }
  function moveSelectedElementsLayer(destination: 'front' | 'forward' | 'backward' | 'back') {
    elementArrangementHandlers.moveSelectedElementsLayer(destination);
  }
  function ungroupSelectedElements() {
    elementArrangementHandlers.ungroupSelectedElements();
  }

  function resetElementPosition(sectionId: string, elementId: string) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement) return;
    remember(sections);
    const symbolId = targetElement.symbolId;

    const resetElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          positionX: 0,
          positionY: 0,
        },
      },
    });

    const resetSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? resetElement(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? resetSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(resetSection),
      }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId ? {
        ...symbol,
        element: resetElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function updateSelectedElement(changes: Partial<WebsiteElement>, responsive = false) {
    if (!selectedSection || !selectedElementId) return;
    remember(sections);
    const selectedSymbolId = selectedElement?.symbolId;

    const applyChanges = (element: WebsiteElement): WebsiteElement => {
      if (responsive) {
        return {
          ...element,
          responsive: {
            ...element.responsive,
            [device]: { ...(element.responsive?.[device] || {}), ...(changes.style || {}) },
          },
        };
      }
      const preserved = { id: element.id, containerId: element.containerId, layoutColumn: element.layoutColumn, symbolId: element.symbolId };
      return { ...element, ...changes, ...preserved };
    };

    const syncSection = (section: WebsiteSection) => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = selectedSymbolId ? element.symbolId === selectedSymbolId : element.id === selectedElementId;
        return matches ? applyChanges(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === selectedSection.id || selectedSymbolId ? syncSection(section) : section));

    if (selectedSymbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(syncSection),
      }));
      setSymbols((current) => current.map((symbol) => {
        if (symbol.id !== selectedSymbolId) return symbol;
        const base = applyChanges({ ...symbol.element, id: symbol.element.id || `symbol-element-${selectedSymbolId}`, symbolId: selectedSymbolId });
        return { ...symbol, element: cloneSymbolElement(base), updatedAt: new Date().toISOString() };
      }));
    }
    setSaved(false);
  }

  function deleteSelectedElement() {
    if (!selectedSection || !selectedElementId) return;
    if (selectedSection.elements.length <= 1) return;
    remember(sections);
    const remaining = selectedSection.elements.filter((element) => element.id !== selectedElementId);
    setSections((current) => current.map((section) =>
      section.id === selectedSection.id ? { ...section, elements: remaining } : section
    ));
    selectEditorTarget(selectedSection.id, remaining[0]?.id ?? null);
    setSaved(false);
  }

  function duplicateSelectedElement() {
    if (!selectedSection || !selectedElement) return;
    remember(sections);
    const duplicate: WebsiteElement = {
      ...selectedElement,
      id: `${selectedElement.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      style: { ...selectedElement.style },
      responsive: selectedElement.responsive
        ? Object.fromEntries(
            Object.entries(selectedElement.responsive).map(([key, value]) => [key, value ? { ...value } : value])
          ) as WebsiteElement['responsive']
        : undefined,
    };
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;

      const index = section.elements.findIndex((element) => element.id === selectedElement.id);
      if (index < 0) return section;

      const elements = [...section.elements];
      elements.splice(index + 1, 0, duplicate);
      return { ...section, elements };
    }));
    selectEditorTarget(selectedSection.id, duplicate.id);
    setSaved(false);
  }

  const editorClipboardHandlers = createEditorClipboardHandlers({
    device, symbols, sections, selectedSection, selectedElement, selectedElements, selectedElementId,
    cloudProjectId, activeProjectOwnerId, projectLoadSequenceRef, editorClipboard, setEditorClipboard,
    setSections, setSelectedId, setSelectedElementIds, setSelectedElementId,
    setSelectedContainerId, setSelectedFormFieldId, setSaved, selectEditorTarget, remember,
  });
  const { cloneElementForInsertion } = editorClipboardHandlers;
  function copySelectedTarget() { editorClipboardHandlers.copySelectedTarget(); }
  function canPasteCopiedTarget() { return editorClipboardHandlers.canPasteCopiedTarget(); }
  function cutSelectedTarget() { editorClipboardHandlers.cutSelectedTarget(); }
  function pasteCopiedTarget() { editorClipboardHandlers.pasteCopiedTarget(); }

  function duplicateSelectedTarget() {
    if (selectedSection && selectedElements.length > 1) {
      const duplicates = selectedElements.map((element) => cloneElementForInsertion(element, selectedSection));
      const selectedIds = new Set(selectedElements.map((element) => element.id));
      const insertAt = selectedSection.elements.reduce(
        (last, element, index) => selectedIds.has(element.id) ? index + 1 : last,
        selectedSection.elements.length,
      );
      remember(sections, 'Duplicate selected elements');
      setSections((current) => current.map((section) => {
        if (section.id !== selectedSection.id) return section;
        const elements = [...section.elements];
        elements.splice(insertAt, 0, ...duplicates);
        return { ...section, elements };
      }));
      setSelectedElementIds(duplicates.map((element) => element.id));
      setSelectedElementId(duplicates[duplicates.length - 1]?.id ?? null);
      setSaved(false);
      return;
    }
    if (selectedElement) {
      duplicateSelectedElement();
      return;
    }
    if (selectedSection) v2DuplicateSectionDirect(selectedSection.id);
  }

  function deleteSelectedTarget() {
    if (selectedSection && selectedElements.length > 1) {
      if (selectedElements.length >= selectedSection.elements.length) return;
      const selectedIds = new Set(selectedElements.map((element) => element.id));
      const remaining = selectedSection.elements.filter((element) => !selectedIds.has(element.id));
      remember(sections, 'Delete selected elements');
      setSections((current) => current.map((section) =>
        section.id === selectedSection.id ? { ...section, elements: remaining } : section
      ));
      selectEditorTarget(selectedSection.id, remaining[0]?.id ?? null);
      setSaved(false);
      return;
    }
    if (selectedElement) {
      deleteSelectedElement();
      return;
    }
    if (selectedSection) deleteSection(selectedSection.id);
  }

  function createContainerForSelected() {
    reusableElementHandlers.createContainerForSelected();
  }

  const reusableElementHandlers = createReusableElementHandlers({
    sections,
    selectedSection,
    selectedElement,
    selectedElements,
    selectedElementId,
    selectedContainerId,
    selectedId,
    activePageId,
    symbols,
    setSections,
    setPages,
    setSymbols,
    setSelectedContainerId,
    setSaved,
    remember,
    selectEditorTarget,
    getCurrentPages,
    switchPage,
    l,
  });
  const { updateSelectedContainer, assignSelectedToContainer, deleteSelectedContainer, createSymbolFromSelected, insertSymbol, detachSelectedSymbol, deleteSymbol, renameSymbol, duplicateSymbol, selectNextSymbolInstance } = reusableElementHandlers;

    const prepareElementFreeDrag = createPrepareElementFreeDragHandler({
    activePageId,
    device,
    draggedElementRef,
    draggedElementSectionRef,
    freeElementDragRef,
    remember,
    sections,
    selectedElementIds,
    selectedElements,
    selectedId,
    selectEditorTarget,
    setCanvasSnapGuide,
    setDraggedElementId,
    setDragOverElementId,
    setDragOverElementPosition,
  });

    const updateElementFreeDrag = createUpdateElementFreeDragHandler({
    activePageId,
    freeElementDragRef,
    setCanvasSnapGuide,
    setSaved,
    setSections,
  });

  const { handleElementDragStart, handleElementDragMove, handleElementPointerDragStart, handleElementDragOver, handleElementDrop, handleElementDragEnd } = createElementDragHandlers({
    activePageId,
    sections,
    freeElementDragRef,
    draggedElementRef,
    draggedElementSectionRef,
    setCanvasSnapGuide,
    setDraggedElementId,
    setDragOverElementId,
    setDragOverElementPosition,
    setSections,
    setPages,
    setSymbols,
    setSaved,
    prepareElementFreeDrag,
    updateElementFreeDrag,
    remember,
    selectEditorTarget,
  });

  const { addSection, insertSectionAfter, applyPageTemplate, addSectionTemplate, deleteSection, moveSection, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = createSectionManagementHandlers({
    sections,
    selectedId,
    activePageId,
    setSections,
    setSaved,
    setDraggedId,
    setDragOverId,
    setDragOverSectionPosition,
    draggedSectionRef,
    draggedSectionPageRef,
    remember,
    clearEditorDragState,
    selectEditorTarget,
  });

  function pushProjectCheckpoint(label: string, snapshot: Record<string, unknown> = buildProjectSnapshot()) {
    const savedAt = new Date().toISOString();
    const entry: ProjectHistoryEntry = {
      id: `history-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      savedAt,
      label,
      snapshot: { ...snapshot, updatedAt: savedAt },
    };
    setProjectHistory((current) => [entry, ...current].slice(0, 30));
  }

  const {
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
  } = createCandidateReviewHandlers({
    aiCandidatePreview,
    aiCandidatePreviewResolverRef,
    aiCandidateReviewPages,
    aiCandidateReviewedPageCount,
    aiCandidateReviewedOperationCount,
    aiCandidateTargetableOperations,
    l,
    setAiCandidatePreview,
  });

  const { beginAIRequest, finishAIRequest, resolveAIPlanReview, requestAIPlanReview, resolveAIPatchReview, requestAIPatchReview, toggleAIPatchReviewOperation, stopAIRequest, beginAIQualityRequest, finishAIQualityRequest, stopAIQualityCheck } = createAIRequestHandlers({
    aiBusy, aiQualityBusy, aiAbortControllerRef, aiQualityAbortControllerRef,
    aiOperationSequenceRef, aiQualityOperationSequenceRef, aiPlanReviewResolverRef,
    aiPatchReviewResolverRef, aiPatchReviewSelectionRef, setAiPlanReview, setAiPatchReview,
    setAiBusy, setAiQualityBusy, setAiError, setAiStage, setAiMessages,
    resolveAICandidatePreview, l,
  });

  async function requestGeneratedImage(prompt: string, signal?: AbortSignal) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) throw new Error(l('Image prompt is required.'));
    const requestUserId = user?.id ?? null;
    const ai = createAIService('website-builder');
    const response = await ai.completeJSON<{ url: string; assetPath?: string; persisted?: boolean; persistenceError?: string }>(
      { action: 'generate-image', prompt: cleanPrompt },
      [],
      { temperature: 0.8, maxTokens: 1000, signal },
    );
    if (!response.json?.url) throw new Error(l('Image generation did not return an image.'));
    if (requestUserId) void refreshMedia(requestUserId);
    return response.json;
  }

  async function generateMediaLibraryImage(
    prompt: string,
  ) {
    const cleanPrompt =
      prompt.trim();

    if (!cleanPrompt) {
      throw new Error(
        l('Describe the image first.')
      );
    }

    const generationSequence = ++mediaGenerationSequenceRef.current;
    const generationUserId = user?.id ?? null;
    const generationIsCurrent = () =>
      mediaGenerationSequenceRef.current === generationSequence &&
      activeUserIdRef.current === generationUserId;

    if (generationIsCurrent()) {
      setMediaError('');
    }

    try {
      const generated =
        await requestGeneratedImage(
          cleanPrompt,
        );

      if (!generated.persisted) {
        throw new Error(
          generated.persistenceError ||
          l('Image was generated but could not be saved to Media.')
        );
      }

      if (generationIsCurrent()) {
        await refreshMedia(generationUserId);
      }

      return generated;
    } catch (error) {
      if (!generationIsCurrent()) {
        return undefined;
      }

      const message =
        error instanceof Error
          ? error.message
          : l('Could not generate image.');

      setMediaError(message);

      throw new Error(message);
    }
  }

    const generateWithAI = createAIGenerationHandler({
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
  });

  function buildAIEditableSnapshot(scope?: AIEditScopeTarget) {
    return buildAIEditableSnapshotData({
      pages: getCurrentPages(),
      siteName,
      activePageId,
      homePageId,
      selectedId,
      selectedElementId,
      device,
      seo,
      headerConfig,
      theme,
      symbols,
      scope,
    });
  }

  const undoLastAIChange = createAIUndoHandler({
    aiUndoSnapshot, aiBusy, aiUndoContextRef, aiProjectIdentityIsCurrent,
    setAiUndoSnapshot, setAiStage, setAiMessages, setPages, setActivePageId,
    setHomePageId, setSections, setSelectedId, setSelectedElementId, setSiteName,
    setBrand, setSeo, setTheme, setHeaderConfig, setSymbols, setSaved, l,
  });

    const applyAIChange = createLazyAIChangeHandler({
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
  }, aiChangeModuleLoadingRef);

    const generateRealImage = createAIImageHandler({
    activeUserIdRef,
    aiAbortControllerRef,
    aiBusy,
    aiEditorContextIsCurrent,
    aiOperationSequenceRef,
    aiQualityAbortControllerRef,
    aiQualityBusy,
    beginAIRequest,
    captureAIEditorContext,
    finishAIRequest,
    l,
    pushProjectCheckpoint,
    remember,
    requestGeneratedImage,
    sections,
    selectedElement,
    selectedSection,
    setAiBusy,
    setAiError,
    setAiMessages,
    setSaved,
    setSections,
    user,
  });

  const generateImagePrompt = createAIImagePromptHandler({
    user, selectedSection, brand, aiBusy, aiQualityBusy, aiAbortControllerRef,
    aiQualityAbortControllerRef, aiOperationSequenceRef, activeUserIdRef,
    beginAIRequest, finishAIRequest, captureAIEditorContext,
    aiEditorContextIsCurrent, setAiBusy, setAiError, setSections, setSaved, l,
  });

    const runAIQualityCheck = createAIQualityCheckHandler({
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
  });

  async function fixAIQualityIssues() {
    if (!aiQualityReview?.fixPrompt || aiBusy || aiQualityBusy) return;

    const reviewContext = aiQualityReviewContextRef.current;
    if (
      !reviewContext ||
      !aiEditorContextIsCurrent(reviewContext, false)
    ) {
      aiQualityReviewContextRef.current = null;
      setAiQualityReview(null);
      setAiError(
        'The website changed after this quality review. Run the quality check again before applying fixes.',
      );
      return;
    }

    setAiQualityOpen(false);
    await applyAIChange(aiQualityReview.fixPrompt);
  }

  const refreshPublishVersions = useCallback(async (
    expectedProjectId: string | null = cloudProjectId,
    expectedOwnerId = activeProjectOwnerId,
    expectedLoadSequence = projectLoadSequenceRef.current,
  ) => {
    const refreshUserId = user?.id ?? null;
    const refreshIsCurrent = () =>
      projectLoadSequenceRef.current === expectedLoadSequence &&
      activeUserIdRef.current === refreshUserId;

    if (!refreshUserId || !expectedProjectId) {
      if (refreshIsCurrent()) {
        setPublishVersions([]);
        setPublishVersionsError('');
      }
      return;
    }

    setPublishVersionsLoading(true);
    setPublishVersionsError('');

    const { data, error } = await listWebsitePublishVersions(expectedProjectId, expectedOwnerId);

    if (!refreshIsCurrent()) return;

    if (error) {
      setPublishVersionsError('Release history is unavailable. Apply the Sprint 97-108 database migration.');
      setPublishVersionsLoading(false);
      return;
    }

    setPublishVersions((data || []) as WebsitePublishVersion[]);
    setPublishVersionsLoading(false);
  }, [user, cloudProjectId, activeProjectOwnerId]);

  useEffect(() => {
    if (releaseHistoryOpen) void refreshPublishVersions();
  }, [releaseHistoryOpen, refreshPublishVersions]);

  const { verifyLiveDeployment, revokeSharePreview } = createLivePreviewHandlers({
    user, cloudProjectId, activeProjectOwnerId, projectLoadSequenceRef,
    activeUserIdRef, liveVerificationSequenceRef, previewOperationSequenceRef,
    previewToken, publishBusy, previewBusy, setLiveVerification, setPublishError,
    setPreviewBusy, setPreviewError, setPreviewUrl, setPreviewToken,
    setPreviewCreatedAt, setPreviewFingerprint, setSaved, publicWebsiteUrl,
  });

  async function promoteSharePreviewToLive() {
    await publishWebsite(true);
  }
    const rollbackPublishVersion = createRollbackPublishVersionHandler({
    activeUserIdRef,
    buildProjectData,
    cloudProjectId,
    cloudRevisionRef,
    l,
    lastSavedSnapshotRef,
    previewBusy,
    projectLoadSequenceRef,
    projectTeamAccess,
    publishBusy,
    publishOperationSequenceRef,
    saveInFlightRef,
    setAutoSaveStatus,
    setCloudProjects,
    setLastPublishedFingerprint,
    setLastPublishedVersionId,
    setPublishBusy,
    setPublishedAt,
    setPublishedUrl,
    setPublishError,
    user,
    verifyLiveDeployment,
  });
  const { releaseDiffSummary, restorePublishVersionToEditor, deletePublishVersion } = createReleaseHistoryHandlers({
    user, cloudProjectId, activeProjectOwnerId, projectTeamAccess,
    lastPublishedVersionId, lastPublishedFingerprint, publishedUrl, publishedAt,
    previewUrl, previewToken, previewCreatedAt, projectLoadSequenceRef, activeUserIdRef,
    setPublishVersions, setPublishVersionsLoading, setPublishVersionsError,
    setReleaseHistoryOpen, setAutoSaveStatus, snapshotConflictsWithActiveProject,
    buildProjectSnapshot, saveRecoverySnapshot, prepareProjectStateRestore, applyProjectData, l,
  });

    const saveProject = createSaveProjectHandler({
    activeUserIdRef,
    buildProjectData,
    buildProjectFingerprint,
    buildProjectSnapshot,
    cloudProjectId,
    cloudProjects,
    cloudProjectsLoaded,
    cloudRevisionRef,
    l,
    lastSavedSnapshotRef,
    loadCloudProjectRef,
    networkOnline,
    newProjectIntentRef,
    openBillingWithMessage,
    previewBusy,
    projectHistory,
    projectId,
    projectLoadSequenceRef,
    projectTeamAccess,
    publishBusy,
    publishedUrl,
    saveAbortControllerRef,
    saveInFlightRef,
    setAutoSaveStatus,
    setCloudBusy,
    setCloudError,
    setCloudProjectId,
    setCloudProjects,
    setCloudSyncFailed,
    setProjectHistory,
    setProjectTeamAccess,
    setSaved,
    showSavedFeedback,
    siteName,
    user,
  });

  saveProjectRef.current = saveProject;
  const createSharePreview = createSharePreviewHandler({
    activeUserIdRef,
    buildEditableFingerprint,
    saveProject,
    getOutputPages,
    getOutputFilename,
    getHtml,
    get404Html,
    buildProjectData,
    cloudProjectId,
    cloudRevisionRef,
    cmsErrors,
    customDomain,
    previewBusy,
    previewOperationSequenceRef,
    previewToken,
    productionConfig,
    projectLoadSequenceRef,
    projectTeamAccess,
    publishBusy,
    publishedUrl,
    setCloudProjects,
    setPreviewBusy,
    setPreviewCreatedAt,
    setPreviewError,
    setPreviewFingerprint,
    setPreviewToken,
    setPreviewUrl,
    setSaved,
    siteAudit,
    siteName,
    user,
  });

    const duplicateProject = createDuplicateProjectHandler({
    activeUserIdRef,
    billingEntitlements,
    billingPlan,
    billingState,
    buildProjectSnapshot,
    cancelPendingProjectPersistence,
    cloudRevisionRef,
    deliveryConfig,
    lastSavedSnapshotRef,
    newProjectIntentRef,
    openBillingWithMessage,
    projectLoadSequenceRef,
    refreshCloudProjects,
    setCloudBusy,
    setCloudError,
    setCloudProjectId,
    setDeliveryConfig,
    setFormDeliveries,
    setFuture,
    setHistory,
    setLastPublishedFingerprint,
    setLastPublishedVersionId,
    setLeads,
    setLeadsOpen,
    setLiveVerification,
    setPreviewCreatedAt,
    setPreviewFingerprint,
    setPreviewToken,
    setPreviewUrl,
    setProjectHistory,
    setPublishedAt,
    setPublishedUrl,
    setPublishVersions,
    setReleaseHistoryOpen,
    setSiteName,
    showSavedFeedback,
    siteName,
    user,
  });

    const resetProject = createResetProjectHandler({
    cancelPendingProjectPersistence,
    l,
    lastSavedSnapshotRef,
    newProjectIntentRef,
    prefs,
    projectLoadSequenceRef,
    saveRecoverySnapshot,
    setActivePageId,
    setAnalyticsError,
    setAnalyticsEvents,
    setAnalyticsOpen,
    setAutoSaveStatus,
    setBrand,
    setCloudError,
    setCloudProjectId,
    setCms,
    setDeliveryConfig,
    setDeliveryOpen,
    setFaviconUrl,
    setFooterConfig,
    setFormDeliveries,
    setFuture,
    setHeaderConfig,
    setHistory,
    setHistoryOpen,
    setHomePageId,
    setLastPublishedFingerprint,
    setLastPublishedVersionId,
    setLeads,
    setLeadsError,
    setLeadsOpen,
    setLiveVerification,
    setLocalization,
    setPages,
    setPreviewCreatedAt,
    setPreviewError,
    setPreviewFingerprint,
    setPreviewToken,
    setPreviewUrl,
    setProductionConfig,
    setProjectHistory,
    setPublishedAt,
    setPublishedUrl,
    setPublishError,
    setPublishVersions,
    setReleaseHistoryOpen,
    setSaved,
    setSections,
    setSelectedElementId,
    setSelectedId,
    setSeo,
    setSiteEnhancements,
    setSiteName,
    setSiteUrl,
    setSymbols,
    setTheme,
  });

  function websiteOutputHelpers() {
    return createWebsiteBuilderOutput({
      pages,
      sections,
      activePageId,
      homePageId,
      siteUrl,
      siteName,
      faviconUrl,
      seo,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig: effectiveProductionConfig(),
      preferredLanguage: prefs.language,
      cloudProjectId,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      cms,
      localization,
    });
  }

  function getOutputPages() {
    return websiteOutputHelpers().pages;
  }

  function getOutputFilename(page: WebsitePage) {
    return websiteOutputHelpers().filenameForPage(page);
  }

  function getHtml(
    pageSections: WebsiteSection[] = sections,
    pageId = activePageId,
    productionUrlOverride?: string,
    homeUsesIndexFile = false,
    trackAnalytics = false,
  ) {
    return websiteOutputHelpers().getHtml(pageSections, pageId, productionUrlOverride, homeUsesIndexFile, trackAnalytics);
  }

  function get404Html(productionUrlOverride?: string, homeUsesIndexFile = false, trackAnalytics = false) {
    return websiteOutputHelpers().get404Html(productionUrlOverride, homeUsesIndexFile, trackAnalytics);
  }

  const { exportProjectBackup, exportLeadsCsv, exportAnalyticsCsv, exportAuditReport, copyProjectSummary, previewWebsite, downloadProductionZip, copyHtml } = createEditorExportHandlers({
    siteName, siteUrl, siteAudit, pages, networkOnline, cloudSyncFailed, qualityDiagnostics,
    leads, analyticsEvents, publishedUrl, productionConfig, buildProjectData, getCurrentPages,
    getOutputPages, getOutputFilename, getHtml, get404Html, requireBillingFeature, setCopied, l,
  });

    const importProjectBackup = createImportProjectBackupHandler({
    activeUserIdRef,
    applyProjectData,
    cancelPendingProjectPersistence,
    l,
    lastSavedSnapshotRef,
    newProjectIntentRef,
    projectLoadSequenceRef,
    saveRecoverySnapshot,
    setAutoSaveStatus,
    setCloudProjectId,
    setOperationsOpen,
    setProjectHistory,
    skipNextAutosaveRef,
    user,
  });

  const { approveForDelivery, clearDeliveryApproval, markProjectDelivered, buildDeliveryReport, exportDeliveryReport } = createDeliveryActions({
    deliveryConfig, approvalCurrent, siteName, getLaunchReadiness: () => launchReadiness, siteAudit,
    publishedUrl, previewUrl, deliveryUsage, setDeliveryConfig, setSaved,
    buildDeliveryFingerprint, requireBillingFeature, l,
  });

  function publishOperationalBlocker(): string {
    if (!networkOnline) return `${l('Publish preflight blocked')}: ${l('You are offline. Reconnect and try again.')}`;
    if (cloudSyncFailed || autoSaveStatus === 'failed') return l('Resolve cloud sync before publishing.');
    if (siteAudit.errors.length) return `${l('Publish preflight blocked')}: ${l('Fix critical audit errors first')} (${siteAudit.errors.length}).`;
    if (cmsErrors.length) return `${l('Publish preflight blocked')}: CMS (${cmsErrors.length}) — ${cmsErrors[0].message}`;
    if (!user) return l('Sign in before publishing.');
    if (cloudProjectId && !projectTeamAccess.canPublish) return l('Only the project owner can publish a shared website.');
    return '';
  }

    const publishWebsite = createPublishWebsiteHandler({
    activeUserIdRef,
    billingEntitlements,
    buildEditableFingerprint,
    buildProjectData,
    cloudProjectId,
    cloudRevisionRef,
    customDomain,
    get404Html,
    getHtml,
    getOutputFilename,
    getOutputPages,
    l,
    lastSavedSnapshotRef,
    openBillingWithMessage,
    previewBusy,
    previewFingerprint,
    previewToken,
    productionConfig,
    projectLoadSequenceRef,
    publishBusy,
    publishOperationalBlocker,
    publishOperationSequenceRef,
    refreshPublishVersions,
    releaseNote,
    saveProject,
    setAutoSaveStatus,
    setCloudProjectId,
    setCloudProjects,
    setCloudSyncFailed,
    setLastPublishedFingerprint,
    setLastPublishedVersionId,
    setLiveVerification,
    setProjectTeamAccess,
    setPublishBusy,
    setPublishedAt,
    setPublishedUrl,
    setPublishError,
    setPublishVersionsError,
    setReleaseNote,
    siteName,
    user,
  });
    const unpublishWebsite = createUnpublishWebsiteHandler({
    activeUserIdRef,
    buildProjectData,
    cloudProjectId,
    cloudRevisionRef,
    l,
    lastSavedSnapshotRef,
    previewBusy,
    projectLoadSequenceRef,
    projectTeamAccess,
    publishBusy,
    publishOperationSequenceRef,
    saveInFlightRef,
    setAutoSaveStatus,
    setCloudProjects,
    setLastPublishedFingerprint,
    setLastPublishedVersionId,
    setLiveVerification,
    setPublishBusy,
    setPublishedAt,
    setPublishedUrl,
    setPublishError,
    user,
  });
  const { setLaunchManualCheck, closeLaunchCenter, runV1LaunchChecks } = createLaunchActions({
    user, cloudProjectId, activeProjectOwnerId, publishedUrl, cloudProjects,
    projectLoadSequenceRef, activeUserIdRef, setLaunchManualChecks,
    setLaunchCenterOpen, setLaunchCheckBusy, setLaunchLastCheckedAt,
    refreshBilling, refreshProjectTeamAccess, verifyLiveDeployment,
    recoverPublishedProjectState, manualChecksKey: LAUNCH_MANUAL_CHECKS_KEY,
    launchCenterSeenKey: LAUNCH_CENTER_SEEN_KEY,
  });

  const launchReadiness = useMemo(() => calculateLaunchReadiness({
    auditScore: siteAudit.score, siteUrl, cloudProjectId, previewUrl,
    approvalCurrent, publishedUrl, faviconUrl,
  }), [siteAudit.score, siteUrl, cloudProjectId, previewUrl, approvalCurrent, publishedUrl, faviconUrl]);
  const downloadClientHandoffZip = createClientHandoffHandler({
    launchReadiness,
    analyticsEvents,
    buildDeliveryReport,
    buildProjectData,
    deliveryConfig,
    get404Html,
    getHtml,
    getOutputFilename,
    getOutputPages,
    l,
    leads,
    productionConfig,
    publishedUrl,
    publishVersions,
    requireBillingFeature,
    siteName,
    siteUrl,
  });

  const v1LaunchStatus = useMemo(() => calculateV1LaunchStatus({
    pages, activePageId, sections, networkOnline, cloudSyncFailed, autoSaveStatus,
    user, billingLoading, billingError, billingPlan, siteUrl, seo, faviconUrl,
    siteAudit, cloudProjectId, canPublish: projectTeamAccess.canPublish,
    publishedUrl, lastPublishedVersionId, liveVerification, productionConfig,
    lastPublishedFingerprint, buildEditableFingerprint,
  }), [pages, activePageId, sections, networkOnline, cloudSyncFailed, autoSaveStatus, user, billingLoading, billingError, billingPlan, siteUrl, seo, faviconUrl, siteAudit, cloudProjectId, projectTeamAccess.canPublish, publishedUrl, lastPublishedVersionId, liveVerification, productionConfig, lastPublishedFingerprint, buildEditableFingerprint]);
  const publishBlocker = publishOperationalBlocker();

  function exportV1LaunchReport() {
    const content = buildV1LaunchReportText({
      launchManualChecks,
      siteName,
      cloudProjectId,
      planLabel: BILLING_PLAN_DETAILS[billingPlan].label,
      v1LaunchStatus,
      siteAudit,
      productionUrl: normalizeSiteUrl(siteUrl),
      publishedUrl,
      liveVerification,
      cloudSyncFailed,
      autoSaveStatus,
      networkOnline,
    });
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-v1-launch-report.txt`, content);
  }

  const hasUnsavedChanges = Boolean(
    !lastSavedSnapshotRef.current ||
    buildProjectFingerprint() !== lastSavedSnapshotRef.current
  );

  const hasUnpublishedChanges = Boolean(
    publishedUrl &&
    (
      !lastPublishedFingerprint ||
      buildEditableFingerprint() !== lastPublishedFingerprint
    )
  );

  const v2DirectActions = createV2DirectActions({ sections, setSections, setSaved, remember, selectEditorTarget });
  function v2DuplicateSectionDirect(sectionId: string) { v2DirectActions.v2DuplicateSectionDirect(sectionId); }
  function v2MoveElementDirect(sectionId: string, elementId: string, direction: 'up' | 'down') {
    v2DirectActions.v2MoveElementDirect(sectionId, elementId, direction);
  }

    const v2DuplicateElementDirect = createV2DuplicateElementHandler({
    remember,
    sections,
    selectEditorTarget,
    setSaved,
    setSections,
  });

    const v2DeleteElementDirect = createV2DeleteElementHandler({
    remember,
    sections,
    selectEditorTarget,
    setSaved,
    setSections,
  });

    const applyV2NativeOperations = createV2NativeOperationsHandler({
    activePageId,
    billingEntitlements,
    billingPlan,
    clearEditorDragState,
    headerConfig,
    homePageId,
    pages,
    remember,
    sections,
    selectedContainerId,
    selectedElementId,
    selectedFormFieldId,
    selectedId,
    seo,
    setActivePageId,
    setHeaderConfig,
    setHomePageId,
    setPages,
    setSaved,
    setSections,
    setSelectedContainerId,
    setSelectedElementId,
    setSelectedFormFieldId,
    setSelectedId,
    setSeo,
    setSymbols,
    setTheme,
    symbols,
    theme,
  });

  function submitV2AIRequest() {
    if (!aiPrompt.trim() || aiBusy || aiQualityBusy) return;
    if (aiIntent === 'edit') void applyAIChange();
    else void generateWithAI(true);
  }

  useEffect(() => {
    setAiEditScope((current) => {
      if (current === 'element' && !selectedElementId) return selectedId ? 'section' : 'page';
      if (current === 'section' && !selectedId) return 'page';
      return current;
    });
  }, [selectedElementId, selectedId]);

  const aiEditScopeOptions: Array<{ value: AIEditScope; label: string; disabled: boolean }> = [
    { value: 'site', label: l('Whole site'), disabled: false },
    { value: 'page', label: l('Current page'), disabled: false },
    { value: 'section', label: l('Selected section'), disabled: !selectedId },
    { value: 'element', label: l('Selected element'), disabled: !selectedElementId },
  ];

  const aiStageStatus = aiCandidatePreview
    ? l('Reviewing rendered result…')
    : aiPatchReview
      ? l('Reviewing changes…')
    : aiStage === 'planning'
      ? l('Planning…')
    : aiStage === 'building'
      ? l('Building…')
      : aiStage === 'styling'
        ? l('Finishing…')
        : l('Working…');
  const aiSelectedDestructiveCount = aiPatchReview?.operations.filter((operation) =>
    operation.kind === 'remove' && aiPatchReview.selectedOperationIds.includes(operation.id)).length ?? 0;

  const latestAiMessageId = aiMessages[aiMessages.length - 1]?.id;
  useEffect(() => {
    v2AiMessagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [latestAiMessageId, aiBusy, aiStage]);

  useEffect(() => {
    if (!aiPlanReview) return;
    const focusFrame = window.requestAnimationFrame(() => aiPlanApproveButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [aiPlanReview]);

  useEffect(() => {
    if (!aiPatchReview) return;
    const focusFrame = window.requestAnimationFrame(() => aiPatchApproveButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [aiPatchReview]);

  const aiCandidatePreviewVisible = aiCandidatePreview !== null;
  useEffect(() => {
    if (!aiCandidatePreviewVisible) return;
    const focusFrame = window.requestAnimationFrame(() => aiCandidateApproveButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [aiCandidatePreviewVisible]);

  useEffect(() => {
    if (!aiCanvasPreview) return;
    const scrollFrame = window.requestAnimationFrame(() => {
      const firstTarget = document.querySelector<HTMLElement>('[data-tayar-ai-preview-kind]');
      firstTarget?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [aiCanvasPreview]);

  return {
    aiBusy, aiCandidateActiveOperations, aiCandidateApproveButtonRef, aiCandidateCanShowAfter, aiCandidateCanShowBefore, aiCandidateGlobalOperations, aiCandidatePreview, aiCandidateReviewedOperationCount,
    aiCandidateReviewedPageCount, aiCandidateReviewPages, aiCandidateTargetableOperations, aiEditScope, aiEditScopeOptions, aiError, aiIntent, aiMessages,
    aiPatchApproveButtonRef, aiPatchReview, aiPlan, aiPlanApproveButtonRef, aiPlanReview, aiPreparedFollowUpRef, aiPrompt, aiQualityBusy,
    aiQualityReview, aiSelectedDestructiveCount, aiStageStatus, aiUndoSnapshot, approveAICandidatePreview, l, moveAICandidatePreviewPage, previewAICandidatePage,
    previewNextUnreviewedAICandidateOperation, previewNextUnreviewedAICandidatePage, resolveAICandidatePreview, resolveAIPatchReview, resolveAIPlanReview, revealAdjacentAICandidateOperation, revealAICandidateOperation, runAIQualityCheck,
    setAICandidatePreviewMode, setAiEditScope, setAiIntent, setAiPrompt, stopAIQualityCheck, stopAIRequest, submitV2AIRequest, toggleAIPatchReviewOperation,
    undoLastAIChange, v2AiMessagesEndRef, cms, activePage, selectedElement, cloudBusy, publishBusy, cmsIssues,
    remember, sections, setCms, setSaved, updateSelectedElement, setPages, activePageId, applyDesignSystemPreset,
    checkCustomDomain, cloudProjectId, connectCustomDomain, customDomain, customDomainBusy, customDomainDraft, customDomainError, designSystemReport,
    faviconUrl, footerConfig, headerConfig, localization, localizationIssues, projectTeamAccess, removeCustomDomain, repairActiveDesignSystem,
    setCustomDomainDraft, setFaviconUrl, setFooterConfig, setHeaderConfig, setLocalization, setSiteEnhancements, setSiteName, setSiteUrl,
    setTheme, siteEnhancements, siteName, siteUrl, theme, billingEntitlements, cloudError, hasUnpublishedChanges,
    launchCheckBusy, launchLastCheckedAt, liveVerification, productionConfig, publishBlocker, publishedAt, publishedUrl, publishError,
    publishWebsite, requireBillingFeature, runV1LaunchChecks, seo, setDeliveryOpen, setProductionConfig, setReleaseHistoryOpen, setSeo,
    siteAudit, unpublishWebsite, verifyLiveDeployment, aiCanvasPreview, aiCandidateShowingBefore, addElementToSection, beginElementResize, canvasActivePageId,
    canvasHeaderConfig, canvasPages, canvasSections, canvasSiteName, canvasSnapGuide, canvasTheme, darkMode, deleteSection,
    deleteSelectedElement, device, draggedElementId, draggedId, dragOverElementId, dragOverElementPosition, dragOverId, dragOverSectionPosition,
    duplicateSelectedElement, endElementResize, handleDragEnd, handleDragOver, handleDragStart, handleDrop, handleElementDragEnd, handleElementDragMove,
    handleElementDragOver, handleElementDragStart, handleElementDrop, handleElementPointerDragStart, moveSection, quickUpdateElement, resetElementPosition, resizeElementFrame,
    selectCanvasElement, selectCanvasElements, selectedElementId, selectedElementIds, selectedId, selectEditorTarget, setInspectorOpen, setMediaOpen,
    updateInlineElementContent, updateInlineElementSource, saveProject, previewWebsite, selectedSection, selectAllCanvasElements, selectRelatedCanvasElements, selectedElements,
    copySelectedTarget, cutSelectedTarget, createContainerForSelected, ungroupSelectedElements, normalizeSelectedElementFrames, arrangeSelectedElements, moveSelectedElementsLayer, canPasteCopiedTarget,
    editorClipboard, pasteCopiedTarget, duplicateActivePage, exportProjectBackup, importProjectBackup, recoveryAvailable, restoreRecoverySnapshot, exportAuditReport,
    setLaunchCenterOpen, exportV1LaunchReport, setBillingOpen, refreshBilling, downloadClientHandoffZip, setLeadsOpen, setAnalyticsOpen, pages,
    switchPage, setSelectedId, setSelectedElementId, commandQuery, commandOpen, closeCommandPalette, desktopShortcutActionsRef, handleCommandDialogKeyDown,
    setCommandQuery, handleCommandInputKeyDown, handleCommandItemKeyDown, analyticsOpen, autoSaveStatus, billingOpen, billingPlan, cloudProjects,
    deliveryConfig, deliveryOpen, downloadProductionZip, duplicateProject, future, history, historyOpen, inspectorOpen,
    launchCenterOpen, leads, leadsOpen, leftSidebarOpen, loadCloudProject, mediaOpen, networkOnline, operationsOpen,
    publishVersions, qualityDiagnostics, redo, releaseHistoryOpen, resetProject, saved, setDevice, setHistoryOpen,
    setLeftSidebarOpen, setOperationsOpen, undo, user, v1LaunchStatus, aiQualityOpen, setAiQualityOpen, fixAIQualityIssues,
    applyPageTemplate, closeLaunchCenter, cloudSyncFailed, launchManualChecks, setLaunchManualCheck, analyticsEvents, billingBusy, billingError,
    billingLoading, billingState, openBillingPortal, startBillingCheckout, previewUrl, setDeliveryConfig, launchReadiness, deliveryUsage,
    approvalCurrent, approveForDelivery, clearDeliveryApproval, markProjectDelivered, exportDeliveryReport, setCommandOpen, copyProjectSummary, copied,
    exportLeadsCsv, exportAnalyticsCsv, markAllLeadsRead, archiveReadLeads, analyticsError, analyticsLoading, analyticsSummary, refreshAnalytics,
    mediaUploading, uploadMediaFile, refreshMedia, mediaLoading, mediaError, mediaAssets, applyMediaAsset, updateActivePageMeta,
    deleteMediaAsset, bulkUpdateLeadStage, copyLeadSummary, deleteLead, filteredLeads, formDeliveries, leadCrmSummary, leadQuery,
    leadsError, leadsLoading, leadStageFilter, leadStatusFilter, openWebsiteFormUpload, refreshLeads, selectedLeadIds, setLeadQuery,
    setLeadStageFilter, setLeadStatusFilter, setSelectedLeadIds, updateLeadCrm, updateLeadStatus, createSharePreview, currentAIEditableFingerprint, deletePublishVersion,
    lastPublishedVersionId, previewBusy, previewCreatedAt, previewError, previewFingerprint, promoteSharePreviewToLive, publishVersionsError, publishVersionsLoading,
    refreshPublishVersions, releaseDiffSummary, releaseNote, restorePublishVersionToEditor, revokeSharePreview, rollbackPublishVersion, setReleaseNote, projectHistory,
    restoreHistoryEntry, addElement, addPage, addSection, addSectionTemplate, advancedSiteSettingsOpen, aiStage, applyAIChange,
    applyThemeToAllPages, applyThemeToCurrentPage, builderPanel, copyHtml, deleteActivePage, deleteReusableSection, duplicatePageAsTranslation, generateRealImage,
    generateWithAI, homePageId, insertReusableSection, makeActivePageHome, movePage, openBillingWithMessage, pageSettingsOpen, prefs,
    reusableBusy, reusableError, reusableSections, saveSelectedSectionAsReusable, setAdvancedSiteSettingsOpen, setAiError, setAiStage, setBuilderPanel,
    setPageSettingsOpen, insertSectionAfter, addFormAutomation, addFormField, assignSelectedToContainer, copySelectedElementResponsiveFrom, copySelectedSectionResponsiveFrom, createSymbolFromSelected,
    deleteFormAutomation, deleteFormField, deleteSelectedContainer, deleteSymbol, detachSelectedSymbol, generateImagePrompt, insertSymbol, moveFormField,
    moveSelectedElement, resetContactForm, resetSelectedElementResponsive, resetSelectedSectionResponsive, sectionSettingsOpen, selectedContainer, setSectionSettingsOpen, setSelectedSectionLayout,
    symbols, updateFormAutomation, updateFormField, updateSelected, updateSelectedContainer, updateSelectedSectionResponsive, getCurrentPages, editorV2Flags,
    duplicateSelectedTarget, deleteSelectedTarget, renameSymbol, duplicateSymbol, selectNextSymbolInstance, openV2MediaUpload, generateMediaLibraryImage, v2DuplicateSectionDirect,
    v2MoveElementDirect, v2DuplicateElementDirect, v2DeleteElementDirect, applyV2NativeOperations, restoreEditHistoryEntry, brand, selectedContainerId, selectedFormFieldId,
    hasUnsavedChanges, cmsErrors, clearEditorDragState, projectId,
  };
}
