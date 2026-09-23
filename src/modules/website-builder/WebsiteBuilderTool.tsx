import { useAuth } from '@/context/AuthContext';
import { usePreferences,type Language } from '@/context/PreferencesContext';
import { createAIService } from '@/lib/ai/service';
import {
buildPublishedSiteUrl
} from '@/lib/published-site-url';
import { useLocalizer } from '@/lib/ui-localization';
import {
Check,
Upload
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createAIChangeHandler } from './core/editor-ai-change-handler';
import { createAIGenerationHandler } from './core/editor-ai-generation-handler';
import { createAIImageHandler } from './core/editor-ai-image-handler';
import { createAIQualityCheckHandler } from './core/editor-ai-quality-handler';
import { createApplyProjectDataHandler } from './core/editor-apply-project-handler';
import { createArrangeSelectedElementsHandler } from './core/editor-arrange-handler';
import { createClientHandoffHandler } from './core/editor-client-handoff-handler';
import { createPrepareElementFreeDragHandler } from './core/editor-drag-prepare-handler';
import { createUpdateElementFreeDragHandler } from './core/editor-drag-update-handler';
import { createDuplicateProjectHandler } from './core/editor-duplicate-project-handler';
import { createImportProjectBackupHandler } from './core/editor-import-backup-handler';
import { createPublishWebsiteHandler } from './core/editor-publish-handler';
import { createRecoverPublishedStateHandler } from './core/editor-recover-published-handler';
import { createResetProjectHandler } from './core/editor-reset-project-handler';
import { createRollbackPublishVersionHandler } from './core/editor-rollback-handler';
import { createSaveProjectHandler } from './core/editor-save-handler';
import { createSharePreviewHandler } from './core/editor-share-preview-handler';
import { createUnpublishWebsiteHandler } from './core/editor-unpublish-handler';
import { createV2DeleteElementHandler } from './core/editor-v2-delete-handler';
import { createV2DuplicateElementHandler } from './core/editor-v2-duplicate-handler';
import { createV2NativeOperationsHandler } from './core/editor-v2-native-handler';

interface WebsiteBuilderToolProps {
  darkMode: boolean;
  projectId?: string | null;
}

import { ELEMENT_LABELS,SECTION_LABELS,createDefaultContactFormFields,createElement,createSection,defaultBrand,defaultSEO,defaultSections,normalizeSection } from './core/defaults';
import {
DEFAULT_DELIVERY_CONFIG,
type DeliveryStatus,
type WebsiteDeliveryConfig
} from './core/delivery-config';
import { buildAIEditableSnapshotData } from './core/editor-ai-editable-snapshot';
import {
editorAIContextMatches,
editorAIProjectIdentityMatches,
type EditorAIAsyncContext,
} from './core/editor-ai-operation-context';
import {
mergeAIWebsitePatchReviewKind,
type AIQualityReview,
type AIWebsiteCanvasPreview,
type AIWebsitePatchReview,
type AIWebsitePatchReviewItem,
type AIWebsitePlanReview
} from './core/editor-ai-patch-review';
import {
aiWebsitePatchReviewItemIsGlobal,
aiWebsitePatchReviewItemTargetPage,
aiWebsitePatchReviewItemTargetsPage
} from './core/editor-ai-review-targets';
import {
type AIBuilderMessage,
type AIBuilderStage,
type AIEditScope,
type AIEditScopeTarget
} from './core/editor-ai-scope';
import { decideEditorAutosave } from './core/editor-autosave-policy';
import {
type CanvasAlignmentTargets,
type CanvasBounds,
type CanvasSnapGuides
} from './core/editor-canvas-geometry';
import { resolveWebsiteBuilderV2Flags } from './core/editor-feature-flags';
import type { EditorPageLike,EditorSymbolLike } from './core/editor-model';
import {
DEFAULT_EDITOR_PROJECT_ACCESS,
createEditorProjectAccessFallback,
normalizeEditorProjectAccess,
resolveEditorProjectOwnerId,
type EditorProjectAccess,
} from './core/editor-project-access';
import {
hasRecoveryWebsiteProject,
loadActiveWebsiteProjectId,
loadLocalWebsiteProject,
loadRecoveryWebsiteProject,
saveActiveWebsiteProjectId,
saveLocalWebsiteProject,
saveRecoveryWebsiteProject
} from './core/editor-project-lifecycle';
import { PAGE_LANGUAGE_LABELS,languageCodeLabel,normalizePageLanguage,normalizeSlug } from './core/project-identifiers';
import { buildProjectSnapshotDiffSummary } from './core/project-release-metrics';
import type { Device,SectionLayout,SectionResponsiveStyle,SectionType,WebsiteBrand,WebsiteCmsBinding,WebsiteElement,WebsiteElementContainer,WebsiteElementType,WebsiteFormAutomation,WebsiteFormField,WebsiteFormFieldType,WebsiteSEO,WebsiteSection } from './core/types';
import { summarizeWebsiteAnalytics } from './core/website-analytics-summary';
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
resolveEffectiveProductionConfig,
sanitizeRobotsRules
} from './core/website-builder-config';
import { buildWebsiteAnalyticsCsv,buildWebsiteLeadsCsv,buildWebsiteProjectBackupText } from './core/website-builder-export-data';
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
type WebsiteClipboardContext,
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
} from './core/website-builder-model';
import { createWebsiteBuilderOutput } from './core/website-builder-output';
import {
clampElementNumber,
cloneSectionWithFreshIds,
cloneSymbolElement,
createPage,
createSectionFromTemplate,
createZipBlob,
downloadTextFile,
effectiveSectionStyle,
effectiveStyle,
elementColumn,
escapeHtml,
normalizeFormFieldName,
normalizeSiteUrl,
safeFormRedirectHref,
sectionColumnCount,
sectionLayoutAlign,
sectionLayoutGap,
type PageTemplateDefinition,
type SectionTemplateDefinition
} from './core/website-builder-rendering';
import { buildAuditReportText,buildDeliveryReportText,buildV1LaunchReportText } from './core/website-builder-reports';
import { EMPTY_WEBSITE_CMS,materializeWebsiteCmsSections,normalizeWebsiteCms,queryWebsiteCmsEntries,validateWebsiteCms,type WebsiteCmsState } from './core/website-cms';
import {
analyzeWebsiteDesignSystem,
repairWebsiteDesignTokens,
type WebsiteDesignSystemPreset
} from './core/website-design-system';
import { getWebsiteLeadPhone,getWebsiteLeadSource } from './core/website-lead-utils';
import {
DEFAULT_WEBSITE_LOCALIZATION,
validateWebsiteLocalization,
websitePathUrl,
type WebsiteLocalizationConfig
} from './core/website-localization';
import { listWebsiteProjectsInCloud } from './services/projectCloudService';
import {
downloadPublishedWebsiteFile,
removePublishedWebsiteFiles,
verifyPublishedRoute
} from './services/publishedWebsiteService';
import { deleteWebsitePublishVersionArchive,listWebsitePublishVersions } from './services/publishVersionService';
import { deleteReusableSectionInCloud,listReusableSectionsInCloud,saveReusableSectionInCloud } from './services/reusableSectionService';
import { getWebsiteProjectTeamAccess } from './services/websiteAccessService';
import { listWebsiteAnalyticsEvents } from './services/websiteAnalyticsService';
import { createWebsiteCheckoutSession,getWebsiteBuilderBillingState,openWebsiteBillingPortalSession } from './services/websiteBillingService';
import {
checkWebsiteCustomDomain,
connectWebsiteCustomDomain,
getWebsiteCustomDomain,
removeWebsiteCustomDomain,
type WebsiteCustomDomain,
} from './services/websiteDomainService';
import { createWebsiteFormUploadUrl,deleteWebsiteFormUploads,listWebsiteFormDeliveries,type WebsiteFormDelivery } from './services/websiteFormService';
import { bulkUpdateWebsiteLeadStage,deleteWebsiteLead,listWebsiteLeads,updateWebsiteLeadCrm,updateWebsiteLeadStatus,updateWebsiteLeadsByStatus } from './services/websiteLeadService';
import { deleteWebsiteMediaFile,getWebsiteMediaPublicUrl,listWebsiteMediaFiles,uploadWebsiteMediaFile } from './services/websiteMediaService';
import { BuilderAiPanel } from './v2-ui/BuilderAiPanel';
import { BuilderCmsPanel } from './v2-ui/BuilderCmsPanel';
import { BuilderLegacyAnalytics } from './v2-ui/BuilderLegacyAnalytics';
import { BuilderLegacyBilling } from './v2-ui/BuilderLegacyBilling';
import { BuilderLegacyCanvas } from './v2-ui/BuilderLegacyCanvas';
import { BuilderLegacyCommandPalette } from './v2-ui/BuilderLegacyCommandPalette';
import { BuilderLegacyHeader } from './v2-ui/BuilderLegacyHeader';
import { BuilderLegacyInspector } from './v2-ui/BuilderLegacyInspector';
import { BuilderLegacyLaunchCenter } from './v2-ui/BuilderLegacyLaunchCenter';
import { BuilderLegacyLeads } from './v2-ui/BuilderLegacyLeads';
import { BuilderLegacyReleaseHistory } from './v2-ui/BuilderLegacyReleaseHistory';
import { BuilderLegacySidebar } from './v2-ui/BuilderLegacySidebar';
import { BuilderSettingsPanel } from './v2-ui/BuilderSettingsPanel';
import { BuilderSitePanel } from './v2-ui/BuilderSitePanel';
import { BuilderV2Canvas } from './v2-ui/BuilderV2Canvas';
import { WebsiteBuilderV2Bridge } from './v2-ui/WebsiteBuilderV2Bridge';
import { WebsiteCollaborationPanel } from './v2-ui/WebsiteCollaborationPanel';

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
    const uploadPaths = leads.find((lead) => lead.id === leadId)?.files?.map((file) => file.path) || [];
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
    if (uploadPaths.length) {
      const cleanup = await deleteWebsiteFormUploads(uploadPaths);
      if (deleteIsCurrent() && cleanup.error) setLeadsError('The submission was deleted, but one or more private uploads need cleanup.');
    }
  }

  async function openWebsiteFormUpload(path: string) {
    const { data, error } = await createWebsiteFormUploadUrl(path);
    if (error || !data?.signedUrl) {
      setLeadsError('Could not open this private form upload.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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

  function createEditHistoryEntry(label: string, currentSections?: WebsiteSection[]): ProjectHistoryEntry {
    const savedAt = new Date().toISOString();
    const snapshot = buildProjectSnapshot();
    if (currentSections) {
      const preservedSections = JSON.parse(JSON.stringify(currentSections)) as WebsiteSection[];
      snapshot.pages = snapshot.pages.map((page) => page.id === activePageId
        ? { ...page, sections: preservedSections }
        : page);
    }
    return {
      id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt,
      label,
      snapshot,
    };
  }

  function remember(current: WebsiteSection[], label = 'Manual edit') {
    // Event handlers can outlive a memoized project snapshot by one render. Preserve
    // the exact sections supplied by the mutation so Undo always restores its input.
    const entry = createEditHistoryEntry(label, current);
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
          ...element,
          layoutColumn: nextColumns === 1
            ? undefined
            : previousColumns === 1
              ? ((index % nextColumns) + 1)
              : Math.min(nextColumns, Math.max(1, Number(element.layoutColumn) || ((index % nextColumns) + 1))),
        })),
      };
    }));
    setSaved(false);
  }

  function addFormField(type: WebsiteFormFieldType = 'text') {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = selectedSection.formFields ?? createDefaultContactFormFields();
    const baseName = type === 'email' ? 'email' : type === 'tel' ? 'phone' : type === 'textarea' ? 'message' : type === 'checkbox' ? 'consent' : type === 'select' ? 'option' : 'field';
    let suffix = existing.length + 1;
    let name = baseName;
    while (existing.some((field) => field.name === name)) {
      name = `${baseName}_${suffix}`;
      suffix += 1;
    }
    const field: WebsiteFormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      label: type === 'textarea' ? 'Message' : type === 'checkbox' ? 'I agree' : type === 'select' ? 'Choose an option' : type === 'tel' ? 'Phone' : type === 'email' ? 'Email' : 'New field',
      type,
      placeholder: type === 'checkbox' ? '' : type === 'select' ? 'Choose an option' : '',
      required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    updateSelected({ formFields: [...existing, field] });
  }

  function updateFormField(fieldId: string, changes: Partial<WebsiteFormField>) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = selectedSection.formFields ?? createDefaultContactFormFields();
    const next = existing.map((field) => {
      if (field.id !== fieldId) return field;
      const updated = { ...field, ...changes };
      if (changes.name !== undefined) updated.name = normalizeFormFieldName(changes.name, field.name || 'field');
      return updated;
    });
    updateSelected({ formFields: next });
  }

  function addFormAutomation(action: WebsiteFormAutomation['action']) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const automation: WebsiteFormAutomation = {
      id: `automation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: action === 'email' ? 'Email notification' : 'Webhook',
      enabled: true,
      trigger: 'submission-created',
      action,
      destination: action === 'email' ? (user?.email || '') : 'https://',
    };
    updateSelected({ formAutomations: [...(selectedSection.formAutomations || []), automation] });
  }

  function updateFormAutomation(automationId: string, changes: Partial<WebsiteFormAutomation>) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    updateSelected({ formAutomations: (selectedSection.formAutomations || []).map((item) => item.id === automationId ? { ...item, ...changes } : item) });
  }

  function deleteFormAutomation(automationId: string) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    updateSelected({ formAutomations: (selectedSection.formAutomations || []).filter((item) => item.id !== automationId) });
  }

  function deleteFormField(fieldId: string) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = selectedSection.formFields ?? createDefaultContactFormFields();
    if (existing.length <= 1) return;
    updateSelected({ formFields: existing.filter((field) => field.id !== fieldId) });
  }

  function moveFormField(fieldId: string, direction: 'up' | 'down') {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = [...(selectedSection.formFields ?? createDefaultContactFormFields())];
    const index = existing.findIndex((field) => field.id === fieldId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= existing.length) return;
    [existing[index], existing[target]] = [existing[target], existing[index]];
    updateSelected({ formFields: existing });
  }

  function resetContactForm() {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    updateSelected({
      formFields: createDefaultContactFormFields(),
      formSuccessMessage: 'Thanks! Your message has been sent.',
    });
  }

  function addElementToSection(sectionId: string, type: WebsiteElementType) {
    const targetSection = sections.find((section) => section.id === sectionId);
    if (!targetSection) return;
    remember(sections);
    const columnCount = sectionColumnCount(targetSection.layout);
    const counts = Array.from({ length: columnCount }, (_, columnIndex) =>
      targetSection.elements.reduce((count, existingElement, index) =>
        count + (elementColumn(existingElement, index, columnCount) === columnIndex + 1 ? 1 : 0), 0)
    );
    const targetColumn = columnCount > 1 ? counts.indexOf(Math.min(...counts)) + 1 : undefined;
    const element = { ...createElement(type, targetSection.accent), layoutColumn: targetColumn };
    setSections((current) => current.map((section) =>
      section.id === sectionId ? { ...section, elements: [...section.elements, element] } : section
    ));
    selectEditorTarget(sectionId, element.id);
    setSaved(false);
  }

  function addElement(type: WebsiteElementType) {
    if (!selectedSection) return;
    addElementToSection(selectedSection.id, type);
  }

  function updateInlineElementContent(sectionId: string, elementId: string, content: string) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement || !content.trim() || targetElement.content === content) return;
    remember(sections);
    const symbolId = targetElement.symbolId;
    const updateSection = (section: WebsiteSection) => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? { ...element, content } : element;
      }),
    });
    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? updateSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : { ...page, sections: page.sections.map(updateSection) }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId
        ? { ...symbol, element: { ...symbol.element, content }, updatedAt: new Date().toISOString() }
        : symbol
      ));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function updateInlineElementSource(sectionId: string, elementId: string, src: string) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    const nextSource = src.trim();
    if (!targetSection || !targetElement || !nextSource || targetElement.src === nextSource) return;
    remember(sections);
    const symbolId = targetElement.symbolId;
    const updateSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? { ...element, src: nextSource } : element;
      }),
    });
    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? updateSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : { ...page, sections: page.sections.map(updateSection) }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId
        ? { ...symbol, element: { ...symbol.element, src: nextSource }, updatedAt: new Date().toISOString() }
        : symbol
      ));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function beginElementResize(sectionId: string, elementId: string) {
    selectEditorTarget(sectionId, elementId);
    const resizeSessionKey = `${activePageId}:${sectionId}:${elementId}:${device}`;
    if (canvasResizeSessionRef.current === resizeSessionKey) return;
    remember(sections, 'Resize element');
    canvasResizeSessionRef.current = resizeSessionKey;
  }

  function endElementResize() {
    canvasResizeSessionRef.current = null;
  }

  function resizeElementFrame(
    sectionId: string,
    elementId: string,
    frame: { width: number; positionX?: number },
  ) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement) return;
    const symbolId = targetElement.symbolId;
    const safeWidth = Math.max(10, Math.min(100, Math.round(frame.width)));
    const safePositionX = frame.positionX === undefined
      ? undefined
      : Math.max(-4000, Math.min(4000, Math.round(frame.positionX)));

    const resizeElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          width: safeWidth,
          ...(safePositionX === undefined ? {} : { positionX: safePositionX }),
        },
      },
    });

    const resizeSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? resizeElement(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? resizeSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(resizeSection),
      }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId ? {
        ...symbol,
        element: resizeElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function quickUpdateElement(sectionId: string, elementId: string, changes: Partial<WebsiteElement>) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement) return;
    remember(sections);
    const symbolId = targetElement.symbolId;

    const applyChanges = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      ...changes,
      id: element.id,
      containerId: element.containerId,
      layoutColumn: element.layoutColumn,
      symbolId: element.symbolId,
    });

    const updateSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === elementId;
        return matches ? applyChanges(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === sectionId || symbolId ? updateSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(updateSection),
      }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId ? {
        ...symbol,
        element: applyChanges(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function nudgeSelectedElement(deltaX: number, deltaY: number) {
    if (!selectedSection || !selectedElement) return;
    const targets = selectedElements.length > 1 ? selectedElements : [selectedElement];
    const directIds = new Set(targets.filter((element) => !element.symbolId).map((element) => element.id));
    const symbolIds = new Set(targets.flatMap((element) => element.symbolId ? [element.symbolId] : []));
    const canMove = targets.some((element) => {
      const style = effectiveStyle(element, device);
      const currentX = clampElementNumber(style.positionX, 0, -4000, 4000);
      const currentY = clampElementNumber(style.positionY, 0, -4000, 4000);
      return Math.max(-4000, Math.min(4000, currentX + deltaX)) !== currentX ||
        Math.max(-4000, Math.min(4000, currentY + deltaY)) !== currentY;
    });
    if (!canMove) return;

    const selectionKey = targets.map((element) => element.id).sort().join(',');
    const nudgeSessionKey = `${activePageId}:${selectedSection.id}:${selectionKey}:${device}`;
    if (canvasNudgeSessionRef.current !== nudgeSessionKey) {
      remember(sections, targets.length > 1 ? 'Move selected elements' : 'Move element');
      canvasNudgeSessionRef.current = nudgeSessionKey;
    }
    const moveElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          positionX: Math.max(-4000, Math.min(4000, clampElementNumber(effectiveStyle(element, device).positionX, 0, -4000, 4000) + deltaX)),
          positionY: Math.max(-4000, Math.min(4000, clampElementNumber(effectiveStyle(element, device).positionY, 0, -4000, 4000) + deltaY)),
        },
      },
    });
    const moveSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = directIds.has(element.id) || Boolean(element.symbolId && symbolIds.has(element.symbolId));
        return matches ? moveElement(element) : element;
      }),
    });

    setSections((current) => current.map(moveSection));
    if (symbolIds.size) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(moveSection),
      }));
      setSymbols((current) => current.map((symbol) => symbolIds.has(symbol.id) ? {
        ...symbol,
        element: moveElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSaved(false);
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
    if (!selectedSection || !selectedElements.length || !selectedElement) return;
    if ((action === 'match-width' || action === 'match-appearance' || action === 'reset-position') && selectedElements.length < 2) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const selectedSymbolIds = new Set(selectedElements.flatMap((element) => element.symbolId ? [element.symbolId] : []));
    const referenceStyle = effectiveStyle(selectedElement, device);
    const referenceWidth = clampElementNumber(referenceStyle.width, 100, 10, 100);
    const referenceAppearance = { ...referenceStyle };
    (['width', 'maxWidth', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'positionX', 'positionY', 'order', 'hidden', 'alignSelf', 'columnSpan'] as const)
      .forEach((key) => delete referenceAppearance[key]);
    const styleChanges = action === 'match-width'
      ? { width: referenceWidth }
      : action === 'match-appearance'
        ? referenceAppearance
        : action === 'reset-position'
          ? { positionX: 0, positionY: 0, rotate: 0 }
          : { hidden: action === 'hide' };
    const updateElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          ...styleChanges,
        },
      },
    });
    const updateSection = (section: WebsiteSection, linkedOnly = false): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = element.symbolId
          ? selectedSymbolIds.has(element.symbolId)
          : !linkedOnly && selectedIds.has(element.id);
        return matches ? updateElement(element) : element;
      }),
    });

    const historyLabels = {
      'match-width': 'Match selected element widths',
      'match-appearance': 'Match selected element appearance',
      'reset-position': 'Reset selected element transforms',
      show: 'Show selected elements',
      hide: 'Hide selected elements',
    } as const;
    remember(sections, historyLabels[action]);
    setSections((current) => current.map((section) => updateSection(section)));
    if (selectedSymbolIds.size) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map((section) => updateSection(section, true)),
      }));
      setSymbols((current) => current.map((symbol) => selectedSymbolIds.has(symbol.id) ? {
        ...symbol,
        element: updateElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    setSaved(false);
  }

  function moveSelectedElementsLayer(destination: 'front' | 'forward' | 'backward' | 'back') {
    if (!selectedSection || !selectedElements.length) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const historyLabels = {
      front: 'Bring selected elements to front',
      forward: 'Bring selected elements forward',
      backward: 'Send selected elements backward',
      back: 'Send selected elements to back',
    } as const;
    remember(sections, historyLabels[destination]);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const ordered = section.elements
        .map((element, index) => ({ element, index, order: clampElementNumber(effectiveStyle(element, device).order, 0, -50, 50) }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ element }) => element);
      const moving = ordered.filter((element) => selectedIds.has(element.id));
      const remaining = ordered.filter((element) => !selectedIds.has(element.id));
      let next = destination === 'front' ? [...remaining, ...moving] : destination === 'back' ? [...moving, ...remaining] : [...ordered];
      if (destination === 'forward') {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (selectedIds.has(next[index].id) && !selectedIds.has(next[index + 1].id)) {
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
          }
        }
      }
      if (destination === 'backward') {
        for (let index = 1; index < next.length; index += 1) {
          if (selectedIds.has(next[index].id) && !selectedIds.has(next[index - 1].id)) {
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
          }
        }
      }
      const orderOffset = Math.floor(next.length / 2);
      next = next.map((element, index) => ({
        ...element,
        responsive: {
          ...element.responsive,
          [device]: {
            ...(element.responsive?.[device] || {}),
            order: Math.max(-50, Math.min(50, index - orderOffset)),
          },
        },
      }));
      return { ...section, elements: next };
    }));
    setSaved(false);
  }

  function ungroupSelectedElements() {
    if (!selectedSection || selectedElements.length < 2) return;
    const selectedIds = new Set(selectedElements.map((element) => element.id));
    const affectedContainerIds = new Set(selectedElements.flatMap((element) => element.containerId ? [element.containerId] : []));
    if (!affectedContainerIds.size) return;
    remember(sections, 'Ungroup selected elements');
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const elements = section.elements.map((element) => selectedIds.has(element.id) ? { ...element, containerId: undefined } : element);
      const usedContainerIds = new Set(elements.flatMap((element) => element.containerId ? [element.containerId] : []));
      const containers = (section.containers || []).filter((container) =>
        !affectedContainerIds.has(container.id) || usedContainerIds.has(container.id));
      return { ...section, elements, containers };
    }));
    setSelectedContainerId(null);
    setSaved(false);
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

  function cloneElementForInsertion(source: WebsiteElement, targetSection: WebsiteSection): WebsiteElement {
    const copied = JSON.parse(JSON.stringify(source)) as WebsiteElement;
    const targetHasContainer = Boolean(
      copied.containerId && targetSection.containers?.some((container) => container.id === copied.containerId),
    );
    const targetHasSymbol = Boolean(copied.symbolId && symbols.some((symbol) => symbol.id === copied.symbolId));
    const offsetPosition = (style: WebsiteElement['style']): WebsiteElement['style'] => ({
      ...style,
      ...(typeof style.positionX === 'number' ? { positionX: clampElementNumber(style.positionX + 16, 0, -4000, 4000) } : {}),
      ...(typeof style.positionY === 'number' ? { positionY: clampElementNumber(style.positionY + 16, 0, -4000, 4000) } : {}),
    });
    const responsive = copied.responsive
      ? JSON.parse(JSON.stringify(copied.responsive)) as NonNullable<WebsiteElement['responsive']>
      : undefined;
    if (responsive?.[device]) responsive[device] = offsetPosition(responsive[device] || {});

    return {
      ...copied,
      id: `${copied.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      style: offsetPosition(copied.style),
      responsive,
      containerId: targetHasContainer ? copied.containerId : undefined,
      symbolId: targetHasSymbol ? copied.symbolId : undefined,
    };
  }

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

  function clipboardContext(): WebsiteClipboardContext {
    return {
      projectId: cloudProjectId,
      ownerId: activeProjectOwnerId,
      loadSequence: projectLoadSequenceRef.current,
    };
  }

  function copySelectedTarget() {
    if (selectedElements.length > 1) {
      setEditorClipboard({
        ...clipboardContext(),
        kind: 'elements',
        elements: JSON.parse(JSON.stringify(selectedElements)) as WebsiteElement[],
      });
      return;
    }
    if (selectedElement) {
      setEditorClipboard({
        ...clipboardContext(),
        kind: 'element',
        element: JSON.parse(JSON.stringify(selectedElement)) as WebsiteElement,
      });
      return;
    }
    if (!selectedSection) return;
    setEditorClipboard({
      ...clipboardContext(),
      kind: 'section',
      section: JSON.parse(JSON.stringify(selectedSection)) as WebsiteSection,
    });
  }

  function canPasteCopiedTarget() {
    if (!editorClipboard || !selectedSection) return false;
    return editorClipboard.projectId === cloudProjectId &&
      editorClipboard.ownerId === activeProjectOwnerId &&
      editorClipboard.loadSequence === projectLoadSequenceRef.current;
  }

  function cutSelectedTarget() {
    if (!selectedSection) return;
    if (!selectedElement && sections.length <= 1) return;
    if (selectedElements.length && selectedElements.length >= selectedSection.elements.length) return;
    copySelectedTarget();

    if (selectedElements.length) {
      const selectedIds = new Set(selectedElements.map((element) => element.id));
      const remaining = selectedSection.elements.filter((element) => !selectedIds.has(element.id));
      remember(sections, selectedElements.length > 1 ? 'Cut selected elements' : 'Cut element');
      setSections((current) => current.map((section) =>
        section.id === selectedSection.id ? { ...section, elements: remaining } : section
      ));
      selectEditorTarget(selectedSection.id, remaining[0]?.id ?? null);
      setSaved(false);
      return;
    }

    const sectionIndex = sections.findIndex((section) => section.id === selectedSection.id);
    if (sectionIndex < 0) return;
    const remaining = sections.filter((section) => section.id !== selectedSection.id);
    const fallback = remaining[Math.min(sectionIndex, remaining.length - 1)] || remaining[0];
    remember(sections, 'Cut section');
    setSections(remaining);
    selectEditorTarget(fallback?.id ?? null, null);
    setSaved(false);
  }

  function pasteCopiedTarget() {
    if (!canPasteCopiedTarget() || !editorClipboard || !selectedSection) return;

    if (editorClipboard.kind === 'section') {
      const pastedSection = cloneSectionWithFreshIds(editorClipboard.section, sections);
      const selectedIndex = sections.findIndex((section) => section.id === selectedSection.id);
      remember(sections, 'Paste section');
      setSections((current) => {
        const next = [...current];
        next.splice(selectedIndex >= 0 ? selectedIndex + 1 : next.length, 0, pastedSection);
        return next;
      });
      selectEditorTarget(pastedSection.id, pastedSection.elements[0]?.id ?? null);
      setSaved(false);
      return;
    }

    const sourceElements = editorClipboard.kind === 'elements'
      ? editorClipboard.elements
      : [editorClipboard.element];
    const pasted = sourceElements.map((element) => cloneElementForInsertion(element, selectedSection));
    remember(sections, pasted.length > 1 ? 'Paste selected elements' : 'Paste element');
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const elements = [...section.elements];
      const selectedIndex = selectedElementId
        ? elements.findIndex((element) => element.id === selectedElementId)
        : -1;
      elements.splice(selectedIndex >= 0 ? selectedIndex + 1 : elements.length, 0, ...pasted);
      return { ...section, elements };
    }));
    setSelectedId(selectedSection.id);
    setSelectedElementIds(pasted.map((element) => element.id));
    setSelectedElementId(pasted[pasted.length - 1]?.id ?? null);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
    setSaved(false);
  }

  function createContainerForSelected() {
    if (!selectedSection || !selectedElement) return;
    const targets = selectedElements.length > 1 ? selectedElements : [selectedElement];
    const targetIds = new Set(targets.map((element) => element.id));
    remember(sections, targets.length > 1 ? 'Group selected elements' : 'Create element container');
    const id = `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = `Container ${(selectedSection.containers?.length || 0) + 1}`;
    const container: WebsiteElementContainer = {
      id,
      name,
      layout: 'stack',
      gap: 16,
      align: 'center',
      backgroundColor: '#ffffff08',
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#ffffff18',
      shadow: 'none',
      layoutColumn: selectedElement.layoutColumn,
      columnSpan: 1,
    };
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      containers: [...(section.containers || []), container],
      elements: section.elements.map((element) => targetIds.has(element.id) ? { ...element, containerId: id } : element),
    } : section));
    setSelectedContainerId(id);
    setSaved(false);
  }

  function updateSelectedContainer(changes: Partial<WebsiteElementContainer>) {
    if (!selectedSection || !selectedElement?.containerId) return;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      containers: (section.containers || []).map((container) => container.id === selectedElement.containerId ? { ...container, ...changes } : container),
    } : section));
    setSaved(false);
  }

  function assignSelectedToContainer(containerId?: string) {
    if (!selectedSection || !selectedElement) return;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, containerId: containerId || undefined } : element),
    } : section));
    setSaved(false);
  }

  function deleteSelectedContainer() {
    if (!selectedSection || !selectedElement?.containerId) return;
    const containerId = selectedElement.containerId;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      containers: (section.containers || []).filter((container) => container.id !== containerId),
      elements: section.elements.map((element) => element.containerId === containerId ? { ...element, containerId: undefined } : element),
    } : section));
    setSaved(false);
  }

  function createSymbolFromSelected() {
    if (!selectedElement || !selectedSection || selectedElement.symbolId) return;

    if (symbols.length >= 50) {
      window.alert(l('You can keep up to 50 reusable components in one website. Delete an unused component before creating another.'));
      return;
    }

    remember(sections, 'Create reusable component');
    const baseName = (selectedElement.content?.slice(0, 40) || ELEMENT_LABELS[selectedElement.type] || 'Component').trim();
    const matching = symbols.filter((symbol) => symbol.name === baseName || symbol.name.startsWith(`${baseName} `)).length;
    const name = matching ? `${baseName} ${matching + 1}` : baseName;
    const symbolId = `symbol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const symbol: WebsiteSymbol = {
      id: symbolId,
      name: name.slice(0, 80),
      element: cloneSymbolElement(selectedElement),
      updatedAt: new Date().toISOString(),
    };
    setSymbols((current) => [symbol, ...current]);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, symbolId } : element),
    } : section));
    setSaved(false);
  }

  function insertSymbol(symbol: WebsiteSymbol) {
    if (!selectedSection) return;
    remember(sections, `Insert component: ${symbol.name}`);

    const columnCount = sectionColumnCount(selectedSection.layout);
    const targetContainerId =
      selectedElement?.containerId ||
      selectedContainerId ||
      undefined;

    const instance: WebsiteElement = {
      ...JSON.parse(JSON.stringify(symbol.element)) as WebsiteElement,
      id: `${symbol.element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbolId: symbol.id,
      layoutColumn: targetContainerId
        ? undefined
        : columnCount > 1
          ? selectedElement?.layoutColumn || 1
          : undefined,
      containerId: targetContainerId,
    };

    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;

      const elements = [...section.elements];
      const selectedIndex = selectedElementId
        ? elements.findIndex((element) => element.id === selectedElementId)
        : -1;
      const insertAt = selectedIndex >= 0
        ? selectedIndex + 1
        : elements.length;

      elements.splice(insertAt, 0, instance);
      return { ...section, elements };
    }));

    selectEditorTarget(selectedSection.id, instance.id);
    setSaved(false);
  }

  function detachSelectedSymbol() {
    if (!selectedSection || !selectedElement?.symbolId) return;
    remember(sections, 'Detach component');
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, symbolId: undefined } : element),
    } : section));
    setSaved(false);
  }

  function deleteSymbol(symbolId: string) {
    if (!window.confirm(l('Delete this component? Existing instances will become normal elements.'))) return;
    remember(sections, 'Delete reusable component');
    setSymbols((current) => current.filter((symbol) => symbol.id !== symbolId));
    const detach = (section: WebsiteSection) => ({
      ...section,
      elements: section.elements.map((element) => element.symbolId === symbolId ? { ...element, symbolId: undefined } : element),
    });
    setSections((current) => current.map(detach));
    setPages((current) => current.map((page) =>
      page.id === activePageId
        ? page
        : { ...page, sections: page.sections.map(detach) }
    ));
    setSaved(false);
  }

  function renameSymbol(symbolId: string, requestedName: string) {
    const name = requestedName.trim().slice(0, 80);
    if (!name) return;
    const existing = symbols.find((symbol) => symbol.id === symbolId);
    if (!existing || existing.name === name) return;
    if (symbols.some((symbol) => symbol.id !== symbolId && symbol.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      window.alert(l('A component with this name already exists.'));
      return;
    }
    remember(sections, 'Rename reusable component');
    setSymbols((current) => current.map((symbol) => symbol.id === symbolId
      ? { ...symbol, name, updatedAt: new Date().toISOString() }
      : symbol));
    setSaved(false);
  }

  function duplicateSymbol(symbolId: string) {
    if (symbols.length >= 50) {
      window.alert(l('You can keep up to 50 reusable components in one website. Delete an unused component before creating another.'));
      return;
    }
    const source = symbols.find((symbol) => symbol.id === symbolId);
    if (!source) return;
    const baseName = `${source.name} Copy`.slice(0, 72);
    let name = baseName;
    let suffix = 2;
    const usedNames = new Set(symbols.map((symbol) => symbol.name.trim().toLocaleLowerCase()));
    while (usedNames.has(name.toLocaleLowerCase())) {
      name = `${baseName} ${suffix}`.slice(0, 80);
      suffix += 1;
    }
    remember(sections, 'Duplicate reusable component');
    setSymbols((current) => [{
      ...JSON.parse(JSON.stringify(source)) as WebsiteSymbol,
      id: `symbol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      element: cloneSymbolElement(source.element),
      updatedAt: new Date().toISOString(),
    }, ...current]);
    setSaved(false);
  }

  function selectNextSymbolInstance(symbolId: string) {
    const currentPages = getCurrentPages();
    const instances = currentPages.flatMap((page) => page.sections.flatMap((section) =>
      section.elements
        .filter((element) => element.symbolId === symbolId)
        .map((element) => ({ pageId: page.id, sectionId: section.id, elementId: element.id }))));
    if (!instances.length) return;
    const currentIndex = instances.findIndex((instance) =>
      instance.pageId === activePageId &&
      instance.sectionId === selectedId &&
      instance.elementId === selectedElementId);
    const target = instances[(currentIndex + 1) % instances.length];
    if (target.pageId !== activePageId) {
      switchPage(target.pageId);
      window.requestAnimationFrame(() => selectEditorTarget(target.sectionId, target.elementId));
      return;
    }
    selectEditorTarget(target.sectionId, target.elementId);
  }

  function resetSelectedElementResponsive() {
    if (!selectedSection || !selectedElementId || !selectedElement) return;

    remember(sections);
    const selectedSymbolId = selectedElement.symbolId;

    const resetElement = (element: WebsiteElement): WebsiteElement => {
      const responsive = { ...(element.responsive || {}) };
      delete responsive[device];
      return { ...element, responsive };
    };

    const resetSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = selectedSymbolId
          ? element.symbolId === selectedSymbolId
          : element.id === selectedElementId;
        return matches ? resetElement(element) : element;
      }),
    });

    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id || selectedSymbolId
          ? resetSection(section)
          : section
      )
    );

    if (selectedSymbolId) {
      setPages((current) => current.map((page) =>
        page.id === activePageId
          ? page
          : {
              ...page,
              sections: page.sections.map(resetSection),
            }
      ));

      setSymbols((current) => current.map((symbol) =>
        symbol.id === selectedSymbolId
          ? {
              ...symbol,
              element: cloneSymbolElement(resetElement(symbol.element)),
              updatedAt: new Date().toISOString(),
            }
          : symbol
      ));
    }

    setSaved(false);
  }

  function copySelectedElementResponsiveFrom(sourceDevice: Device) {
    if (!selectedElement || sourceDevice === device) return;
    updateSelectedElement({
      style: {
        ...effectiveStyle(selectedElement, sourceDevice),
      },
    }, true);
  }

  function moveSelectedElement(direction: 'up' | 'down') {
    if (!selectedSection || !selectedElementId) return;
    if (!selectedSection.elements.some((element) => element.id === selectedElementId)) return;

    remember(sections);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;

      const index = section.elements.findIndex((element) => element.id === selectedElementId);
      if (index < 0) return section;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= section.elements.length) return section;

      const elements = [...section.elements];
      [elements[index], elements[target]] = [elements[target], elements[index]];
      return { ...section, elements };
    }));
    setSaved(false);
  }

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

  function handleElementDragStart(sectionId: string, id: string, e: React.DragEvent) {
    if (!prepareElementFreeDrag(sectionId, id, e.clientX, e.clientY, e.currentTarget as HTMLElement, true)) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-tayar-element', id);
    e.dataTransfer.setData('application/x-tayar-section', sectionId);
  }

  function handleElementDragMove(sectionId: string, id: string, e: React.DragEvent) {
    const drag = freeElementDragRef.current;
    if (
      !drag ||
      drag.pageId !== activePageId ||
      drag.sectionId !== sectionId ||
      drag.elementId !== id
    ) {
      return;
    }
    if (!e.clientX && !e.clientY) return;
    if (e.shiftKey) {
      if (drag.snapHorizontal || drag.snapVertical) {
        drag.snapHorizontal = false;
        drag.snapVertical = false;
        drag.snapHorizontalPosition = undefined;
        drag.snapVerticalPosition = undefined;
        setCanvasSnapGuide(null);
      }
      return;
    }

    updateElementFreeDrag(sectionId, id, e.clientX, e.clientY, e.altKey);
  }

  function handleElementPointerDragStart(sectionId: string, id: string, e: React.PointerEvent<HTMLElement>) {
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    if (!prepareElementFreeDrag(sectionId, id, e.clientX, e.clientY, target, false)) return;

    const finishPointerDrag = (finishEvent?: Event) => {
      if (finishEvent instanceof PointerEvent && finishEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointerDrag);
      window.removeEventListener('pointercancel', finishPointerDrag);
      window.removeEventListener('blur', finishPointerDrag);
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
      handleElementDragEnd();
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const drag = freeElementDragRef.current;
      if (!drag || drag.pageId !== activePageId || drag.elementId !== id) {
        finishPointerDrag(moveEvent);
        return;
      }
      if (!drag.started) {
        const distance = Math.hypot(
          moveEvent.clientX - drag.startClientX,
          moveEvent.clientY - drag.startClientY,
        );
        if (distance < 3) return;
        drag.started = true;
        remember(sections, drag.groupTargets.length > 1 ? 'Move selected elements' : 'Move element');
        setDraggedElementId(id);
      }
      moveEvent.preventDefault();
      updateElementFreeDrag(sectionId, id, moveEvent.clientX, moveEvent.clientY, moveEvent.altKey);
    };

    target.setPointerCapture?.(pointerId);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishPointerDrag);
    window.addEventListener('pointercancel', finishPointerDrag);
    window.addEventListener('blur', finishPointerDrag, { once: true });
  }

  function handleElementDragOver(targetSectionId: string, targetId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (!e.shiftKey) {
      setDragOverElementId(null);
      setDragOverElementPosition(null);
      return;
    }

    const sourceId = draggedElementRef.current;
    const sourceSectionId = draggedElementSectionRef.current;
    const drag = freeElementDragRef.current;
    if (
      !sourceId ||
      !sourceSectionId ||
      !drag ||
      drag.pageId !== activePageId ||
      sourceId === targetId
    ) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverElementId(targetId);
    setDragOverElementPosition(position);

    setSections((current) => {
      const sourceSection = current.find((section) => section.id === sourceSectionId);
      const targetSection = current.find((section) => section.id === targetSectionId);
      if (!sourceSection || !targetSection) return current;

      const sourceElement = sourceSection.elements.find((element) => element.id === sourceId);
      if (!sourceElement) return current;

      // Build the target list without the dragged element first so the insertion index is stable.
      const targetWithoutSource = targetSection.elements.filter((element) => element.id !== sourceId);
      const targetIndex = targetWithoutSource.findIndex((element) => element.id === targetId);
      if (targetIndex === -1) return current;
      const insertAt = targetIndex + (position === 'after' ? 1 : 0);

      if (sourceSectionId === targetSectionId) {
        const originalIndex = sourceSection.elements.findIndex((element) => element.id === sourceId);
        const currentWithoutSource = sourceSection.elements.filter((element) => element.id !== sourceId);
        const currentInsertAt = Math.min(insertAt, currentWithoutSource.length);
        if (originalIndex === currentInsertAt) return current;

        const nextElements = [...currentWithoutSource];
        nextElements.splice(currentInsertAt, 0, sourceElement);
        return current.map((section) => section.id === sourceSectionId ? { ...section, elements: nextElements } : section);
      }

      const movedElement: WebsiteElement = {
        ...sourceElement,
        containerId: undefined,
        layoutColumn: undefined,
      };
      const nextTargetElements = [...targetWithoutSource];
      nextTargetElements.splice(Math.min(insertAt, nextTargetElements.length), 0, movedElement);
      return current.map((section) => {
        if (section.id === sourceSectionId) return { ...section, elements: section.elements.filter((element) => element.id !== sourceId) };
        if (section.id === targetSectionId) return { ...section, elements: nextTargetElements };
        return section;
      });
    });

    if (sourceSectionId !== targetSectionId) {
      draggedElementSectionRef.current = targetSectionId;
      drag.sectionId = targetSectionId;
      selectEditorTarget(targetSectionId, sourceId);
    }

    setSaved(false);
  }

  function handleElementDrop(targetSectionId: string, targetId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedElementRef.current || e.dataTransfer.getData('application/x-tayar-element');
    const drag = freeElementDragRef.current;
    if (
      sourceId &&
      e.shiftKey &&
      drag?.pageId === activePageId
    ) {
      selectEditorTarget(targetSectionId, sourceId);
      setDragOverElementId(targetId);
    }
    handleElementDragEnd();
  }

  function handleElementDragEnd() {
    const drag = freeElementDragRef.current;
    if (drag?.started && drag.pageId === activePageId) {
      const symbolTargets = new Map(drag.groupTargets.flatMap((target) => target.symbolId ? [[target.symbolId, target] as const] : []));
      if (symbolTargets.size) {
        setPages((current) => current.map((page) =>
          page.id === drag.pageId
            ? page
            : {
                ...page,
                sections: page.sections.map((section) => ({
                  ...section,
                  elements: section.elements.map((element) => {
                    const groupTarget = element.symbolId ? symbolTargets.get(element.symbolId) : undefined;
                    return groupTarget ? {
                      ...element,
                      responsive: {
                        ...element.responsive,
                        [drag.device]: {
                          ...(element.responsive?.[drag.device] || {}),
                          positionX: groupTarget.currentX,
                          positionY: groupTarget.currentY,
                        },
                      },
                    } : element;
                  }),
                })),
              }
        ));
        setSymbols((current) => current.map((symbol) => {
          const groupTarget = symbolTargets.get(symbol.id);
          return groupTarget ? {
            ...symbol,
            element: {
              ...symbol.element,
              responsive: {
                ...symbol.element.responsive,
                [drag.device]: {
                  ...(symbol.element.responsive?.[drag.device] || {}),
                  positionX: groupTarget.currentX,
                  positionY: groupTarget.currentY,
                },
              },
            },
            updatedAt: new Date().toISOString(),
          } : symbol;
        }));
      }
    }
    freeElementDragRef.current = null;
    setCanvasSnapGuide(null);
    draggedElementRef.current = null;
    draggedElementSectionRef.current = null;
    setDraggedElementId(null);
    setDragOverElementId(null);
    setDragOverElementPosition(null);
  }

  function addSection(type: SectionType) {
    remember(sections);
    const section = createSection(type);
    setSections((current) => [...current, section]);
    selectEditorTarget(section.id, section.elements[0]?.id ?? null);
    setSaved(false);
  }

  function insertSectionAfter(afterSectionId: string, type: SectionType) {
    remember(sections);
    const section = createSection(type);
    setSections((current) => {
      const index = current.findIndex((item) => item.id === afterSectionId);
      if (index === -1) return [...current, section];
      const next = [...current];
      next.splice(index + 1, 0, section);
      return next;
    });
    selectEditorTarget(section.id, section.elements[0]?.id ?? null);
    setSaved(false);
  }


  function applyPageTemplate(template: PageTemplateDefinition) {
    remember(sections);
    const nextSections = template.sectionTypes.map((type, index) => {
      const section = createSection(type);
      if (index !== 0 || type !== 'hero') return section;
      return {
        ...section,
        title: template.heroTitle,
        description: template.heroText,
        buttonText: template.heroButton,
        elements: section.elements.map((element) => {
          if (element.type === 'heading') return { ...element, content: template.heroTitle };
          if (element.type === 'text') return { ...element, content: template.heroText };
          if (element.type === 'button') return { ...element, content: template.heroButton };
          return element;
        }),
      };
    });
    clearEditorDragState();
    setSections(nextSections);
    selectEditorTarget(
      nextSections[0]?.id ?? null,
      nextSections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function addSectionTemplate(template: SectionTemplateDefinition) {
    remember(sections);
    const section = createSectionFromTemplate(template);
    setSections((current) => [...current, section]);
    selectEditorTarget(section.id, section.elements[0]?.id ?? null);
    setSaved(false);
  }

  function deleteSection(id: string) {
    if (sections.length <= 1) return;

    const index = sections.findIndex((section) => section.id === id);
    if (index < 0) return;

    remember(sections);
    const next = sections.filter((section) => section.id !== id);

    setSections(next);

    if (id === selectedId) {
      const fallbackSection =
        next[Math.min(Math.max(0, index - 1), next.length - 1)] ||
        next[0] ||
        null;

      selectEditorTarget(
        fallbackSection?.id ?? null,
        fallbackSection?.elements[0]?.id ?? null,
      );
    }

    setSaved(false);
  }

  function moveSection(id: string, direction: 'up' | 'down') {
    remember(sections);
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      if (index === -1) return current;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    setSaved(false);
  }

  function handleDragStart(id: string, e: React.DragEvent) {
    remember(sections);
    draggedSectionRef.current = id;
    draggedSectionPageRef.current = activePageId;
    setDraggedId(id);
    setDragOverId(null);
    setDragOverSectionPosition(null);
    selectEditorTarget(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const sourceId = draggedSectionRef.current;
    if (
      !sourceId ||
      draggedSectionPageRef.current !== activePageId ||
      sourceId === targetId
    ) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverId(targetId);
    setDragOverSectionPosition(position);

    setSections((current) => {
      const source = current.find((section) => section.id === sourceId);
      if (!source) return current;
      const withoutSource = current.filter((section) => section.id !== sourceId);
      const targetIndex = withoutSource.findIndex((section) => section.id === targetId);
      if (targetIndex === -1) return current;
      const insertAt = targetIndex + (position === 'after' ? 1 : 0);
      const currentSourceIndex = current.findIndex((section) => section.id === sourceId);
      if (currentSourceIndex === insertAt) return current;
      const next = [...withoutSource];
      next.splice(Math.min(insertAt, next.length), 0, source);
      return next;
    });
    setSaved(false);
  }

  function handleDrop(e: React.DragEvent, _targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedSectionRef.current || e.dataTransfer.getData('text/plain');
    if (sourceId && draggedSectionPageRef.current === activePageId) {
      selectEditorTarget(sourceId);
    }
    handleDragEnd();
  }

  function handleDragEnd() {
    draggedSectionRef.current = null;
    draggedSectionPageRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSectionPosition(null);
  }
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

  function beginAIRequest(): AbortController {
    aiAbortControllerRef.current?.abort();
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    return controller;
  }

  function finishAIRequest(controller: AbortController) {
    if (aiAbortControllerRef.current === controller) aiAbortControllerRef.current = null;
  }

  function resolveAIPlanReview(approved: boolean) {
    aiPlanReviewResolverRef.current?.(approved);
  }

  function requestAIPlanReview(plan: AIWebsitePlanReview, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (approved: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        if (aiPlanReviewResolverRef.current === finish) aiPlanReviewResolverRef.current = null;
        setAiPlanReview(null);
        resolve(approved);
      };
      const handleAbort = () => finish(false);

      aiPlanReviewResolverRef.current = finish;
      setAiPlanReview(plan);
      signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  function resolveAIPatchReview(approved: boolean) {
    aiPatchReviewResolverRef.current?.(approved ? aiPatchReviewSelectionRef.current : null);
  }

  function requestAIPatchReview(review: AIWebsitePatchReview, signal: AbortSignal): Promise<string[] | null> {
    signal.throwIfAborted();

    return new Promise<string[] | null>((resolve) => {
      let settled = false;
      const finish = (selectedOperationIds: string[] | null) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        if (aiPatchReviewResolverRef.current === finish) aiPatchReviewResolverRef.current = null;
        aiPatchReviewSelectionRef.current = [];
        setAiPatchReview(null);
        resolve(selectedOperationIds);
      };
      const handleAbort = () => finish(null);

      aiPatchReviewResolverRef.current = finish;
      aiPatchReviewSelectionRef.current = review.selectedOperationIds;
      setAiPatchReview(review);
      signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  function toggleAIPatchReviewOperation(operationId: string) {
    setAiPatchReview((current) => {
      if (!current) return current;
      const selected = new Set(current.selectedOperationIds);
      if (selected.has(operationId)) selected.delete(operationId);
      else selected.add(operationId);
      const selectedOperationIds = current.operations
        .map((operation) => operation.id)
        .filter((id) => selected.has(id));
      aiPatchReviewSelectionRef.current = selectedOperationIds;
      const planStepIds = current.planStepIds || [];
      const coveredStepIds = new Set(current.operations
        .filter((operation) => selected.has(operation.id) && operation.planStepId)
        .map((operation) => operation.planStepId as string));
      const uncoveredPlanStepIds = planStepIds.filter((stepId) => !coveredStepIds.has(stepId));
      return {
        ...current,
        selectedOperationIds,
        planCoveragePercent: planStepIds.length ? Math.round((coveredStepIds.size / planStepIds.length) * 100) : 100,
        uncoveredPlanStepIds,
      };
    });
  }

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

  function stopAIRequest() {
    if (!aiBusy) return;
    aiOperationSequenceRef.current += 1;
    resolveAIPlanReview(false);
    resolveAIPatchReview(false);
    resolveAICandidatePreview(false);
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    setAiBusy(false);
    setAiError('');
    setAiStage('ready');
    setAiMessages((current) => [
      ...current,
      { id: `ai-stopped-${Date.now()}`, role: 'assistant' as const, content: l('AI request stopped. No pending changes were applied.') },
    ].slice(-12));
  }

  function beginAIQualityRequest(): AbortController {
    aiQualityAbortControllerRef.current?.abort();
    const controller = new AbortController();
    aiQualityAbortControllerRef.current = controller;
    return controller;
  }

  function finishAIQualityRequest(controller: AbortController) {
    if (aiQualityAbortControllerRef.current === controller) aiQualityAbortControllerRef.current = null;
  }

  function stopAIQualityCheck() {
    if (!aiQualityBusy) return;
    aiQualityOperationSequenceRef.current += 1;
    aiQualityAbortControllerRef.current?.abort();
    aiQualityAbortControllerRef.current = null;
    setAiQualityBusy(false);
    setAiError('');
  }

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

  function undoLastAIChange() {
    if (!aiUndoSnapshot || aiBusy) return;

    const undoContext = aiUndoContextRef.current;
    if (
      !undoContext ||
      !aiProjectIdentityIsCurrent(undoContext)
    ) {
      aiUndoContextRef.current = null;
      setAiUndoSnapshot(null);
      return;
    }

    const snapshot = aiUndoSnapshot;
    const restoredPages = JSON.parse(JSON.stringify(snapshot.pages)) as WebsitePage[];
    const restoredActive = restoredPages.find((page) => page.id === snapshot.activePageId) || restoredPages[0];
    setPages(restoredPages);
    setActivePageId(restoredActive?.id || snapshot.activePageId);
    setHomePageId(snapshot.homePageId);
    setSections(restoredActive?.sections || []);
    setSelectedId(restoredActive?.sections[0]?.id ?? null);
    setSelectedElementId(restoredActive?.sections[0]?.elements[0]?.id ?? null);
    setSiteName(snapshot.siteName);
    setBrand(snapshot.brand);
    setSeo(snapshot.seo);
    setTheme(snapshot.theme);
    setHeaderConfig(snapshot.headerConfig);
    setSymbols(JSON.parse(JSON.stringify(snapshot.symbols)) as WebsiteSymbol[]);
    aiUndoContextRef.current = null;
    setAiUndoSnapshot(null);
    setAiStage('ready');
    setSaved(false);
    setAiMessages((current) => [
      ...current,
      { id: `ai-undo-${Date.now()}`, role: 'assistant' as const, content: l('Reverted the last AI change.') },
    ].slice(-12));
  }

    const applyAIChange = createAIChangeHandler({
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
  });

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

  async function generateImagePrompt() {
    if (aiAbortControllerRef.current || aiQualityAbortControllerRef.current) return;
    if (!selectedSection || aiBusy || aiQualityBusy) return;

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
    const targetSection = selectedSection;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');

      const response = await ai.completeJSON<{
        prompt: string;
      }>(
        {
          action: 'image-prompt',
          section: targetSection,
          brand,
        },
        [],
        { temperature: 0.8, maxTokens: 800, signal: abortController.signal },
      );

      if (!operationCanApply()) return;

      if (!response.json?.prompt) {
        throw new Error(l('AI could not create image prompt.'));
      }

      setSections((current) => current.map((section) =>
        section.id === targetSection.id
          ? { ...section, imagePrompt: response.json!.prompt }
          : section
      ));
      setSaved(false);
    } catch (error) {
      if (!operationCanApply()) return;
      setAiError(
        error instanceof Error
          ? error.message
          : l('Image prompt generation failed.')
      );
    } finally {
      finishAIRequest(abortController);
      if (operationIsLatest()) setAiBusy(false);
    }
  }

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

  function releaseDiffSummary(version: WebsitePublishVersion) {
    return buildProjectSnapshotDiffSummary(
      buildProjectSnapshot() as unknown as Record<string, unknown>,
      version.snapshot || {},
    );
  }

  async function verifyLiveDeployment(
    expectedProjectId: string | null = cloudProjectId,
    expectedOwnerId = activeProjectOwnerId,
    expectedLoadSequence = projectLoadSequenceRef.current,
  ) {
    const verificationSequence = ++liveVerificationSequenceRef.current;
    const verificationUserId = user?.id ?? null;
    const verificationIsCurrent = () =>
      liveVerificationSequenceRef.current === verificationSequence &&
      projectLoadSequenceRef.current === expectedLoadSequence &&
      activeUserIdRef.current === verificationUserId;

    if (!verificationIsCurrent()) return false;

    if (!verificationUserId || !expectedProjectId) {
      setLiveVerification('idle');
      return false;
    }

    setLiveVerification('checking');

    const path = `${expectedOwnerId}/${expectedProjectId}/index.html`;
    const { data, error } = await downloadPublishedWebsiteFile(path);

    if (!verificationIsCurrent()) return false;

    if (error || !data || data.size <= 0) {
      setLiveVerification('failed');
      return false;
    }

    const liveUrl = publicWebsiteUrl(expectedProjectId, expectedOwnerId);
    const routeHealthy = await verifyPublishedRoute(liveUrl);

    if (!verificationIsCurrent()) return false;

    setLiveVerification(routeHealthy ? 'healthy' : 'failed');

    if (!routeHealthy && import.meta.env.PROD) {
      setPublishError('The site files exist, but the public website renderer did not return HTML. Try Publish again after refreshing Tayar.');
    }

    return routeHealthy;
  }


  async function promoteSharePreviewToLive() {
    await publishWebsite(true);
  }
  async function revokeSharePreview(updateBusy = true) {
    if (publishBusy || previewBusy) return;
    if (!user || !cloudProjectId || !previewToken) return;

    const revokeSequence = ++previewOperationSequenceRef.current;
    const revokeLoadSequence = projectLoadSequenceRef.current;
    const revokeProjectId = cloudProjectId;
    const revokeUserId = user.id;
    const revokeToken = previewToken;
    const revokeIsCurrent = () =>
      previewOperationSequenceRef.current === revokeSequence &&
      projectLoadSequenceRef.current === revokeLoadSequence &&
      activeUserIdRef.current === revokeUserId;

    if (updateBusy) setPreviewBusy(true);
    setPreviewError('');

    try {
      const folder = `${revokeUserId}/${revokeProjectId}/previews/${revokeToken}`;
      await removePublishedWebsiteFiles(folder);

      if (!revokeIsCurrent()) return;

      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setPreviewFingerprint('');
      setSaved(false);
    } catch (error) {
      if (!revokeIsCurrent()) return;
      setPreviewError(error instanceof Error ? error.message : 'Could not revoke share preview.');
    } finally {
      if (updateBusy && previewOperationSequenceRef.current === revokeSequence) {
        setPreviewBusy(false);
      }
    }
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
  function restorePublishVersionToEditor(version: WebsitePublishVersion) {
    if (snapshotConflictsWithActiveProject(version.snapshot)) {
      setPublishVersionsError('This release snapshot does not belong to the active project.');
      return;
    }

    if (!window.confirm(l('Restore this release into the editor? The live website will not change until you publish again.'))) return;
    const restored = {
      ...(version.snapshot || {}),
      publishedUrl,
      publishedAt,
      previewUrl,
      previewToken,
      previewCreatedAt,
      lastPublishedVersionId,
      lastPublishedFingerprint,
    };
    saveRecoverySnapshot('before restoring published release');
    prepareProjectStateRestore();
    applyProjectData(restored, false);
    setReleaseHistoryOpen(false);
    setAutoSaveStatus('saving');
  }

  async function deletePublishVersion(version: WebsitePublishVersion) {
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishVersionsError('Only the project owner can delete release archives.');
      return;
    }
    if (version.id === lastPublishedVersionId) {
      setPublishVersionsError('You cannot delete the release currently serving as the live rollback reference.');
      return;
    }
    if (!window.confirm(l('Delete this stored release archive? This cannot be undone.'))) return;

    const deleteLoadSequence = projectLoadSequenceRef.current;
    const deleteProjectId = cloudProjectId;
    const deleteOwnerId = activeProjectOwnerId;
    const deleteUserId = user.id;
    const deleteIsCurrent = () =>
      projectLoadSequenceRef.current === deleteLoadSequence &&
      activeUserIdRef.current === deleteUserId;

    setPublishVersionsLoading(true);
    setPublishVersionsError('');

    try {
      const manifest = Array.isArray(version.file_manifest) ? version.file_manifest : [];
      const { error, recordDeleted } = await deleteWebsitePublishVersionArchive({
        versionId: version.id,
        projectId: deleteProjectId,
        ownerId: deleteOwnerId,
        storagePrefix: version.storage_prefix,
        fileManifest: manifest,
      });

      if (!deleteIsCurrent()) return;
      if (recordDeleted) {
        setPublishVersions((current) => current.filter((item) => item.id !== version.id));
      }
      if (error) throw error;
    } catch (error) {
      if (!deleteIsCurrent()) return;
      setPublishVersionsError(error instanceof Error ? error.message : 'Could not delete this release.');
    } finally {
      if (deleteIsCurrent()) {
        setPublishVersionsLoading(false);
      }
    }
  }

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

  function restoreHistoryEntry(entry: ProjectHistoryEntry) {
    const confirmed = window.confirm(`${l('Restore')} "${entry.label}"? ${l('Your current unsaved changes will be replaced.')}`);
    if (!confirmed) return;

    if (snapshotConflictsWithActiveProject(entry.snapshot)) {
      setCloudError('This history snapshot does not belong to the active project.');
      return;
    }

    saveRecoverySnapshot('before restoring history entry');

    const undoEntry = createEditHistoryEntry(`Before restoring ${entry.label}`);
    prepareProjectStateRestore();
    setHistory((current) => [...current.slice(-49), undoEntry]);
    setFuture([]);

    applyProjectData(entry.snapshot, false, false);
    setHistoryOpen(false);
    setSaved(false);
    setAutoSaveStatus('saving');
  }

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

  function exportProjectBackup() {
    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-backup.json`,
      buildWebsiteProjectBackupText(buildProjectData()),
      'application/json;charset=utf-8',
    );
  }

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

  function exportLeadsCsv() {
    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-leads.csv`,
      buildWebsiteLeadsCsv(leads),
      'text/csv;charset=utf-8',
    );
  }

  function exportAnalyticsCsv() {
    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-analytics.csv`,
      buildWebsiteAnalyticsCsv(analyticsEvents),
      'text/csv;charset=utf-8',
    );
  }

  function exportAuditReport() {
    const content = buildAuditReportText({
      siteName,
      siteAudit,
      pageCount: pages.length,
      networkOnline,
      cloudSyncFailed,
      qualityDiagnostics,
    });
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-audit.txt`, content);
  }

  function approveForDelivery() {
    const approvedAt = new Date().toISOString();
    setDeliveryConfig((current) => ({
      ...current,
      status: 'approved',
      approvedAt,
      approvedFingerprint: buildDeliveryFingerprint(),
      deliveredAt: null,
    }));
    setSaved(false);
  }

  function clearDeliveryApproval() {
    setDeliveryConfig((current) => ({
      ...current,
      status: current.status === 'approved' ? 'review' : current.status,
      approvedAt: null,
      approvedFingerprint: '',
      deliveredAt: null,
    }));
    setSaved(false);
  }

  function markProjectDelivered() {
    if (!publishedUrl && !window.confirm(l('This project is not currently published. Mark it delivered anyway?'))) return;
    setDeliveryConfig((current) => ({ ...current, status: 'delivered', deliveredAt: new Date().toISOString() }));
    setSaved(false);
  }

  function buildDeliveryReport() {
    return buildDeliveryReportText({
      deliveryConfig,
      approvalCurrent,
      siteName,
      launchReadiness,
      siteAudit,
      publishedUrl,
      previewUrl,
      deliveryUsage,
      localize: l,
    });
  }

  function exportDeliveryReport() {
    if (!requireBillingFeature('clientDelivery', 'Client delivery reports')) return;
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-delivery-report.txt`, buildDeliveryReport());
  }



  async function markAllLeadsRead() {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;
    const newIds = leads.filter((lead) => lead.status === 'new').map((lead) => lead.id);
    if (!newIds.length) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;

    const { error } = await updateWebsiteLeadsByStatus({
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      fromStatus: 'new',
      toStatus: 'read',
      updatedAt: new Date().toISOString(),
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not mark all leads as read.');
      return;
    }

    setLeads((current) => current.map((lead) =>
      lead.status === 'new' ? { ...lead, status: 'read' } : lead
    ));
  }
  async function archiveReadLeads() {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;
    const readCount = leads.filter((lead) => lead.status === 'read').length;
    if (!readCount) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;

    const { error } = await updateWebsiteLeadsByStatus({
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      fromStatus: 'read',
      toStatus: 'archived',
      updatedAt: new Date().toISOString(),
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not archive read leads.');
      return;
    }

    setLeads((current) => current.map((lead) =>
      lead.status === 'read' ? { ...lead, status: 'archived' } : lead
    ));
  }
  async function copyProjectSummary() {
    const currentPages = getCurrentPages();
    const sectionCount = currentPages.reduce((sum, page) => sum + page.sections.length, 0);
    const elementCount = currentPages.reduce((sum, page) => sum + page.sections.reduce((s, section) => s + (section.elements?.length || 0), 0), 0);
    const summary = [
      `Site: ${siteName}`,
      `Pages: ${currentPages.length}`,
      `Sections: ${sectionCount}`,
      `Elements: ${elementCount}`,
      `Audit: ${siteAudit.score}/100`,
      `Leads loaded: ${leads.length}`,
      `Analytics events loaded: ${analyticsEvents.length}`,
      `Published: ${publishedUrl || 'No'}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* Clipboard access is optional. */ }
  }

  function previewWebsite() {
    const blob = new Blob([getHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function downloadProductionZip() {
    if (!requireBillingFeature('exportZip', 'Production ZIP export')) return;
    const productionUrl = normalizeSiteUrl(siteUrl);
    if (!productionUrl) {
      window.alert(l('Add your production URL first, for example https://example.com. It is required for canonical URLs and sitemap.xml.'));
      return;
    }

    const currentPages = getOutputPages();
    const files: Array<{ name: string; content: string }> = currentPages.map((page) => {
      const filename = getOutputFilename(page);
      return { name: filename, content: getHtml(page.sections, page.id, undefined, false, true) };
    });

    const sitemapEntries = currentPages.filter((page) => page.noIndex !== true).map((page) => {
      const location = websitePathUrl(productionUrl, getOutputFilename(page), false);
      return `  <url><loc>${escapeHtml(location)}</loc></url>`;
    }).join('\n');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>`;
    const customRobotsRules = sanitizeRobotsRules(productionConfig.customRobotsRules);
    const robots = `User-agent: *\nAllow: /\n${customRobotsRules ? `\n${customRobotsRules}\n` : '\n'}Sitemap: ${productionUrl}/sitemap.xml\n`;
    const readme = `Tayar Website Builder production export\n\nSite: ${siteName}\nProduction URL: ${productionUrl}\nPages: ${currentPages.length}\n\nUpload all files in this ZIP to the root of your static hosting provider.`;

    files.push(
      { name: '404.html', content: get404Html(undefined, false, true) },
      { name: 'sitemap.xml', content: sitemap },
      { name: 'robots.txt', content: robots },
      { name: 'README.txt', content: readme },
    );

    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizeSlug(siteName || 'website')}-production.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

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
  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(getHtml());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(l('Could not copy HTML. Please use Download Website instead.'));
    }
  }

  function setLaunchManualCheck(key: 'stripe' | 'domain' | 'support', checked: boolean) {
    setLaunchManualChecks((current) => {
      const next = { ...current, [key]: checked };
      try { localStorage.setItem(LAUNCH_MANUAL_CHECKS_KEY, JSON.stringify(next)); } catch { /* browser storage may be unavailable */ }
      return next;
    });
  }

  function closeLaunchCenter() {
    setLaunchCenterOpen(false);
    try { localStorage.setItem(LAUNCH_CENTER_SEEN_KEY, '1'); } catch { /* browser storage may be unavailable */ }
  }

  async function runV1LaunchChecks() {
    const launchLoadSequence = projectLoadSequenceRef.current;
    const launchProjectId = cloudProjectId;
    const launchOwnerId = activeProjectOwnerId;
    const launchUserId = user?.id ?? null;
    const launchIsCurrent = () =>
      projectLoadSequenceRef.current === launchLoadSequence &&
      activeUserIdRef.current === launchUserId;

    setLaunchCheckBusy(true);
    try {
      if (user) await refreshBilling(launchProjectId);
      if (!launchIsCurrent()) return;

      if (user && launchProjectId) {
        await refreshProjectTeamAccess(launchProjectId, launchLoadSequence);
        if (!launchIsCurrent()) return;

        if (publishedUrl) {
          await verifyLiveDeployment(
            launchProjectId,
            launchOwnerId,
            launchLoadSequence,
          );
        } else {
          const project = cloudProjects.find((item) => item.id === launchProjectId);
          if (project) await recoverPublishedProjectState(project, launchLoadSequence);
        }
      }

      if (launchIsCurrent()) {
        setLaunchLastCheckedAt(new Date().toISOString());
      }
    } finally {
      if (launchIsCurrent()) {
        setLaunchCheckBusy(false);
      }
    }
  }

  const launchReadiness = useMemo(() => {
    const auditPoints = Math.round(siteAudit.score * 0.4);
    const checks = [
      { label: 'Production URL', ok: Boolean(normalizeSiteUrl(siteUrl)), points: 10 },
      { label: 'Cloud project', ok: Boolean(cloudProjectId), points: 10 },
      { label: 'Share preview', ok: Boolean(previewUrl), points: 8 },
      { label: 'Client approval', ok: approvalCurrent, points: 12 },
      { label: 'Published website', ok: Boolean(publishedUrl), points: 15 },
      { label: 'Favicon', ok: Boolean(faviconUrl.trim()), points: 5 },
    ];
    const score = Math.min(100, auditPoints + checks.reduce((total, item) => total + (item.ok ? item.points : 0), 0));
    return { score, checks, auditPoints };
  }, [siteAudit.score, siteUrl, cloudProjectId, previewUrl, approvalCurrent, publishedUrl, faviconUrl]);
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

  const v1LaunchStatus = useMemo(() => {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const contentReady = currentPages.length > 0 && currentPages.some((page) => page.sections.some((section) => (section.elements || []).length > 0));
    const syncHealthy = networkOnline && !cloudSyncFailed && autoSaveStatus !== 'failed';
    const billingVerified = Boolean(user) && !billingLoading && !billingError;
    const productionUrlReady = Boolean(normalizeSiteUrl(siteUrl));
    const seoReady = Boolean(seo.title.trim() && faviconUrl.trim());
    const auditReady = siteAudit.errors.length === 0 && siteAudit.score >= 80;
    const publishPermission = Boolean(user && cloudProjectId && projectTeamAccess.canPublish);
    const publishedRelease = Boolean(publishedUrl);
    const liveHealthy = Boolean(publishedRelease && liveVerification === 'healthy');
    const unpublished = Boolean(publishedUrl && lastPublishedFingerprint && buildEditableFingerprint() !== lastPublishedFingerprint);

    const checks = [
      { label: 'Site content', detail: `${currentPages.length} page${currentPages.length === 1 ? '' : 's'} configured`, ok: contentReady, points: 8 },
      { label: 'SEO & accessibility audit', detail: `${siteAudit.score}/100 · ${siteAudit.errors.length} critical`, ok: auditReady, points: 15 },
      { label: 'Cloud project', detail: cloudProjectId ? 'Project is saved to Tayar cloud' : 'Save the project to cloud', ok: Boolean(cloudProjectId), points: 10 },
      { label: 'Cloud sync', detail: !networkOnline ? 'Offline' : cloudSyncFailed || autoSaveStatus === 'failed' ? 'Sync needs retry' : 'Sync healthy', ok: syncHealthy, points: 10 },
      { label: 'Production URL', detail: productionUrlReady ? normalizeSiteUrl(siteUrl) : 'Add your production URL', ok: productionUrlReady, points: 8 },
      { label: 'SEO title + favicon', detail: seoReady ? 'Branding metadata is configured' : 'Complete SEO title and favicon', ok: seoReady, points: 7 },
      { label: 'Billing backend', detail: billingVerified ? `${BILLING_PLAN_DETAILS[billingPlan].label} entitlements verified` : billingError || 'Sign in and refresh billing', ok: billingVerified, points: 7 },
      { label: 'Publish permission', detail: projectTeamAccess.canPublish ? 'Owner may publish' : 'Only the project owner can publish', ok: publishPermission, points: 5 },
      { label: 'Published website', detail: publishedRelease ? (lastPublishedVersionId ? `Live · archive ${lastPublishedVersionId.slice(0, 8)}` : 'Live website detected') : 'Publish the first release', ok: publishedRelease, points: 15 },
      { label: 'Live verification', detail: liveVerification === 'healthy' ? 'Published index verified' : publishedRelease ? 'Run live verification' : 'Available after publishing', ok: liveHealthy, points: 15 },
    ];
    const score = Math.min(100, checks.reduce((total, check) => total + (check.ok ? check.points : 0), 0));
    const blockers = [
      !user ? 'Sign in before production launch.' : '',
      !cloudProjectId ? 'Save the project to cloud.' : '',
      !networkOnline ? 'Reconnect to the internet.' : '',
      cloudSyncFailed || autoSaveStatus === 'failed' ? 'Resolve cloud sync before publishing.' : '',
      siteAudit.errors.length ? `Fix ${siteAudit.errors.length} critical audit error${siteAudit.errors.length === 1 ? '' : 's'}.` : '',
      !siteAudit.errors.length && siteAudit.score < 80 ? 'Raise the SEO and accessibility audit score to at least 80.' : '',
      !productionUrlReady ? 'Add a valid production URL.' : '',
      !seoReady ? 'Complete the SEO title and favicon.' : '',
      billingLoading ? 'Wait for billing entitlements to finish loading.' : '',
      !billingVerified && !billingLoading && !billingError ? 'Refresh billing entitlements before publishing.' : '',
      productionConfig.maintenanceMode ? 'Disable maintenance mode for public launch.' : '',
      user && cloudProjectId && !projectTeamAccess.canPublish ? 'The project owner must perform the publish.' : '',
      billingError ? 'Billing entitlements could not be verified.' : '',
    ].filter(Boolean) as string[];
    const preflightReady = blockers.length === 0 && productionUrlReady && seoReady && siteAudit.score >= 80;
    const status = !preflightReady
      ? 'NO-GO'
      : !publishedRelease
        ? 'READY TO PUBLISH'
        : unpublished
          ? 'CHANGES WAITING'
          : liveHealthy
            ? 'V1 LIVE'
            : 'VERIFY LIVE';
    return { score, checks, blockers, preflightReady, publishedRelease, liveHealthy, status };
  }, [pages, activePageId, sections, networkOnline, cloudSyncFailed, autoSaveStatus, user, billingLoading, billingError, billingPlan, siteUrl, seo.title, faviconUrl, siteAudit.score, siteAudit.errors.length, cloudProjectId, projectTeamAccess.canPublish, publishedUrl, lastPublishedVersionId, liveVerification, productionConfig.maintenanceMode, lastPublishedFingerprint, buildEditableFingerprint]);
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

  function openV2MediaUpload() {
    const input =
      document.createElement('input');

    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file =
        input.files?.[0];

      if (file) {
        void uploadMediaFile(file);
      }
    };

    input.click();
  }

  function v2DuplicateSectionDirect(
    sectionId: string,
  ) {
    const source =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    if (!source) return;

    const duplicate =
      cloneSectionWithFreshIds(
        source,
        sections,
      );

    remember(sections);

    setSections((current) => {
      const index = current.findIndex(
        (section) => section.id === sectionId,
      );
      if (index < 0) return current;

      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });

    selectEditorTarget(
      duplicate.id,
      duplicate.elements[0]?.id ?? null,
    );

    setSaved(false);
  }

  function v2MoveElementDirect(
    sectionId: string,
    elementId: string,
    direction: 'up' | 'down',
  ) {
    const targetSection =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    if (!targetSection) return;

    remember(sections);

    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;

        const index = section.elements.findIndex(
          (element) => element.id === elementId,
        );
        if (index < 0) return section;

        const targetIndex =
          direction === 'up'
            ? index - 1
            : index + 1;
        if (
          targetIndex < 0 ||
          targetIndex >= section.elements.length
        ) {
          return section;
        }

        const elements = [...section.elements];
        [elements[index], elements[targetIndex]] = [
          elements[targetIndex],
          elements[index],
        ];

        return {
          ...section,
          elements,
        };
      }),
    );

    selectEditorTarget(sectionId, elementId);
    setSaved(false);
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
  const v2AiPanel = (
    <BuilderAiPanel
      aiBusy={aiBusy}
      aiCandidateActiveOperations={aiCandidateActiveOperations}
      aiCandidateApproveButtonRef={aiCandidateApproveButtonRef}
      aiCandidateCanShowAfter={aiCandidateCanShowAfter}
      aiCandidateCanShowBefore={aiCandidateCanShowBefore}
      aiCandidateGlobalOperations={aiCandidateGlobalOperations}
      aiCandidatePreview={aiCandidatePreview}
      aiCandidateReviewedOperationCount={aiCandidateReviewedOperationCount}
      aiCandidateReviewedPageCount={aiCandidateReviewedPageCount}
      aiCandidateReviewPages={aiCandidateReviewPages}
      aiCandidateTargetableOperations={aiCandidateTargetableOperations}
      aiEditScope={aiEditScope}
      aiEditScopeOptions={aiEditScopeOptions}
      aiError={aiError}
      aiIntent={aiIntent}
      aiMessages={aiMessages}
      aiPatchApproveButtonRef={aiPatchApproveButtonRef}
      aiPatchReview={aiPatchReview}
      aiPlan={aiPlan}
      aiPlanApproveButtonRef={aiPlanApproveButtonRef}
      aiPlanReview={aiPlanReview}
      aiPreparedFollowUpRef={aiPreparedFollowUpRef}
      aiPrompt={aiPrompt}
      aiQualityBusy={aiQualityBusy}
      aiQualityReview={aiQualityReview}
      aiSelectedDestructiveCount={aiSelectedDestructiveCount}
      aiStageStatus={aiStageStatus}
      aiUndoSnapshot={aiUndoSnapshot}
      approveAICandidatePreview={approveAICandidatePreview}
      l={l}
      moveAICandidatePreviewPage={moveAICandidatePreviewPage}
      previewAICandidatePage={previewAICandidatePage}
      previewNextUnreviewedAICandidateOperation={previewNextUnreviewedAICandidateOperation}
      previewNextUnreviewedAICandidatePage={previewNextUnreviewedAICandidatePage}
      resolveAICandidatePreview={resolveAICandidatePreview}
      resolveAIPatchReview={resolveAIPatchReview}
      resolveAIPlanReview={resolveAIPlanReview}
      revealAdjacentAICandidateOperation={revealAdjacentAICandidateOperation}
      revealAICandidateOperation={revealAICandidateOperation}
      runAIQualityCheck={runAIQualityCheck}
      setAICandidatePreviewMode={setAICandidatePreviewMode}
      setAiEditScope={setAiEditScope}
      setAiIntent={setAiIntent}
      setAiPrompt={setAiPrompt}
      stopAIQualityCheck={stopAIQualityCheck}
      stopAIRequest={stopAIRequest}
      submitV2AIRequest={submitV2AIRequest}
      toggleAIPatchReviewOperation={toggleAIPatchReviewOperation}
      undoLastAIChange={undoLastAIChange}
      v2AiMessagesEndRef={v2AiMessagesEndRef}
    />
  );

  const v2CmsPanel = (
    <BuilderCmsPanel
      cms={cms}
      activePage={activePage || undefined}
      selectedElement={selectedElement || undefined}
      disabled={cloudBusy || publishBusy || aiBusy}
      issues={cmsIssues.map((issue) => issue.message)}
      onChange={(nextCms, label) => {
        remember(sections, label);
        setCms(normalizeWebsiteCms(nextCms));
        setSaved(false);
      }}
      onBindElement={(binding?: WebsiteCmsBinding) => {
        updateSelectedElement({ cmsBinding: binding });
      }}
      onSetPageTemplate={(template) => {
        remember(sections, template ? 'Connect dynamic page' : 'Disconnect dynamic page');
        setPages((current) => current.map((page) => page.id === activePageId
          ? { ...page, sections, cmsTemplate: template }
          : page));
        setSaved(false);
      }}
    />
  );
  const v2SitePanel = (
    <BuilderSitePanel
      applyDesignSystemPreset={applyDesignSystemPreset}
      checkCustomDomain={checkCustomDomain}
      cloudProjectId={cloudProjectId}
      connectCustomDomain={connectCustomDomain}
      customDomain={customDomain}
      customDomainBusy={customDomainBusy}
      customDomainDraft={customDomainDraft}
      customDomainError={customDomainError}
      designSystemReport={designSystemReport}
      faviconUrl={faviconUrl}
      footerConfig={footerConfig}
      headerConfig={headerConfig}
      l={l}
      localization={localization}
      localizationIssues={localizationIssues}
      projectTeamAccess={projectTeamAccess}
      removeCustomDomain={removeCustomDomain}
      repairActiveDesignSystem={repairActiveDesignSystem}
      setCustomDomainDraft={setCustomDomainDraft}
      setFaviconUrl={setFaviconUrl}
      setFooterConfig={setFooterConfig}
      setHeaderConfig={setHeaderConfig}
      setLocalization={setLocalization}
      setSaved={setSaved}
      setSiteEnhancements={setSiteEnhancements}
      setSiteName={setSiteName}
      setSiteUrl={setSiteUrl}
      setTheme={setTheme}
      siteEnhancements={siteEnhancements}
      siteName={siteName}
      siteUrl={siteUrl}
      theme={theme}
    />
  );
  const v2SettingsPanel = (
    <BuilderSettingsPanel
      billingEntitlements={billingEntitlements}
      cloudError={cloudError}
      hasUnpublishedChanges={hasUnpublishedChanges}
      l={l}
      launchCheckBusy={launchCheckBusy}
      launchLastCheckedAt={launchLastCheckedAt}
      liveVerification={liveVerification}
      productionConfig={productionConfig}
      publishBlocker={publishBlocker}
      publishBusy={publishBusy}
      publishedAt={publishedAt}
      publishedUrl={publishedUrl}
      publishError={publishError}
      publishWebsite={publishWebsite}
      requireBillingFeature={requireBillingFeature}
      runV1LaunchChecks={runV1LaunchChecks}
      seo={seo}
      setDeliveryOpen={setDeliveryOpen}
      setProductionConfig={setProductionConfig}
      setReleaseHistoryOpen={setReleaseHistoryOpen}
      setSaved={setSaved}
      setSeo={setSeo}
      siteAudit={siteAudit}
      unpublishWebsite={unpublishWebsite}
      verifyLiveDeployment={verifyLiveDeployment}
    />
  );

  const aiCanvasPreviewBanner = aiCanvasPreview ? (
    <div
      className="sticky top-2 z-[80] mx-auto mb-3 flex w-fit max-w-[calc(100%-1rem)] items-center gap-3 rounded-full border border-violet-300/30 bg-[#111122]/95 px-3 py-2 text-[9px] font-bold text-white shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">{l(aiCandidatePreview ? (aiCandidateShowingBefore ? 'Original before AI' : 'Rendered AI result') : 'AI preview only')}</span>
      <span className="hidden text-gray-300 sm:inline">{l(aiCandidatePreview ? 'Compare before and after, then keep or discard from the AI panel' : 'Apply or discard from the AI panel')}</span>
      <span className="flex items-center gap-1 text-violet-300"><i className="h-2 w-2 rounded-full bg-violet-400" />{l('Update')}</span>
      <span className="flex items-center gap-1 text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-400" />{l('Add')}</span>
      <span className="flex items-center gap-1 text-red-300"><i className="h-2 w-2 rounded-full bg-red-400" />{l('Remove')}</span>
    </div>
  ) : null;

  const v2Canvas = (
        <BuilderV2Canvas
              addElementToSection={addElementToSection}
              aiCandidateApproveButtonRef={aiCandidateApproveButtonRef}
              aiCandidatePreview={aiCandidatePreview}
              aiCanvasPreview={aiCanvasPreview}
              aiCanvasPreviewBanner={aiCanvasPreviewBanner}
              aiPatchApproveButtonRef={aiPatchApproveButtonRef}
              beginElementResize={beginElementResize}
              canvasActivePageId={canvasActivePageId}
              canvasHeaderConfig={canvasHeaderConfig}
              canvasPages={canvasPages}
              canvasSections={canvasSections}
              canvasSiteName={canvasSiteName}
              canvasSnapGuide={canvasSnapGuide}
              canvasTheme={canvasTheme}
              darkMode={darkMode}
              deleteSection={deleteSection}
              deleteSelectedElement={deleteSelectedElement}
              device={device}
              draggedElementId={draggedElementId}
              draggedId={draggedId}
              dragOverElementId={dragOverElementId}
              dragOverElementPosition={dragOverElementPosition}
              dragOverId={dragOverId}
              dragOverSectionPosition={dragOverSectionPosition}
              duplicateSelectedElement={duplicateSelectedElement}
              endElementResize={endElementResize}
              footerConfig={footerConfig}
              handleDragEnd={handleDragEnd}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              handleElementDragEnd={handleElementDragEnd}
              handleElementDragMove={handleElementDragMove}
              handleElementDragOver={handleElementDragOver}
              handleElementDragStart={handleElementDragStart}
              handleElementDrop={handleElementDrop}
              handleElementPointerDragStart={handleElementPointerDragStart}
              moveSection={moveSection}
              quickUpdateElement={quickUpdateElement}
              resetElementPosition={resetElementPosition}
              resizeElementFrame={resizeElementFrame}
              selectCanvasElement={selectCanvasElement}
              selectCanvasElements={selectCanvasElements}
              selectedElementId={selectedElementId}
              selectedElementIds={selectedElementIds}
              selectedId={selectedId}
              selectEditorTarget={selectEditorTarget}
              setInspectorOpen={setInspectorOpen}
              setMediaOpen={setMediaOpen}
              updateInlineElementContent={updateInlineElementContent}
              updateInlineElementSource={updateInlineElementSource}
            />
  );

  const commandPaletteItems = [
    { label: 'Save project', keywords: 'save cloud', mutates: true, run: () => void saveProject() },
    { label: 'Preview website', keywords: 'preview open', run: previewWebsite },
    { label: 'Run AI quality check', keywords: 'check quality seo accessibility publish', mutates: true, run: () => void runAIQualityCheck() },
    ...(selectedSection ? [{ label: 'Select all elements in section', keywords: 'select all section elements', run: selectAllCanvasElements }] : []),
    ...(selectedElement && selectedSection && selectedSection.elements.filter((element) => element.type === selectedElement.type).length > 1 ? [{ label: 'Select elements of same type', keywords: `select matching ${selectedElement.type}`, run: () => selectRelatedCanvasElements('type') }] : []),
    ...(selectedElement?.containerId && selectedSection && selectedSection.elements.filter((element) => element.containerId === selectedElement.containerId).length > 1 ? [{ label: 'Select all elements in group', keywords: 'select container group members', run: () => selectRelatedCanvasElements('container') }] : []),
    ...(selectedSection ? [{ label: selectedElements.length > 1 ? 'Copy selected elements' : selectedElement ? 'Copy selected element' : 'Copy selected section', keywords: 'copy clipboard elements section', run: copySelectedTarget }] : []),
    ...(selectedSection ? [{ label: selectedElements.length > 1 ? 'Cut selected elements' : selectedElement ? 'Cut selected element' : 'Cut selected section', keywords: 'cut clipboard elements section', mutates: true, run: cutSelectedTarget }] : []),
    ...(selectedElements.length > 1 ? [{ label: 'Group selected elements', keywords: 'group container selected elements', mutates: true, run: createContainerForSelected }] : []),
    ...(selectedElements.length > 1 && selectedElements.some((element) => element.containerId) ? [{ label: 'Ungroup selected elements', keywords: 'ungroup detach container selected elements', mutates: true, run: ungroupSelectedElements }] : []),
    ...(selectedElements.length > 1 ? [
      { label: 'Match selected widths', keywords: 'size width equal match selection', mutates: true, run: () => normalizeSelectedElementFrames('match-width') },
      { label: 'Match selected appearance', keywords: 'style appearance colors typography match selection', mutates: true, run: () => normalizeSelectedElementFrames('match-appearance') },
      { label: 'Reset selected transforms', keywords: 'reset position rotate selection', mutates: true, run: () => normalizeSelectedElementFrames('reset-position') },
      { label: 'Align selected left', keywords: 'align left selection', mutates: true, run: () => arrangeSelectedElements('left') },
      { label: 'Align selected center', keywords: 'align horizontal center selection', mutates: true, run: () => arrangeSelectedElements('center') },
      { label: 'Align selected top', keywords: 'align top selection', mutates: true, run: () => arrangeSelectedElements('top') },
      { label: 'Align selected middle', keywords: 'align vertical middle selection', mutates: true, run: () => arrangeSelectedElements('middle') },
    ] : []),
    ...(selectedElements.length ? [
      { label: 'Bring selection to front', keywords: 'layer order front selection', mutates: true, run: () => moveSelectedElementsLayer('front') },
      { label: 'Bring selection forward', keywords: 'layer order forward selection', mutates: true, run: () => moveSelectedElementsLayer('forward') },
      { label: 'Send selection backward', keywords: 'layer order backward selection', mutates: true, run: () => moveSelectedElementsLayer('backward') },
      { label: 'Send selection to back', keywords: 'layer order back selection', mutates: true, run: () => moveSelectedElementsLayer('back') },
      { label: 'Show selected elements', keywords: 'visibility show selection', mutates: true, run: () => normalizeSelectedElementFrames('show') },
      { label: 'Hide selected elements', keywords: 'visibility hide selection', mutates: true, run: () => normalizeSelectedElementFrames('hide') },
    ] : []),
    ...(canPasteCopiedTarget() ? [{ label: editorClipboard?.kind === 'section' ? 'Paste copied section' : editorClipboard?.kind === 'elements' ? 'Paste copied elements' : 'Paste copied element', keywords: 'paste clipboard elements section', mutates: true, run: pasteCopiedTarget }] : []),
    { label: 'Duplicate current page', keywords: 'copy page duplicate', mutates: true, run: duplicateActivePage },
    { label: 'Export project backup', keywords: 'backup json export', run: exportProjectBackup },
    { label: 'Import project backup', keywords: 'backup json import restore', mutates: true, run: importProjectBackup },
    ...(recoveryAvailable ? [{ label: 'Restore recovery snapshot', keywords: 'recovery crash restore safety', mutates: true, run: restoreRecoverySnapshot }] : []),
    { label: 'Export audit report', keywords: 'audit seo accessibility', run: exportAuditReport },
    { label: 'Open V1 launch center', keywords: 'launch production go live checklist onboarding readiness', run: () => { setLaunchCenterOpen(true); void runV1LaunchChecks(); } },
    { label: 'Export V1 launch report', keywords: 'launch report final production', run: exportV1LaunchReport },
    { label: 'Open plans & billing', keywords: 'billing plan upgrade subscription usage stripe', run: () => { setBillingOpen(true); void refreshBilling(cloudProjectId); } },
    { label: 'Open client delivery', keywords: 'client delivery handoff approval launch', run: () => { if (requireBillingFeature('clientDelivery', 'Client delivery workspace')) setDeliveryOpen(true); } },
    { label: 'Download client handoff ZIP', keywords: 'client delivery handoff export zip', run: downloadClientHandoffZip },
    { label: 'Open leads', keywords: 'leads inbox contacts', run: () => setLeadsOpen(true) },
    { label: 'Open analytics', keywords: 'analytics stats traffic', run: () => { if (requireBillingFeature('analytics', 'Site analytics')) setAnalyticsOpen(true); } },
    ...pages.map((page) => ({ label: `Go to page: ${page.name}`, keywords: `page ${page.slug}`, run: () => switchPage(page.id) })),
    ...sections.map((section) => ({ label: `Select section: ${section.title || SECTION_LABELS[section.type]}`, keywords: `section ${section.type} ${section.anchorId || ''}`, run: () => { setSelectedId(section.id); setSelectedElementId(section.elements[0]?.id ?? null); } })),
  ];
  const filteredCommandPaletteItems = commandPaletteItems
    .filter((item) => !commandQuery.trim() || `${l(item.label)} ${item.keywords}`.toLowerCase().includes(commandQuery.trim().toLowerCase()))
    .slice(0, 30);
  const commandPaletteOverlay = commandOpen ? (
    <div className="fixed inset-0 z-[250] flex items-start justify-center bg-black/70 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) closeCommandPalette(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={l('Command palette')}
        aria-busy={desktopShortcutActionsRef.current.busy}
        onKeyDown={handleCommandDialogKeyDown}
        className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${darkMode ? 'border-white/10 bg-[#0b0f18]' : 'border-gray-200 bg-white'}`}
      >
        <div className="border-b border-white/10 p-3">
          <input autoFocus type="search" data-command-focus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={handleCommandInputKeyDown} aria-label={l('Type a command, page or section…')} placeholder={l('Type a command, page or section…')} className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-sky-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
        </div>
        <div className="max-h-[60vh] overflow-auto p-2">
          {filteredCommandPaletteItems.map((item) => (
            <button
              key={`${l(item.label)}-${item.keywords}`}
              type="button"
              data-command-item
              data-command-focus
              disabled={'mutates' in item && item.mutates === true && desktopShortcutActionsRef.current.busy}
              onKeyDown={handleCommandItemKeyDown}
              onClick={() => { item.run(); closeCommandPalette(); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${darkMode ? 'text-gray-200 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><span>{l(item.label)}</span><span className="text-[9px] text-gray-500">↵</span></button>
          ))}
          {!filteredCommandPaletteItems.length && <p className="px-3 py-6 text-center text-xs text-gray-500">{l('No matching commands')}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-gray-500"><span>{l('Ctrl/Cmd+K · Ctrl/Cmd+C/X/V')}</span><button type="button" data-command-focus onClick={closeCommandPalette} className="font-semibold text-violet-400">{l('Close')}</button></div>
      </div>
    </div>
  ) : null;

  const legacyBuilder = (
    <div data-tayar-v1-root="true"
      className={`-m-4 flex min-h-[calc(100vh-64px)] flex-col lg:-m-8 ${
        darkMode ? 'bg-[#06060f] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <BuilderLegacyHeader
              aiBusy={aiBusy}
              aiQualityBusy={aiQualityBusy}
              aiQualityReview={aiQualityReview}
              analyticsOpen={analyticsOpen}
              autoSaveStatus={autoSaveStatus}
              billingOpen={billingOpen}
              billingPlan={billingPlan}
              cloudBusy={cloudBusy}
              cloudProjectId={cloudProjectId}
              cloudProjects={cloudProjects}
              darkMode={darkMode}
              deliveryConfig={deliveryConfig}
              deliveryOpen={deliveryOpen}
              device={device}
              downloadProductionZip={downloadProductionZip}
              duplicateProject={duplicateProject}
              future={future}
              hasUnpublishedChanges={hasUnpublishedChanges}
              history={history}
              historyOpen={historyOpen}
              inspectorOpen={inspectorOpen}
              l={l}
              launchCenterOpen={launchCenterOpen}
              leads={leads}
              leadsOpen={leadsOpen}
              leftSidebarOpen={leftSidebarOpen}
              liveVerification={liveVerification}
              loadCloudProject={loadCloudProject}
              mediaOpen={mediaOpen}
              networkOnline={networkOnline}
              operationsOpen={operationsOpen}
              previewWebsite={previewWebsite}
              projectTeamAccess={projectTeamAccess}
              publishBusy={publishBusy}
              publishedAt={publishedAt}
              publishedUrl={publishedUrl}
              publishVersions={publishVersions}
              publishWebsite={publishWebsite}
              qualityDiagnostics={qualityDiagnostics}
              redo={redo}
              refreshBilling={refreshBilling}
              releaseHistoryOpen={releaseHistoryOpen}
              requireBillingFeature={requireBillingFeature}
              resetProject={resetProject}
              runAIQualityCheck={runAIQualityCheck}
              runV1LaunchChecks={runV1LaunchChecks}
              saved={saved}
              saveProject={saveProject}
              setAnalyticsOpen={setAnalyticsOpen}
              setBillingOpen={setBillingOpen}
              setDeliveryOpen={setDeliveryOpen}
              setDevice={setDevice}
              setHistoryOpen={setHistoryOpen}
              setInspectorOpen={setInspectorOpen}
              setLaunchCenterOpen={setLaunchCenterOpen}
              setLeadsOpen={setLeadsOpen}
              setLeftSidebarOpen={setLeftSidebarOpen}
              setMediaOpen={setMediaOpen}
              setOperationsOpen={setOperationsOpen}
              setReleaseHistoryOpen={setReleaseHistoryOpen}
              setSaved={setSaved}
              setSiteName={setSiteName}
              setSiteUrl={setSiteUrl}
              siteName={siteName}
              siteUrl={siteUrl}
              stopAIQualityCheck={stopAIQualityCheck}
              undo={undo}
              unpublishWebsite={unpublishWebsite}
              user={user}
              v1LaunchStatus={v1LaunchStatus}
              verifyLiveDeployment={verifyLiveDeployment}
            />

      {publishError && (
        <div className={`border-b px-4 py-2 text-xs ${darkMode ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {publishError}
        </div>
      )}

      {cloudError && (
        <div className={`border-b px-4 py-2 text-xs ${darkMode ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {l(cloudError)}
        </div>
      )}

      {aiQualityOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-emerald-500/15 bg-[#07140f]' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold">
                  <Check className="h-4 w-4 text-emerald-400" />
                  {l('AI Quality Check')}
                  {aiQualityReview && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${aiQualityReview.score >= 80 ? 'bg-emerald-500/10 text-emerald-400' : aiQualityReview.score >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>{aiQualityReview.score}/100</span>}
                </p>
                <p className="mt-1 text-[10px] text-gray-500">{aiQualityReview?.summary ? l(aiQualityReview.summary) : (aiQualityBusy ? l('Reviewing design, content, SEO, accessibility and publish readiness…') : l('Run the final AI review before publishing.'))}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={aiQualityBusy ? stopAIQualityCheck : () => void runAIQualityCheck()} disabled={aiBusy} className={`text-xs font-semibold disabled:opacity-40 ${aiQualityBusy ? 'text-rose-400' : 'text-emerald-400'}`}>{aiQualityBusy ? l('Stop check') : l('Run again')}</button>
                <button onClick={() => setAiQualityOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {aiQualityReview && (
              <>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {aiQualityReview.findings.map((finding, index) => (
                    <article key={`${finding.title}-${index}`} className={`rounded-xl border p-3 ${darkMode ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-white'}`}>
                      <span className={`text-[8px] font-black uppercase tracking-wider ${finding.severity === 'critical' ? 'text-rose-400' : finding.severity === 'warning' ? 'text-amber-400' : 'text-sky-400'}`}>{l(finding.severity)}</span>
                      <p className="mt-1 text-[10px] font-bold">{l(finding.title)}</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-gray-500">{l(finding.detail)}</p>
                    </article>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {aiQualityReview.fixPrompt && (
                    <button onClick={() => void fixAIQualityIssues()} disabled={aiBusy || aiQualityBusy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{l('Fix safe issues with AI')}</button>
                  )}
                  <button onClick={previewWebsite} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${darkMode ? 'border-white/10 text-gray-300' : 'border-gray-200 bg-white text-gray-700'}`}>{l('Preview')}</button>
                  <span className="text-[9px] text-gray-500">{l('Publish remains blocked by critical deterministic audit errors and launch checks.')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {commandOpen && (
        <BuilderLegacyCommandPalette
              arrangeSelectedElements={arrangeSelectedElements}
              canPasteCopiedTarget={canPasteCopiedTarget}
              closeCommandPalette={closeCommandPalette}
              cloudProjectId={cloudProjectId}
              commandQuery={commandQuery}
              copySelectedTarget={copySelectedTarget}
              createContainerForSelected={createContainerForSelected}
              cutSelectedTarget={cutSelectedTarget}
              darkMode={darkMode}
              desktopShortcutActionsRef={desktopShortcutActionsRef}
              downloadClientHandoffZip={downloadClientHandoffZip}
              duplicateActivePage={duplicateActivePage}
              editorClipboard={editorClipboard}
              exportAuditReport={exportAuditReport}
              exportProjectBackup={exportProjectBackup}
              exportV1LaunchReport={exportV1LaunchReport}
              handleCommandDialogKeyDown={handleCommandDialogKeyDown}
              handleCommandInputKeyDown={handleCommandInputKeyDown}
              handleCommandItemKeyDown={handleCommandItemKeyDown}
              importProjectBackup={importProjectBackup}
              l={l}
              moveSelectedElementsLayer={moveSelectedElementsLayer}
              normalizeSelectedElementFrames={normalizeSelectedElementFrames}
              pages={pages}
              pasteCopiedTarget={pasteCopiedTarget}
              previewWebsite={previewWebsite}
              recoveryAvailable={recoveryAvailable}
              refreshBilling={refreshBilling}
              requireBillingFeature={requireBillingFeature}
              restoreRecoverySnapshot={restoreRecoverySnapshot}
              runAIQualityCheck={runAIQualityCheck}
              runV1LaunchChecks={runV1LaunchChecks}
              saveProject={saveProject}
              sections={sections}
              selectAllCanvasElements={selectAllCanvasElements}
              selectedElement={selectedElement}
              selectedElements={selectedElements}
              selectedSection={selectedSection}
              selectRelatedCanvasElements={selectRelatedCanvasElements}
              setAnalyticsOpen={setAnalyticsOpen}
              setBillingOpen={setBillingOpen}
              setCommandQuery={setCommandQuery}
              setDeliveryOpen={setDeliveryOpen}
              setLaunchCenterOpen={setLaunchCenterOpen}
              setLeadsOpen={setLeadsOpen}
              setSelectedElementId={setSelectedElementId}
              setSelectedId={setSelectedId}
              switchPage={switchPage}
              ungroupSelectedElements={ungroupSelectedElements}
            />
      )}

      {launchCenterOpen && (
        <BuilderLegacyLaunchCenter
              applyPageTemplate={applyPageTemplate}
              closeLaunchCenter={closeLaunchCenter}
              cloudBusy={cloudBusy}
              cloudProjectId={cloudProjectId}
              cloudSyncFailed={cloudSyncFailed}
              darkMode={darkMode}
              exportV1LaunchReport={exportV1LaunchReport}
              l={l}
              launchCheckBusy={launchCheckBusy}
              launchLastCheckedAt={launchLastCheckedAt}
              launchManualChecks={launchManualChecks}
              liveVerification={liveVerification}
              networkOnline={networkOnline}
              previewWebsite={previewWebsite}
              projectTeamAccess={projectTeamAccess}
              publishBusy={publishBusy}
              publishedUrl={publishedUrl}
              publishWebsite={publishWebsite}
              qualityDiagnostics={qualityDiagnostics}
              refreshBilling={refreshBilling}
              runV1LaunchChecks={runV1LaunchChecks}
              saveProject={saveProject}
              setBillingOpen={setBillingOpen}
              setLaunchManualCheck={setLaunchManualCheck}
              setOperationsOpen={setOperationsOpen}
              setSaved={setSaved}
              setSiteName={setSiteName}
              setSiteUrl={setSiteUrl}
              siteAudit={siteAudit}
              siteName={siteName}
              siteUrl={siteUrl}
              v1LaunchStatus={v1LaunchStatus}
              verifyLiveDeployment={verifyLiveDeployment}
            />
      )}

      {billingOpen && (
        <BuilderLegacyBilling
              analyticsEvents={analyticsEvents}
              billingBusy={billingBusy}
              billingEntitlements={billingEntitlements}
              billingError={billingError}
              billingLoading={billingLoading}
              billingPlan={billingPlan}
              billingState={billingState}
              cloudProjectId={cloudProjectId}
              darkMode={darkMode}
              l={l}
              leads={leads}
              openBillingPortal={openBillingPortal}
              pages={pages}
              refreshBilling={refreshBilling}
              setBillingOpen={setBillingOpen}
              startBillingCheckout={startBillingCheckout}
            />
      )}

      {deliveryOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-fuchsia-500/20 bg-[#170b18]' : 'border-fuchsia-200 bg-fuchsia-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Client Delivery Workspace')}</p>
                <p className="text-[11px] text-gray-500">{l('Approval, launch readiness, usage and one-click client handoff.')}</p>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && <button onClick={() => void navigator.clipboard.writeText(previewUrl)} className="text-xs font-semibold text-cyan-400">{l('Copy preview')}</button>}
                <button onClick={() => setDeliveryOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-fuchsia-400">{l('Client & project')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-gray-500">{l('Client name')}<input value={deliveryConfig.clientName} onChange={(e) => setDeliveryConfig((current) => ({ ...current, clientName: e.target.value.slice(0, 160) }))} placeholder={l('Client or company')} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Client email')}<input value={deliveryConfig.clientEmail} onChange={(e) => setDeliveryConfig((current) => ({ ...current, clientEmail: e.target.value.slice(0, 200) }))} placeholder="client@example.com" className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Project code')}<input value={deliveryConfig.projectCode} onChange={(e) => setDeliveryConfig((current) => ({ ...current, projectCode: e.target.value.slice(0, 80) }))} placeholder="WEB-001" className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Due date')}<input type="date" value={deliveryConfig.dueDate} onChange={(e) => setDeliveryConfig((current) => ({ ...current, dueDate: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Delivery status')}<select value={deliveryConfig.status} onChange={(e) => setDeliveryConfig((current) => ({ ...current, status: e.target.value as DeliveryStatus }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white'}`}><option value="building">{l('Building')}</option><option value="review">{l('Ready for review')}</option><option value="approved">{l('Approved')}</option><option value="delivered">{l('Delivered')}</option></select></label>
                  <label className="flex items-end gap-2 rounded-lg border border-fuchsia-500/15 px-3 py-2 text-[10px] text-gray-400"><input type="checkbox" checked={deliveryConfig.whiteLabel} disabled={!billingEntitlements.features.whiteLabel} onChange={(e) => { if (!requireBillingFeature('whiteLabel', 'White-label client delivery')) return; setDeliveryConfig((current) => ({ ...current, whiteLabel: e.target.checked })); }} /> {l('White-label client handoff files')} {!billingEntitlements.features.whiteLabel && <span className="font-bold text-amber-400">BUSINESS</span>}</label>
                </div>
                <label className="mt-2 block text-[10px] text-gray-500">{l('Handoff notes')}<textarea value={deliveryConfig.handoffNotes} onChange={(e) => setDeliveryConfig((current) => ({ ...current, handoffNotes: e.target.value.slice(0, 4000) }))} rows={4} placeholder={l('Hosting notes, DNS details, next steps, support terms…')} className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">{l('Launch readiness')}</p><span className={`text-2xl font-black ${launchReadiness.score >= 85 ? 'text-emerald-400' : launchReadiness.score >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>{launchReadiness.score}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${launchReadiness.score}%` }} /></div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
                  {launchReadiness.checks.map((item) => <div key={l(item.label)} className={`rounded-lg border px-2 py-1.5 ${item.ok ? 'border-emerald-500/20 text-emerald-400' : 'border-white/10 text-gray-500'}`}>{item.ok ? '✓' : '○'} {l(item.label)}</div>)}
                </div>
                <p className="mt-2 text-[9px] text-gray-500">{l('Audit contributes')} {launchReadiness.auditPoints}/40 {l('points · current audit')} {siteAudit.score}/100.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {[
                ['Pages', deliveryUsage.pages], ['Sections', deliveryUsage.sections], ['Elements', deliveryUsage.elements], ['Forms', deliveryUsage.forms], ['Symbols', deliveryUsage.symbols], ['Releases', deliveryUsage.releases], ['Leads', deliveryUsage.leads], ['Events', deliveryUsage.analyticsEvents], ['Media*', deliveryUsage.mediaLoaded],
              ].map(([label, value]) => <div key={String(label)} className={`rounded-xl border p-2 text-center ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}><p className="text-[9px] uppercase text-gray-500">{l(String(label))}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}
            </div>
            <p className="-mt-2 text-[9px] text-gray-500">{l('*Media count reflects assets currently loaded into the Media Library panel.')}</p>

            <div className={`rounded-xl border p-3 ${approvalCurrent ? 'border-emerald-500/25 bg-emerald-500/5' : deliveryConfig.approvedAt ? 'border-amber-500/25 bg-amber-500/5' : darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">{l('Client approval fingerprint')}</p>
                  <p className={`mt-1 text-[10px] ${approvalCurrent ? 'text-emerald-400' : deliveryConfig.approvedAt ? 'text-amber-400' : 'text-gray-500'}`}>{deliveryConfig.approvedAt ? (approvalCurrent ? `${l('Approved')} ${new Date(deliveryConfig.approvedAt).toLocaleString()} — ${l('current build still matches')}` : `${l('Approved')} ${new Date(deliveryConfig.approvedAt).toLocaleString()} — ${l('website changed after approval')}`) : l('No approval snapshot recorded yet.')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={approveForDelivery} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">{l('Approve current build')}</button>
                  {deliveryConfig.approvedAt && <button onClick={clearDeliveryApproval} className="rounded-lg border border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-400">{l('Clear approval')}</button>}
                  <button onClick={markProjectDelivered} className="rounded-lg border border-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-400">{l('Mark delivered')}</button>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button onClick={downloadClientHandoffZip} className="rounded-xl bg-fuchsia-600 p-3 text-left text-xs font-bold text-white hover:bg-fuchsia-500">{l('Download client handoff ZIP')}<div className="mt-1 text-[10px] font-normal text-fuchsia-100">{l('Site + backup + reports + checksums')}</div></button>
              <button onClick={exportDeliveryReport} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{l('Export delivery report')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Approval, readiness, usage and audit')}</div></button>
              <button onClick={() => setReleaseHistoryOpen(true)} disabled={!user || !cloudProjectId} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{l('Open releases')}<div className="mt-1 text-[10px] font-normal text-gray-500">{publishVersions.length} {l('loaded releases')}</div></button>
              <button onClick={() => previewUrl ? window.open(previewUrl, '_blank', 'noopener,noreferrer') : setReleaseHistoryOpen(true)} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{previewUrl ? l('Open client preview') : l('Create client preview')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Unlisted review link')}</div></button>
            </div>
          </div>
        </div>
      )}

      {operationsOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-sky-500/20 bg-[#08131a]' : 'border-sky-200 bg-sky-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold">{l('Operations & Reliability')}</p><p className="text-[11px] text-gray-500">{l('Backup, restore, exports and bulk operations.')}</p></div>
              <div className="flex items-center gap-2"><button onClick={() => setCommandOpen(true)} className="text-xs font-semibold text-sky-400">{l('Command palette')}</button><button onClick={() => setOperationsOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button onClick={exportProjectBackup} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export project backup')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Portable JSON snapshot')}</div></button>
              <button onClick={importProjectBackup} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Import project backup')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Restore JSON as local draft')}</div></button>
              <button onClick={exportAuditReport} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export audit report')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Score')} {siteAudit.score}/100</div></button>
              <button onClick={() => void copyProjectSummary()} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{copied ? l('Summary copied') : l('Copy project summary')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Pages, elements and health')}</div></button>
              <button onClick={exportLeadsCsv} disabled={!leads.length} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export leads CSV')}<div className="mt-1 text-[10px] font-normal text-gray-500">{leads.length} {l('loaded leads')}</div></button>
              <button onClick={exportAnalyticsCsv} disabled={!analyticsEvents.length} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export analytics CSV')}<div className="mt-1 text-[10px] font-normal text-gray-500">{analyticsEvents.length} {l('loaded events')}</div></button>
              <button onClick={() => void markAllLeadsRead()} disabled={!leads.some((lead) => lead.status === 'new')} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Mark all leads read')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Bulk inbox cleanup')}</div></button>
              <button onClick={() => void archiveReadLeads()} disabled={!leads.some((lead) => lead.status === 'read')} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Archive read leads')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Keep inbox focused')}</div></button>
            </div>
            <p className="text-[10px] text-gray-500">{l('Shortcuts: Ctrl/Cmd+K commands · Ctrl/Cmd+C/X/V clipboard · Ctrl/Cmd+G group · Ctrl/Cmd+Shift+G ungroup · Ctrl/Cmd+[ or ] layers · arrows move · Shift+arrows move 10px.')}</p>
          </div>
        </div>
      )}

      {analyticsOpen && (
        <BuilderLegacyAnalytics
              analyticsError={analyticsError}
              analyticsEvents={analyticsEvents}
              analyticsLoading={analyticsLoading}
              analyticsSummary={analyticsSummary}
              darkMode={darkMode}
              exportAnalyticsCsv={exportAnalyticsCsv}
              l={l}
              refreshAnalytics={refreshAnalytics}
              setAnalyticsOpen={setAnalyticsOpen}
            />
      )}

      {mediaOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-fuchsia-500/20 bg-[#170b18]' : 'border-fuchsia-200 bg-fuchsia-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Media Library')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l("Upload reusable images to your account and place them into any image element.")}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white ${mediaUploading ? 'pointer-events-none bg-fuchsia-400 opacity-60' : 'bg-fuchsia-600 hover:bg-fuchsia-500'}`}>
                  <Upload className="h-3.5 w-3.5" />
                  {mediaUploading ? 'Uploading…' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={mediaUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadMediaFile(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <button onClick={() => void refreshMedia()} disabled={mediaLoading} className="text-xs font-semibold text-fuchsia-400 disabled:opacity-50">
                  {mediaLoading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={() => setMediaOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {mediaError && <p className="text-xs text-amber-400">{l(mediaError)}</p>}

            {!mediaLoading && !mediaAssets.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l("No images yet. Upload JPG, PNG, WebP or GIF files up to 5 MB.")}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {mediaAssets.map((asset) => (
                  <article key={asset.path} className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                    <button type="button" onClick={() => applyMediaAsset(asset)} className="block w-full" title={l('Use image')}>
                      <img src={asset.url} alt={asset.name} className="aspect-square w-full object-cover" loading="lazy" />
                    </button>
                    <div className="p-2">
                      <p className="truncate text-[10px] font-semibold" title={asset.name}>{asset.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button onClick={() => applyMediaAsset(asset)} className="text-[10px] font-bold text-fuchsia-400">{l('Use')}</button>
                        <button onClick={() => { setFaviconUrl(asset.url); setSaved(false); }} className="text-[10px] font-bold text-emerald-400">{l('Favicon')}</button>
                        <button onClick={() => updateActivePageMeta({ socialImage: asset.url })} disabled={!activePage} className="text-[10px] font-bold text-sky-400 disabled:opacity-40">{l('Social')}</button>
                        <button onClick={() => void deleteMediaAsset(asset)} className="text-[10px] font-bold text-rose-400">{l('Delete')}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {leadsOpen && (
        <BuilderLegacyLeads
              archiveReadLeads={archiveReadLeads}
              bulkUpdateLeadStage={bulkUpdateLeadStage}
              copyLeadSummary={copyLeadSummary}
              darkMode={darkMode}
              deleteLead={deleteLead}
              exportLeadsCsv={exportLeadsCsv}
              filteredLeads={filteredLeads}
              formDeliveries={formDeliveries}
              l={l}
              leadCrmSummary={leadCrmSummary}
              leadQuery={leadQuery}
              leads={leads}
              leadsError={leadsError}
              leadsLoading={leadsLoading}
              leadStageFilter={leadStageFilter}
              leadStatusFilter={leadStatusFilter}
              markAllLeadsRead={markAllLeadsRead}
              openWebsiteFormUpload={openWebsiteFormUpload}
              refreshLeads={refreshLeads}
              selectedLeadIds={selectedLeadIds}
              setLeadQuery={setLeadQuery}
              setLeadsOpen={setLeadsOpen}
              setLeadStageFilter={setLeadStageFilter}
              setLeadStatusFilter={setLeadStatusFilter}
              setSelectedLeadIds={setSelectedLeadIds}
              updateLeadCrm={updateLeadCrm}
              updateLeadStatus={updateLeadStatus}
            />
      )}

      {releaseHistoryOpen && (
        <BuilderLegacyReleaseHistory
              cloudProjectId={cloudProjectId}
              createSharePreview={createSharePreview}
              currentAIEditableFingerprint={currentAIEditableFingerprint}
              darkMode={darkMode}
              deletePublishVersion={deletePublishVersion}
              hasUnpublishedChanges={hasUnpublishedChanges}
              l={l}
              lastPublishedVersionId={lastPublishedVersionId}
              previewBusy={previewBusy}
              previewCreatedAt={previewCreatedAt}
              previewError={previewError}
              previewFingerprint={previewFingerprint}
              previewUrl={previewUrl}
              promoteSharePreviewToLive={promoteSharePreviewToLive}
              publishBusy={publishBusy}
              publishedUrl={publishedUrl}
              publishVersions={publishVersions}
              publishVersionsError={publishVersionsError}
              publishVersionsLoading={publishVersionsLoading}
              refreshPublishVersions={refreshPublishVersions}
              releaseDiffSummary={releaseDiffSummary}
              releaseNote={releaseNote}
              restorePublishVersionToEditor={restorePublishVersionToEditor}
              revokeSharePreview={revokeSharePreview}
              rollbackPublishVersion={rollbackPublishVersion}
              setReleaseHistoryOpen={setReleaseHistoryOpen}
              setReleaseNote={setReleaseNote}
              user={user}
            />
      )}

      {historyOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-white/10 bg-[#0d0d20]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Project History')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('Up to 30 manual and AI checkpoints. Autosave stays lightweight.')}</p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
            </div>
            {projectHistory.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {projectHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => restoreHistoryEntry(entry)}
                    className={`min-w-52 rounded-lg border px-3 py-2 text-left text-xs ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                    title={l('Restore this version')}
                  >
                    <span className="block font-semibold">{entry.label}</span>
                    <span className={`mt-1 block text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{l('Restore version')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('No restore points yet. Save or use Tayar AI to create the first checkpoint.')}</p>
            )}
          </div>
        </div>
      )}

      <div data-tayar-v1-workspace="true" className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <BuilderLegacySidebar
              activePage={activePage}
              activePageId={activePageId}
              addElement={addElement}
              addPage={addPage}
              addSection={addSection}
              addSectionTemplate={addSectionTemplate}
              advancedSiteSettingsOpen={advancedSiteSettingsOpen}
              aiBusy={aiBusy}
              aiError={aiError}
              aiMessages={aiMessages}
              aiPlan={aiPlan}
              aiPrompt={aiPrompt}
              aiQualityBusy={aiQualityBusy}
              aiStage={aiStage}
              aiStageStatus={aiStageStatus}
              aiUndoSnapshot={aiUndoSnapshot}
              applyAIChange={applyAIChange}
              applyDesignSystemPreset={applyDesignSystemPreset}
              applyPageTemplate={applyPageTemplate}
              applyThemeToAllPages={applyThemeToAllPages}
              applyThemeToCurrentPage={applyThemeToCurrentPage}
              billingEntitlements={billingEntitlements}
              builderPanel={builderPanel}
              copied={copied}
              copyHtml={copyHtml}
              darkMode={darkMode}
              deleteActivePage={deleteActivePage}
              deleteReusableSection={deleteReusableSection}
              designSystemReport={designSystemReport}
              duplicateActivePage={duplicateActivePage}
              duplicatePageAsTranslation={duplicatePageAsTranslation}
              faviconUrl={faviconUrl}
              footerConfig={footerConfig}
              generateRealImage={generateRealImage}
              generateWithAI={generateWithAI}
              headerConfig={headerConfig}
              homePageId={homePageId}
              insertReusableSection={insertReusableSection}
              l={l}
              leftSidebarOpen={leftSidebarOpen}
              localization={localization}
              makeActivePageHome={makeActivePageHome}
              movePage={movePage}
              openBillingWithMessage={openBillingWithMessage}
              pages={pages}
              pageSettingsOpen={pageSettingsOpen}
              prefs={prefs}
              productionConfig={productionConfig}
              qualityDiagnostics={qualityDiagnostics}
              recoveryAvailable={recoveryAvailable}
              repairActiveDesignSystem={repairActiveDesignSystem}
              requireBillingFeature={requireBillingFeature}
              restoreRecoverySnapshot={restoreRecoverySnapshot}
              reusableBusy={reusableBusy}
              reusableError={reusableError}
              reusableSections={reusableSections}
              runAIQualityCheck={runAIQualityCheck}
              saveSelectedSectionAsReusable={saveSelectedSectionAsReusable}
              sections={sections}
              selectedElementId={selectedElementId}
              selectedId={selectedId}
              selectedSection={selectedSection}
              seo={seo}
              setAdvancedSiteSettingsOpen={setAdvancedSiteSettingsOpen}
              setAiError={setAiError}
              setAiPrompt={setAiPrompt}
              setAiStage={setAiStage}
              setBuilderPanel={setBuilderPanel}
              setFaviconUrl={setFaviconUrl}
              setFooterConfig={setFooterConfig}
              setHeaderConfig={setHeaderConfig}
              setInspectorOpen={setInspectorOpen}
              setLeftSidebarOpen={setLeftSidebarOpen}
              setLocalization={setLocalization}
              setPageSettingsOpen={setPageSettingsOpen}
              setProductionConfig={setProductionConfig}
              setSaved={setSaved}
              setSelectedElementId={setSelectedElementId}
              setSelectedId={setSelectedId}
              setSeo={setSeo}
              setSiteEnhancements={setSiteEnhancements}
              setTheme={setTheme}
              siteAudit={siteAudit}
              siteEnhancements={siteEnhancements}
              stopAIQualityCheck={stopAIQualityCheck}
              switchPage={switchPage}
              theme={theme}
              undoLastAIChange={undoLastAIChange}
              updateActivePageMeta={updateActivePageMeta}
            />

        <BuilderLegacyCanvas
              addElementToSection={addElementToSection}
              aiCandidateApproveButtonRef={aiCandidateApproveButtonRef}
              aiCandidatePreview={aiCandidatePreview}
              aiCanvasPreview={aiCanvasPreview}
              aiCanvasPreviewBanner={aiCanvasPreviewBanner}
              aiPatchApproveButtonRef={aiPatchApproveButtonRef}
              beginElementResize={beginElementResize}
              canvasActivePageId={canvasActivePageId}
              canvasHeaderConfig={canvasHeaderConfig}
              canvasPages={canvasPages}
              canvasSections={canvasSections}
              canvasSiteName={canvasSiteName}
              canvasSnapGuide={canvasSnapGuide}
              canvasTheme={canvasTheme}
              darkMode={darkMode}
              deleteSection={deleteSection}
              deleteSelectedElement={deleteSelectedElement}
              device={device}
              draggedElementId={draggedElementId}
              draggedId={draggedId}
              dragOverElementId={dragOverElementId}
              dragOverElementPosition={dragOverElementPosition}
              dragOverId={dragOverId}
              dragOverSectionPosition={dragOverSectionPosition}
              duplicateSelectedElement={duplicateSelectedElement}
              endElementResize={endElementResize}
              footerConfig={footerConfig}
              handleDragEnd={handleDragEnd}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              handleElementDragEnd={handleElementDragEnd}
              handleElementDragMove={handleElementDragMove}
              handleElementDragOver={handleElementDragOver}
              handleElementDragStart={handleElementDragStart}
              handleElementDrop={handleElementDrop}
              handleElementPointerDragStart={handleElementPointerDragStart}
              insertSectionAfter={insertSectionAfter}
              l={l}
              moveSection={moveSection}
              quickUpdateElement={quickUpdateElement}
              resetElementPosition={resetElementPosition}
              resizeElementFrame={resizeElementFrame}
              selectCanvasElement={selectCanvasElement}
              selectCanvasElements={selectCanvasElements}
              selectedElementId={selectedElementId}
              selectedElementIds={selectedElementIds}
              selectedId={selectedId}
              selectEditorTarget={selectEditorTarget}
              setInspectorOpen={setInspectorOpen}
              setMediaOpen={setMediaOpen}
              updateInlineElementContent={updateInlineElementContent}
              updateInlineElementSource={updateInlineElementSource}
            />

        <BuilderLegacyInspector
              addFormAutomation={addFormAutomation}
              addFormField={addFormField}
              aiBusy={aiBusy}
              aiQualityBusy={aiQualityBusy}
              assignSelectedToContainer={assignSelectedToContainer}
              copySelectedElementResponsiveFrom={copySelectedElementResponsiveFrom}
              copySelectedSectionResponsiveFrom={copySelectedSectionResponsiveFrom}
              createContainerForSelected={createContainerForSelected}
              createSymbolFromSelected={createSymbolFromSelected}
              darkMode={darkMode}
              deleteFormAutomation={deleteFormAutomation}
              deleteFormField={deleteFormField}
              deleteSection={deleteSection}
              deleteSelectedContainer={deleteSelectedContainer}
              deleteSelectedElement={deleteSelectedElement}
              deleteSymbol={deleteSymbol}
              detachSelectedSymbol={detachSelectedSymbol}
              device={device}
              duplicateSelectedElement={duplicateSelectedElement}
              generateImagePrompt={generateImagePrompt}
              generateRealImage={generateRealImage}
              insertSymbol={insertSymbol}
              inspectorOpen={inspectorOpen}
              l={l}
              mediaUploading={mediaUploading}
              moveFormField={moveFormField}
              moveSection={moveSection}
              moveSelectedElement={moveSelectedElement}
              pages={pages}
              resetContactForm={resetContactForm}
              resetSelectedElementResponsive={resetSelectedElementResponsive}
              resetSelectedSectionResponsive={resetSelectedSectionResponsive}
              sectionSettingsOpen={sectionSettingsOpen}
              selectedContainer={selectedContainer}
              selectedElement={selectedElement}
              selectedSection={selectedSection}
              setInspectorOpen={setInspectorOpen}
              setMediaOpen={setMediaOpen}
              setSectionSettingsOpen={setSectionSettingsOpen}
              setSelectedSectionLayout={setSelectedSectionLayout}
              symbols={symbols}
              theme={theme}
              updateFormAutomation={updateFormAutomation}
              updateFormField={updateFormField}
              updateSelected={updateSelected}
              updateSelectedContainer={updateSelectedContainer}
              updateSelectedElement={updateSelectedElement}
              updateSelectedSectionResponsive={updateSelectedSectionResponsive}
              uploadMediaFile={uploadMediaFile}
              user={user}
            />
      </div>
    </div>
  );

  const collaborationPanel = (
    <WebsiteCollaborationPanel
      projectId={cloudProjectId}
      canEdit={projectTeamAccess.canEdit}
      canManage={projectTeamAccess.canManage}
      pageId={activePageId}
      pageName={activePage?.name || siteName}
      sectionId={selectedId}
      elementId={selectedElementId}
      darkMode={darkMode}
      onNavigate={(anchor) => {
        const targetPage = getCurrentPages().find((page) => page.id === anchor.pageId);
        if (targetPage && targetPage.id !== activePageId) switchPage(targetPage.id);
        if (!anchor.sectionId || !targetPage) return;
        const targetSection = targetPage.sections.find((section) => section.id === anchor.sectionId);
        if (!targetSection) return;
        const targetElementId = anchor.elementId && targetSection.elements.some((element) => element.id === anchor.elementId)
          ? anchor.elementId
          : null;
        selectEditorTarget(targetSection.id, targetElementId);
        setInspectorOpen(true);
      }}
    />
  );

  if (!editorV2Flags.shell) {
    return <>{legacyBuilder}{collaborationPanel}</>;
  }

  return (
    <>
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
      cmsPanel={v2CmsPanel}
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
        cmsErrors.length ? `Fix ${cmsErrors.length} CMS issue${cmsErrors.length === 1 ? '' : 's'} before publishing.` : '',
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
    {collaborationPanel}
    </>
  );
}
