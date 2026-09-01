import { useLocalizer } from '@/lib/ui-localization';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MousePointer2,
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

import type { Device, ElementAnimation, ElementShadow, SectionBackgroundMode, SectionBackgroundPosition, SectionBackgroundSize, SectionContentWidth, SectionLayout, SectionLayoutAlign, SectionType, WebsiteBrand, WebsiteElement, WebsiteElementContainer, WebsiteElementType, WebsiteFormField, WebsiteFormFieldType, WebsiteSEO, WebsiteSection } from './core/types';
import { ELEMENT_LABELS, SECTION_LABELS, createDefaultContactFormFields, createElement, createSection, defaultBrand, defaultSEO, defaultSections, normalizeSection } from './core/defaults';
import {
  parseEditorV2FeatureFlags,
  resolveEditorV2FeatureFlags,
} from './core/editor-feature-flags';
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
  uploadPublishedWebsiteBlob,
  uploadPublishedWebsiteFolderFiles,
} from './services/publishedWebsiteService';
import { deleteReusableSectionInCloud, listReusableSectionsInCloud, saveReusableSectionInCloud } from './services/reusableSectionService';
import { createWebsitePublishVersion, deleteWebsitePublishVersionArchive, listWebsitePublishVersions } from './services/publishVersionService';
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

const LAUNCH_CENTER_SEEN_KEY = 'tayar.website-builder.launch-center-seen.v1';
const LAUNCH_MANUAL_CHECKS_KEY = 'tayar.website-builder.launch-manual-checks.v1';
const EDITOR_V2_FLAGS_STORAGE_KEY = 'tayar.website-builder.v2.flags';

function resolveWebsiteBuilderV2Flags() {
  if (typeof window === 'undefined') {
    return resolveEditorV2FeatureFlags();
  }

  const params = new URLSearchParams(window.location.search);
  const queryFlag = params.get('builderV2');

  const overrides = parseEditorV2FeatureFlags(
    window.localStorage.getItem(EDITOR_V2_FLAGS_STORAGE_KEY),
  );

  if (queryFlag === '1') {
    overrides.shell = true;
  } else if (queryFlag === '0') {
    overrides.shell = false;
  }

  return resolveEditorV2FeatureFlags(overrides);
}

interface AIWebsitePageGeneration {
  name?: string;
  slug?: string;
  showInNavigation?: boolean;
  sections: Array<Partial<WebsiteSection> & Pick<WebsiteSection, 'type'>>;
}

interface AIWebsiteGeneration {
  siteName?: string;
  summary?: string;
  style?: {
    tone?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  brand?: WebsiteBrand;
  seo?: WebsiteSEO;
  pages?: AIWebsitePageGeneration[];
  sections?: AIWebsitePageGeneration['sections'];
}

interface AIWebsitePatchChanges {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  background?: string;
  accent?: string;
  image?: string;
  imagePrompt?: string;
  name?: string;
  slug?: string;
  showInNavigation?: boolean;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  seoKeywords?: string[];
  headerEnabled?: boolean;
  showCta?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  fontFamily?: string;
  themeContentWidth?: number;
  themeButtonRadius?: number;
  themeSectionSpacing?: number;
  headerSticky?: boolean;
  headerMobileMenu?: boolean;
  headerLanguageSwitcher?: boolean;
  headerBrandText?: string;
  headerLogoUrl?: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  headerActiveColor?: string;
  headerHoverColor?: string;
  headerCtaBackgroundColor?: string;
  headerCtaTextColor?: string;
  headerNavGap?: number;
  headerBrandSize?: number;
  headerNavSize?: number;
  headerBorderColor?: string;
  sectionMinHeight?: number;
  sectionPaddingY?: number;
  sectionPaddingX?: number;
  sectionLayoutGap?: number;
  sectionLayout?: SectionLayout;
  sectionLayoutAlign?: SectionLayoutAlign;
  sectionContentWidth?: SectionContentWidth;
  sectionBackgroundMode?: SectionBackgroundMode;
  sectionBackgroundImage?: string;
  sectionBackgroundPosition?: SectionBackgroundPosition;
  sectionBackgroundSize?: SectionBackgroundSize;
  sectionGradientFrom?: string;
  sectionGradientTo?: string;
  sectionGradientAngle?: number;
  sectionOverlayColor?: string;
  sectionOverlayOpacity?: number;
  sectionRadius?: number;
  sectionAnchorId?: string;
  elementColumn?: number;
  elementColumnSpan?: number;
  elementContent?: string;
  elementHref?: string;
  elementSrc?: string;
  color?: string;
  elementBackgroundColor?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
  borderRadius?: number;
  width?: number;
  maxWidth?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  positionX?: number;
  positionY?: number;
  hidden?: boolean;
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  rotate?: number;
  elementBorderWidth?: number;
  elementBorderColor?: string;
  elementBorderStyle?: 'solid' | 'dashed' | 'dotted';
  elementShadow?: ElementShadow;
  elementHoverScale?: number;
  elementHoverOpacity?: number;
  elementHoverBackgroundColor?: string;
  elementHoverColor?: string;
  elementHoverShadow?: ElementShadow;
  elementAnimation?: ElementAnimation;
  elementAnimationDuration?: number;
  elementAnimationDelay?: number;
  elementAnimationDistance?: number;
  elementAnimationOnce?: boolean;
  containerName?: string;
  containerLayout?: 'stack' | 'row';
  containerGap?: number;
  containerAlign?: 'start' | 'center' | 'end' | 'stretch';
  containerBackgroundColor?: string;
  containerPadding?: number;
  containerBorderRadius?: number;
  containerBorderWidth?: number;
  containerBorderColor?: string;
  containerShadow?: ElementShadow;
  containerColumn?: number;
  containerColumnSpan?: number;
  formSuccessMessage?: string;
  formSuccessAction?: 'message' | 'redirect';
  formRedirectUrl?: string;
  formFieldName?: string;
  formFieldLabel?: string;
  formFieldPlaceholder?: string;
  formFieldRequired?: boolean;
  formFieldOptions?: string[];
}

interface AIWebsitePatchOperation {
  action: 'add_page' | 'duplicate_page' | 'remove_page' | 'set_home_page' | 'move_page' | 'update_section' | 'add_section' | 'duplicate_section' | 'remove_section' | 'move_section' | 'add_container' | 'update_container' | 'remove_container' | 'assign_element_container' | 'create_symbol' | 'insert_symbol' | 'detach_symbol' | 'add_element' | 'duplicate_element' | 'remove_element' | 'move_element' | 'update_element' | 'update_form' | 'add_form_field' | 'update_form_field' | 'remove_form_field' | 'move_form_field' | 'copy_section_style' | 'copy_element_style' | 'repair_responsive' | 'repair_accessibility' | 'update_page' | 'update_theme' | 'restyle_site' | 'update_site' | 'update_seo' | 'update_header' | 'generate_image';
  pageId?: string;
  pageSlug?: string;
  sectionId?: string;
  sectionType?: SectionType;
  elementId?: string;
  elementType?: WebsiteElementType;
  device?: Device;
  beforeElementId?: string;
  afterElementId?: string;
  containerId?: string;
  formFieldId?: string;
  formFieldType?: WebsiteFormFieldType;
  beforeFormFieldId?: string;
  afterFormFieldId?: string;
  symbolId?: string;
  symbolName?: string;
  sourceSectionId?: string;
  sourceElementId?: string;
  beforePageId?: string;
  afterPageId?: string;
  beforeSectionId?: string;
  afterSectionId?: string;
  prompt?: string;
  placement?: 'section_background' | 'section_image' | 'image_element';
  page?: AIWebsitePageGeneration;
  changes?: AIWebsitePatchChanges;
  section?: Partial<WebsiteSection> & Pick<WebsiteSection, 'type'>;
}

interface AIQualityReview {
  score: number;
  summary: string;
  findings: Array<{
    severity: 'critical' | 'warning' | 'improvement';
    title: string;
    detail: string;
  }>;
  fixPrompt: string;
}

interface AIWebsiteAgentPlanStep {
  id: string;
  title: string;
  target?: string;
  reason?: string;
  destructive?: boolean;
}

interface AIWebsiteAgentPlan {
  summary?: string;
  steps?: AIWebsiteAgentPlanStep[];
  warnings?: string[];
}

interface AIWebsiteAgentReviewFinding {
  severity: 'critical' | 'warning' | 'improvement';
  title: string;
  detail: string;
  target?: string;
}

interface AIWebsiteAgentReview {
  score?: number;
  summary?: string;
  findings?: AIWebsiteAgentReviewFinding[];
  followUpPrompt?: string;
}

interface AIWebsitePatch {
  summary?: string;
  warnings?: string[];
  confidence?: number;
  operations?: AIWebsitePatchOperation[];
}

type AIBuilderStage = 'idle' | 'planning' | 'building' | 'styling' | 'ready' | 'error';

interface AIBuilderMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AI_BUILDER_STAGE_ORDER: Array<Exclude<AIBuilderStage, 'idle' | 'error'>> = ['planning', 'building', 'styling', 'ready'];

interface WebsitePage {
  id: string;
  name: string;
  slug: string;
  sections: WebsiteSection[];
  showInNavigation: boolean;
  seoTitle?: string;
  seoDescription?: string;
  socialImage?: string;
  canonicalUrl?: string;
  language?: Language;
  translationKey?: string;
  noIndex?: boolean;
}

interface AIWebsiteUndoSnapshot {
  pages: WebsitePage[];
  activePageId: string;
  homePageId: string;
  siteName: string;
  brand: WebsiteBrand;
  seo: WebsiteSEO;
  theme: WebsiteTheme;
  headerConfig: WebsiteHeaderConfig;
  symbols: WebsiteSymbol[];
}

interface CloudWebsiteProject {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  content: Record<string, unknown>;
  status: string;
  updated_at: string;
}

interface ProjectHistoryEntry {
  id: string;
  savedAt: string;
  label: string;
  snapshot: Record<string, unknown>;
}

type LeadStage = 'new' | 'qualified' | 'contacted' | 'won' | 'lost';

interface WebsiteLead {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  email: string;
  message: string;
  form_data?: Record<string, unknown> | null;
  page_path?: string | null;
  status: 'new' | 'read' | 'archived';
  stage?: LeadStage;
  priority?: number;
  tags?: string[] | null;
  notes?: string | null;
  updated_at?: string | null;
  created_at: string;
}

interface LeadCaptureConfig {
  projectId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface WebsiteAnalyticsEvent {
  id: string;
  project_id: string;
  user_id: string;
  page_path: string;
  referrer: string | null;
  session_id: string;
  event_type?: 'page_view' | 'cta_click' | 'form_submit';
  event_data?: Record<string, unknown> | null;
  created_at: string;
}

interface WebsiteMediaAsset {
  name: string;
  path: string;
  url: string;
  createdAt?: string | null;
}

interface WebsiteTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  fontFamily: string;
  contentWidth: number;
  buttonRadius: number;
  sectionSpacing: number;
}

interface WebsiteHeaderConfig {
  enabled: boolean;
  sticky: boolean;
  mobileMenu: boolean;
  languageSwitcher: boolean;
  brandText: string;
  logoUrl: string;
  showCta: boolean;
  ctaLabel: string;
  ctaHref: string;
  backgroundColor: string;
  textColor: string;
  activeColor: string;
  hoverColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  navGap: number;
  brandSize: number;
  navSize: number;
  borderColor: string;
}

interface WebsiteFooterConfig {
  enabled: boolean;
  text: string;
  showNavigation: boolean;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  xUrl: string;
}

interface WebsiteSiteEnhancements {
  cookieBanner: boolean;
  cookieText: string;
  cookieButtonLabel: string;
  scrollProgress: boolean;
  backToTop: boolean;
  announcementBar: boolean;
  announcementText: string;
  announcementLinkLabel: string;
  announcementHref: string;
  popupEnabled: boolean;
  popupTitle: string;
  popupText: string;
  popupButtonLabel: string;
  popupButtonHref: string;
  popupDelaySeconds: number;
  siteSearch: boolean;
  galleryLightbox: boolean;
  floatingCta: boolean;
  floatingCtaLabel: string;
  floatingCtaHref: string;
  shareButtons: boolean;
}

interface WebsiteProductionConfig {
  customCss: string;
  ga4Id: string;
  gtmId: string;
  metaPixelId: string;
  plausibleDomain: string;
  googleVerification: string;
  bingVerification: string;
  organizationSchema: boolean;
  organizationName: string;
  organizationUrl: string;
  organizationLogo: string;
  localBusinessSchema: boolean;
  localBusinessType: string;
  localBusinessPhone: string;
  localBusinessAddress: string;
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceText: string;
  customRobotsRules: string;
}

interface WebsiteSymbol {
  id: string;
  name: string;
  element: WebsiteElement;
  updatedAt: string;
}

interface PersistedWebsiteProject {
  cloudProjectId?: string | null;
  pages?: Partial<WebsitePage>[];
  sections?: WebsiteSection[];
  language?: Language;
  activePageId?: string;
  homePageId?: string;
  siteName?: string;
  siteUrl?: string;
  faviconUrl?: string;
  publishedUrl?: string;
  publishedAt?: string | null;
  previewUrl?: string;
  previewToken?: string;
  previewCreatedAt?: string | null;
  lastPublishedVersionId?: string | null;
  lastPublishedFingerprint?: string;
  brand?: WebsiteBrand;
  theme?: Partial<WebsiteTheme>;
  headerConfig?: Partial<WebsiteHeaderConfig>;
  footerConfig?: Partial<WebsiteFooterConfig>;
  siteEnhancements?: Partial<WebsiteSiteEnhancements>;
  productionConfig?: Partial<WebsiteProductionConfig>;
  deliveryConfig?: Partial<WebsiteDeliveryConfig>;
  symbols?: unknown[];
  seo?: WebsiteSEO;
  history?: ProjectHistoryEntry[];
}

function isWebsiteSymbol(value: unknown): value is WebsiteSymbol {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WebsiteSymbol>;
  return typeof item.id === 'string' && typeof item.name === 'string' && Boolean(item.element) && typeof item.updatedAt === 'string';
}

interface WebsitePublishVersion {
  id: string;
  project_id: string;
  user_id: string;
  release_note: string;
  published_url: string;
  storage_prefix: string;
  editor_fingerprint: string;
  snapshot: Record<string, unknown>;
  file_manifest: Array<{ name: string; contentType: string }>;
  created_at: string;
}

type LiveVerification = 'idle' | 'checking' | 'healthy' | 'failed';
type BillingPlan = 'free' | 'pro' | 'business';
type BillingFeature = 'publish' | 'exportZip' | 'multilingual' | 'analytics' | 'productionIntegrations' | 'customCss' | 'releaseHistory' | 'clientDelivery' | 'whiteLabel';

interface BillingEntitlements {
  plan: BillingPlan;
  maxPages: number;
  maxWebsiteProjects: number;
  maxReleaseHistory: number;
  maxLeads: number;
  maxAnalyticsEvents: number;
  features: Record<BillingFeature, boolean>;
}

interface BillingSubscriptionSnapshot {
  status: string;
  renewalDate?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

interface BillingUsage {
  websiteProjects: number;
  pages: number;
  releases: number;
  leads: number;
  analyticsEvents: number;
}

interface BillingState {
  plan: BillingPlan;
  entitlements: BillingEntitlements;
  subscription: BillingSubscriptionSnapshot | null;
  usage: BillingUsage;
}

interface ReusableSectionTemplate {
  id: string;
  title: string;
  section: WebsiteSection;
  updatedAt?: string | null;
  cloudId?: string;
}

const REUSABLE_SECTIONS_KEY = 'tayar.website-builder.reusable-sections.v1';
const FONT_OPTIONS = ['Inter', 'Arial', 'Georgia', 'Trebuchet MS', 'Courier New', 'system-ui'];
const DEFAULT_THEME: WebsiteTheme = {
  primaryColor: '#7c3aed',
  secondaryColor: '#0f172a',
  backgroundColor: '#111827',
  textColor: '#ffffff',
  mutedTextColor: '#cbd5e1',
  fontFamily: 'Inter',
  contentWidth: 1100,
  buttonRadius: 12,
  sectionSpacing: 90,
};

const DEFAULT_HEADER_CONFIG: WebsiteHeaderConfig = {
  enabled: true,
  sticky: true,
  mobileMenu: true,
  languageSwitcher: true,
  brandText: '',
  logoUrl: '',
  showCta: false,
  ctaLabel: 'Get Started',
  ctaHref: '#contact',
  backgroundColor: '#0f172a',
  textColor: '#ffffff',
  activeColor: '#ffffff',
  hoverColor: '#c4b5fd',
  ctaBackgroundColor: '#7c3aed',
  ctaTextColor: '#ffffff',
  navGap: 18,
  brandSize: 16,
  navSize: 14,
  borderColor: '#334155',
};

const DEFAULT_FOOTER_CONFIG: WebsiteFooterConfig = {
  enabled: false,
  text: '',
  showNavigation: true,
  instagramUrl: '',
  facebookUrl: '',
  linkedinUrl: '',
  xUrl: '',
};

const DEFAULT_SITE_ENHANCEMENTS: WebsiteSiteEnhancements = {
  cookieBanner: false,
  cookieText: 'We use essential browser storage to improve this website experience.',
  cookieButtonLabel: 'Got it',
  scrollProgress: true,
  backToTop: true,
  announcementBar: false,
  announcementText: 'New: discover our latest update.',
  announcementLinkLabel: 'Learn more',
  announcementHref: '#',
  popupEnabled: false,
  popupTitle: 'Stay in the loop',
  popupText: 'Add a focused offer, newsletter message or important call to action.',
  popupButtonLabel: 'Get Started',
  popupButtonHref: '#contact',
  popupDelaySeconds: 4,
  siteSearch: false,
  galleryLightbox: true,
  floatingCta: false,
  floatingCtaLabel: 'Contact Us',
  floatingCtaHref: '#contact',
  shareButtons: false,
};

const DEFAULT_PRODUCTION_CONFIG: WebsiteProductionConfig = {
  customCss: '',
  ga4Id: '',
  gtmId: '',
  metaPixelId: '',
  plausibleDomain: '',
  googleVerification: '',
  bingVerification: '',
  organizationSchema: false,
  organizationName: '',
  organizationUrl: '',
  organizationLogo: '',
  localBusinessSchema: false,
  localBusinessType: 'LocalBusiness',
  localBusinessPhone: '',
  localBusinessAddress: '',
  maintenanceMode: false,
  maintenanceTitle: 'We’ll be back soon',
  maintenanceText: 'This website is temporarily unavailable while we make improvements.',
  customRobotsRules: '',
};

const FREE_BILLING_ENTITLEMENTS: BillingEntitlements = {
  plan: 'free',
  maxPages: 3,
  maxWebsiteProjects: 1,
  maxReleaseHistory: 3,
  maxLeads: 50,
  maxAnalyticsEvents: 1000,
  features: {
    publish: true,
    exportZip: false,
    multilingual: false,
    analytics: false,
    productionIntegrations: false,
    customCss: false,
    releaseHistory: false,
    clientDelivery: false,
    whiteLabel: false,
  },
};

const PRO_BILLING_ENTITLEMENTS: BillingEntitlements = {
  plan: 'pro',
  maxPages: 25,
  maxWebsiteProjects: 10,
  maxReleaseHistory: 25,
  maxLeads: 10000,
  maxAnalyticsEvents: 100000,
  features: {
    publish: true,
    exportZip: true,
    multilingual: true,
    analytics: true,
    productionIntegrations: true,
    customCss: true,
    releaseHistory: true,
    clientDelivery: false,
    whiteLabel: false,
  },
};

const BUSINESS_BILLING_ENTITLEMENTS: BillingEntitlements = {
  plan: 'business',
  maxPages: 100,
  maxWebsiteProjects: 50,
  maxReleaseHistory: 100,
  maxLeads: 100000,
  maxAnalyticsEvents: 1000000,
  features: {
    publish: true,
    exportZip: true,
    multilingual: true,
    analytics: true,
    productionIntegrations: true,
    customCss: true,
    releaseHistory: true,
    clientDelivery: true,
    whiteLabel: true,
  },
};

const LOCAL_BILLING_ENTITLEMENTS: Record<BillingPlan, BillingEntitlements> = {
  free: FREE_BILLING_ENTITLEMENTS,
  pro: PRO_BILLING_ENTITLEMENTS,
  business: BUSINESS_BILLING_ENTITLEMENTS,
};

const BILLING_PLAN_DETAILS: Record<BillingPlan, { label: string; badge: string; description: string; bullets: string[] }> = {
  free: {
    label: 'Free',
    badge: 'FREE',
    description: 'Build and publish one small website.',
    bullets: ['1 website project', 'Up to 3 pages', 'Publishing included', '50 lead records'],
  },
  pro: {
    label: 'Pro',
    badge: 'PRO',
    description: 'For freelancers and serious websites.',
    bullets: ['10 website projects', 'Up to 25 pages each', 'ZIP export + multilingual', 'Analytics + integrations + release history'],
  },
  business: {
    label: 'Business',
    badge: 'BUSINESS',
    description: 'For agencies, client delivery and white-label work.',
    bullets: ['50 website projects', 'Up to 100 pages each', 'Client delivery workspace', 'White-label handoff + larger limits'],
  },
};

function sanitizeCustomCss(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, 30000).replace(/<\/?style\b[^>]*>/gi, '').replace(/<\//g, '<\\/');
}

function sanitizeRobotsRules(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[<>]/g, '').trimEnd())
    .slice(0, 100)
    .join('\n')
    .slice(0, 5000)
    .trim();
}

function normalizeProductionConfig(value: Partial<WebsiteProductionConfig> | null | undefined): WebsiteProductionConfig {
  const text = (candidate: unknown, max: number) => typeof candidate === 'string' ? candidate.trim().slice(0, max) : '';
  const token = (candidate: unknown, max = 200) => text(candidate, max).replace(/[^A-Za-z0-9._:-]/g, '');
  const ga4 = text(value?.ga4Id, 40).toUpperCase();
  const gtm = text(value?.gtmId, 40).toUpperCase();
  const pixel = text(value?.metaPixelId, 40).replace(/\D/g, '');
  const plausible = text(value?.plausibleDomain, 255).replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return {
    customCss: sanitizeCustomCss(value?.customCss),
    ga4Id: /^G-[A-Z0-9]+$/.test(ga4) ? ga4 : '',
    gtmId: /^GTM-[A-Z0-9]+$/.test(gtm) ? gtm : '',
    metaPixelId: /^\d{5,30}$/.test(pixel) ? pixel : '',
    plausibleDomain: /^[A-Za-z0-9.-]+$/.test(plausible) ? plausible : '',
    googleVerification: token(value?.googleVerification, 300),
    bingVerification: token(value?.bingVerification, 300),
    organizationSchema: value?.organizationSchema === true,
    organizationName: text(value?.organizationName, 160),
    organizationUrl: text(value?.organizationUrl, 1000),
    organizationLogo: text(value?.organizationLogo, 1000),
    localBusinessSchema: value?.localBusinessSchema === true,
    localBusinessType: text(value?.localBusinessType, 80).replace(/[^A-Za-z0-9]/g, '') || 'LocalBusiness',
    localBusinessPhone: text(value?.localBusinessPhone, 80),
    localBusinessAddress: text(value?.localBusinessAddress, 300),
    maintenanceMode: value?.maintenanceMode === true,
    maintenanceTitle: text(value?.maintenanceTitle, 140) || DEFAULT_PRODUCTION_CONFIG.maintenanceTitle,
    maintenanceText: text(value?.maintenanceText, 800) || DEFAULT_PRODUCTION_CONFIG.maintenanceText,
    customRobotsRules: sanitizeRobotsRules(value?.customRobotsRules),
  };
}

function normalizeHeaderConfig(value: Partial<WebsiteHeaderConfig> | null | undefined): WebsiteHeaderConfig {
  return {
    enabled: value?.enabled !== false,
    sticky: value?.sticky !== false,
    mobileMenu: value?.mobileMenu !== false,
    languageSwitcher: value?.languageSwitcher !== false,
    brandText: typeof value?.brandText === 'string' ? value.brandText.slice(0, 80) : '',
    logoUrl: typeof value?.logoUrl === 'string' ? value.logoUrl.trim().slice(0, 1000) : '',
    showCta: value?.showCta === true,
    ctaLabel: typeof value?.ctaLabel === 'string' && value.ctaLabel.trim() ? value.ctaLabel.slice(0, 80) : 'Get Started',
    ctaHref: typeof value?.ctaHref === 'string' && value.ctaHref.trim() ? value.ctaHref.trim().slice(0, 1000) : '#contact',
    backgroundColor: typeof value?.backgroundColor === 'string' ? value.backgroundColor : '#0f172a',
    textColor: typeof value?.textColor === 'string' ? value.textColor : '#ffffff',
    activeColor: typeof value?.activeColor === 'string' ? value.activeColor : '#ffffff',
    hoverColor: typeof value?.hoverColor === 'string' ? value.hoverColor : '#c4b5fd',
    ctaBackgroundColor: typeof value?.ctaBackgroundColor === 'string' ? value.ctaBackgroundColor : '#7c3aed',
    ctaTextColor: typeof value?.ctaTextColor === 'string' ? value.ctaTextColor : '#ffffff',
    navGap: Number.isFinite(Number(value?.navGap)) ? Math.min(48, Math.max(4, Number(value?.navGap))) : 18,
    brandSize: Number.isFinite(Number(value?.brandSize)) ? Math.min(32, Math.max(12, Number(value?.brandSize))) : 16,
    navSize: Number.isFinite(Number(value?.navSize)) ? Math.min(24, Math.max(10, Number(value?.navSize))) : 14,
    borderColor: typeof value?.borderColor === 'string' ? value.borderColor : '#334155',
  };
}

function normalizeFooterConfig(value: Partial<WebsiteFooterConfig> | null | undefined): WebsiteFooterConfig {
  return {
    enabled: value?.enabled === true,
    text: typeof value?.text === 'string' ? value.text.slice(0, 300) : '',
    showNavigation: value?.showNavigation !== false,
    instagramUrl: typeof value?.instagramUrl === 'string' ? value.instagramUrl.trim().slice(0, 1000) : '',
    facebookUrl: typeof value?.facebookUrl === 'string' ? value.facebookUrl.trim().slice(0, 1000) : '',
    linkedinUrl: typeof value?.linkedinUrl === 'string' ? value.linkedinUrl.trim().slice(0, 1000) : '',
    xUrl: typeof value?.xUrl === 'string' ? value.xUrl.trim().slice(0, 1000) : '',
  };
}

function normalizeSiteEnhancements(value: Partial<WebsiteSiteEnhancements> | null | undefined): WebsiteSiteEnhancements {
  const text = (candidate: unknown, fallback: string, max: number) =>
    typeof candidate === 'string' && candidate.trim() ? candidate.trim().slice(0, max) : fallback;
  const href = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && candidate.trim() ? candidate.trim().slice(0, 1000) : fallback;
  return {
    cookieBanner: value?.cookieBanner === true,
    cookieText: text(value?.cookieText, DEFAULT_SITE_ENHANCEMENTS.cookieText, 500),
    cookieButtonLabel: text(value?.cookieButtonLabel, DEFAULT_SITE_ENHANCEMENTS.cookieButtonLabel, 60),
    scrollProgress: value?.scrollProgress !== false,
    backToTop: value?.backToTop !== false,
    announcementBar: value?.announcementBar === true,
    announcementText: text(value?.announcementText, DEFAULT_SITE_ENHANCEMENTS.announcementText, 240),
    announcementLinkLabel: text(value?.announcementLinkLabel, DEFAULT_SITE_ENHANCEMENTS.announcementLinkLabel, 80),
    announcementHref: href(value?.announcementHref, DEFAULT_SITE_ENHANCEMENTS.announcementHref),
    popupEnabled: value?.popupEnabled === true,
    popupTitle: text(value?.popupTitle, DEFAULT_SITE_ENHANCEMENTS.popupTitle, 120),
    popupText: text(value?.popupText, DEFAULT_SITE_ENHANCEMENTS.popupText, 600),
    popupButtonLabel: text(value?.popupButtonLabel, DEFAULT_SITE_ENHANCEMENTS.popupButtonLabel, 80),
    popupButtonHref: href(value?.popupButtonHref, DEFAULT_SITE_ENHANCEMENTS.popupButtonHref),
    popupDelaySeconds: Number.isFinite(Number(value?.popupDelaySeconds)) ? Math.min(60, Math.max(0, Number(value?.popupDelaySeconds))) : DEFAULT_SITE_ENHANCEMENTS.popupDelaySeconds,
    siteSearch: value?.siteSearch === true,
    galleryLightbox: value?.galleryLightbox !== false,
    floatingCta: value?.floatingCta === true,
    floatingCtaLabel: text(value?.floatingCtaLabel, DEFAULT_SITE_ENHANCEMENTS.floatingCtaLabel, 80),
    floatingCtaHref: href(value?.floatingCtaHref, DEFAULT_SITE_ENHANCEMENTS.floatingCtaHref),
    shareButtons: value?.shareButtons === true,
  };
}

function safeSocialUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '#';
}

function normalizeTheme(value: Partial<WebsiteTheme> | null | undefined): WebsiteTheme {
  const color = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
  const number = (candidate: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const fontFamily = typeof value?.fontFamily === 'string' && FONT_OPTIONS.includes(value.fontFamily)
    ? value.fontFamily
    : DEFAULT_THEME.fontFamily;
  return {
    primaryColor: color(value?.primaryColor, DEFAULT_THEME.primaryColor),
    secondaryColor: color(value?.secondaryColor, DEFAULT_THEME.secondaryColor),
    backgroundColor: color(value?.backgroundColor, DEFAULT_THEME.backgroundColor),
    textColor: color(value?.textColor, DEFAULT_THEME.textColor),
    mutedTextColor: color(value?.mutedTextColor, DEFAULT_THEME.mutedTextColor),
    fontFamily,
    contentWidth: number(value?.contentWidth, DEFAULT_THEME.contentWidth, 720, 1440),
    buttonRadius: number(value?.buttonRadius, DEFAULT_THEME.buttonRadius, 0, 40),
    sectionSpacing: number(value?.sectionSpacing, DEFAULT_THEME.sectionSpacing, 40, 140),
  };
}

function sectionColumnCount(layout?: SectionLayout): number {
  if (layout === 'three-column') return 3;
  if (layout === 'two-column') return 2;
  return 1;
}

function sectionLayoutGap(section: WebsiteSection): number {
  const value = Number(section.layoutGap);
  return Number.isFinite(value) ? Math.min(80, Math.max(0, value)) : 20;
}

function sectionLayoutAlign(section: WebsiteSection): SectionLayoutAlign {
  return section.layoutAlign === 'start' || section.layoutAlign === 'end' || section.layoutAlign === 'stretch'
    ? section.layoutAlign
    : 'center';
}

function sectionBackgroundMode(section: WebsiteSection): SectionBackgroundMode {
  return section.backgroundMode === 'gradient' || section.backgroundMode === 'image'
    ? section.backgroundMode
    : 'color';
}

function sectionBackgroundPosition(section: WebsiteSection): SectionBackgroundPosition {
  return ['top', 'bottom', 'left', 'right'].includes(section.backgroundPosition || '')
    ? section.backgroundPosition as SectionBackgroundPosition
    : 'center';
}

function sectionBackgroundSize(section: WebsiteSection): SectionBackgroundSize {
  return section.backgroundSize === 'contain' || section.backgroundSize === 'auto'
    ? section.backgroundSize
    : 'cover';
}

function sectionContentWidth(section: WebsiteSection): SectionContentWidth {
  return section.contentWidth === 'full' ? 'full' : 'boxed';
}

function sectionVisualNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function safeSectionColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function rgbaFromHex(hex: string, opacity: number): string {
  const normalized = safeSectionColor(hex, '#000000').slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, opacity))})`;
}

function safeCssUrl(value: string): string {
  return value.trim().replace(/[\n\r"'<>\\]/g, '');
}

function sectionBackgroundCss(section: WebsiteSection): string {
  const mode = sectionBackgroundMode(section);
  if (mode === 'gradient') {
    const from = safeSectionColor(section.gradientFrom, section.background || '#111827');
    const to = safeSectionColor(section.gradientTo, section.accent || '#7c3aed');
    const angle = sectionVisualNumber(section.gradientAngle, 135, 0, 360);
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }

  if (mode === 'image' && section.backgroundImage?.trim()) {
    const overlayColor = safeSectionColor(section.overlayColor, '#000000');
    const overlayOpacity = sectionVisualNumber(section.overlayOpacity, 0.35, 0, 1);
    const image = safeCssUrl(section.backgroundImage);
    const position = sectionBackgroundPosition(section);
    const size = sectionBackgroundSize(section);
    return `linear-gradient(${rgbaFromHex(overlayColor, overlayOpacity)}, ${rgbaFromHex(overlayColor, overlayOpacity)}), url("${image}") ${position}/${size} no-repeat`;
  }

  return safeSectionColor(section.background, '#111827');
}

function sectionInlineCss(section: WebsiteSection): string {
  const minHeight = sectionVisualNumber(section.minHeight, 0, 0, 1200);
  const radius = sectionVisualNumber(section.sectionRadius, 0, 0, 80);
  const hasPaddingY = Number.isFinite(Number(section.sectionPaddingY));
  const hasPaddingX = Number.isFinite(Number(section.sectionPaddingX));
  const paddingY = sectionVisualNumber(section.sectionPaddingY, 90, 0, 240);
  const paddingX = sectionVisualNumber(section.sectionPaddingX, 24, 0, 160);
  return [
    `background:${sectionBackgroundCss(section)}`,
    `--accent:${safeSectionColor(section.accent, '#7c3aed')}`,
    minHeight ? `min-height:${minHeight}px` : '',
    hasPaddingY ? `padding-top:${paddingY}px;padding-bottom:${paddingY}px` : '',
    hasPaddingX ? `padding-left:${paddingX}px;padding-right:${paddingX}px` : '',
    radius ? `border-radius:${radius}px;overflow:hidden` : '',
  ].filter(Boolean).join(';');
}

function sectionContainerClass(section: WebsiteSection): string {
  return sectionContentWidth(section) === 'full' ? 'container section-container-full' : 'container';
}

function elementColumn(element: WebsiteElement, index: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = Number(element.layoutColumn) || ((index % columnCount) + 1);
  return Math.min(columnCount, Math.max(1, requested));
}

function clampElementNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function elementShadowCss(shadow: ElementShadow | undefined): string {
  if (shadow === 'sm') return '0 4px 12px rgba(0,0,0,.18)';
  if (shadow === 'md') return '0 10px 24px rgba(0,0,0,.24)';
  if (shadow === 'lg') return '0 18px 40px rgba(0,0,0,.3)';
  if (shadow === 'xl') return '0 28px 70px rgba(0,0,0,.38)';
  return 'none';
}

function containerColumn(container: WebsiteElementContainer, fallback: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = Number(container.layoutColumn) || fallback;
  return Math.min(columnCount, Math.max(1, requested));
}

function containerColumnSpan(container: WebsiteElementContainer, column: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = clampElementNumber(container.columnSpan, 1, 1, columnCount);
  return Math.min(requested, Math.max(1, columnCount - column + 1));
}

function containerVisualCss(container: WebsiteElementContainer): string {
  const direction = container.layout === 'row' ? 'row' : 'column';
  const align = container.align === 'start' ? 'flex-start' : container.align === 'end' ? 'flex-end' : container.align === 'stretch' ? 'stretch' : 'center';
  return [
    'display:flex',
    `flex-direction:${direction}`,
    `gap:${clampElementNumber(container.gap, 16, 0, 80)}px`,
    `align-items:${align}`,
    `background:${container.backgroundColor || 'transparent'}`,
    `padding:${clampElementNumber(container.padding, 20, 0, 120)}px`,
    `border-radius:${clampElementNumber(container.borderRadius, 16, 0, 120)}px`,
    `border:${clampElementNumber(container.borderWidth, 1, 0, 16)}px solid ${container.borderColor || 'transparent'}`,
    `box-shadow:${elementShadowCss(container.shadow)}`,
    'width:100%',
    'min-width:0',
  ].join(';');
}

function cloneSymbolElement(element: WebsiteElement): WebsiteElement {
  const cloned = JSON.parse(JSON.stringify(element)) as WebsiteElement;
  delete cloned.containerId;
  delete cloned.symbolId;
  delete cloned.layoutColumn;
  return cloned;
}

function elementVisualCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const width = clampElementNumber(style.width, 0, 0, 100);
  const fontSize = clampElementNumber(style.fontSize, 0, 0, 240);
  const fontWeight = clampElementNumber(style.fontWeight, 0, 0, 1000);
  const padding = clampElementNumber(style.padding, 0, 0, 160);
  const radius = clampElementNumber(style.borderRadius, 0, 0, 160);
  const lineHeight = clampElementNumber(style.lineHeight, 0, 0.7, 4);
  const letterSpacing = clampElementNumber(style.letterSpacing, 0, -10, 30);
  const opacity = clampElementNumber(style.opacity, 1, 0, 1);
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const positionX = clampElementNumber(style.positionX, 0, -4000, 4000);
  const positionY = clampElementNumber(style.positionY, 0, -4000, 4000);
  const borderWidth = clampElementNumber(style.borderWidth, 0, 0, 24);
  const borderStyle = style.borderStyle === 'dashed' || style.borderStyle === 'dotted' ? style.borderStyle : 'solid';
  return [
    `color:${style.color || 'inherit'}${suffix}`,
    `background-color:${style.backgroundColor || 'transparent'}${suffix}`,
    `font-size:${fontSize ? `${fontSize}px` : 'inherit'}${suffix}`,
    `font-weight:${fontWeight || 'inherit'}${suffix}`,
    `text-align:${style.textAlign || 'inherit'}${suffix}`,
    `line-height:${lineHeight || 'normal'}${suffix}`,
    `letter-spacing:${letterSpacing}px${suffix}`,
    `padding:${padding}px${suffix}`,
    `border-radius:${radius}px${suffix}`,
    `border-width:${borderWidth}px${suffix}`,
    `border-style:${borderWidth ? borderStyle : 'none'}${suffix}`,
    `border-color:${style.borderColor || 'transparent'}${suffix}`,
    `box-shadow:${elementShadowCss(style.shadow)}${suffix}`,
    `opacity:${opacity}${suffix}`,
    `transform:translate3d(${positionX}px,${positionY}px,0) rotate(${rotate}deg)${suffix}`,
    `width:${width ? `${width}%` : 'auto'}${suffix}`,
  ].join(';');
}

function elementHoverCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const positionX = clampElementNumber(style.positionX, 0, -4000, 4000);
  const positionY = clampElementNumber(style.positionY, 0, -4000, 4000);
  const scale = clampElementNumber(style.hoverScale, 1, 0.5, 1.6);
  const hoverOpacity = clampElementNumber(style.hoverOpacity, style.opacity ?? 1, 0, 1);
  const rules = [
    `transform:translate3d(${positionX}px,${positionY}px,0) rotate(${rotate}deg) scale(${scale})${suffix}`,
    `opacity:${hoverOpacity}${suffix}`,
  ];
  if (style.hoverBackgroundColor) rules.push(`background-color:${style.hoverBackgroundColor}${suffix}`);
  if (style.hoverColor) rules.push(`color:${style.hoverColor}${suffix}`);
  if (style.hoverShadow) rules.push(`box-shadow:${elementShadowCss(style.hoverShadow)}${suffix}`);
  return rules.join(';');
}

function normalizeElementAnimation(value: unknown): ElementAnimation {
  const allowed: ElementAnimation[] = ['none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in', 'zoom-out'];
  return typeof value === 'string' && allowed.includes(value as ElementAnimation) ? value as ElementAnimation : 'none';
}

function elementAnimationTransform(animation: ElementAnimation, distance: number): string {
  if (animation === 'fade-up') return `translate3d(0,${distance}px,0)`;
  if (animation === 'fade-down') return `translate3d(0,-${distance}px,0)`;
  if (animation === 'fade-left') return `translate3d(${distance}px,0,0)`;
  if (animation === 'fade-right') return `translate3d(-${distance}px,0,0)`;
  if (animation === 'zoom-in') return 'scale(.86)';
  if (animation === 'zoom-out') return 'scale(1.14)';
  return 'none';
}

function elementRevealCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const animation = normalizeElementAnimation(style.animation);
  if (animation === 'none') {
    return `opacity:1${suffix};transform:none${suffix};transition-property:none${suffix}`;
  }
  const duration = clampElementNumber(style.animationDuration, 650, 100, 4000);
  const delay = clampElementNumber(style.animationDelay, 0, 0, 5000);
  const distance = clampElementNumber(style.animationDistance, 36, 0, 300);
  return [
    `opacity:0${suffix}`,
    `transform:${elementAnimationTransform(animation, distance)}${suffix}`,
    `transition-property:opacity,transform${suffix}`,
    `transition-duration:${duration}ms${suffix}`,
    `transition-delay:${delay}ms${suffix}`,
    `transition-timing-function:cubic-bezier(.22,1,.36,1)${suffix}`,
    `will-change:opacity,transform${suffix}`,
  ].join(';');
}

function elementRevealVisibleCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const animation = normalizeElementAnimation(style.animation);
  if (animation === 'none') return `opacity:1${suffix};transform:none${suffix}`;
  return `opacity:1${suffix};transform:none${suffix}`;
}

function buildDesktopElementAnimationCss(sections: WebsiteSection[]): string {
  const rules: string[] = [];
  sections.forEach((section) => {
    (section.elements || []).forEach((element) => {
      const style = effectiveStyle(element, 'desktop');
      const selector = `[data-tayar-element="${cssAttributeValue(element.id)}"]`;
      rules.push(`.tayar-js ${selector}{${elementRevealCss(style)}}`);
      rules.push(`.tayar-js ${selector}.tayar-visible{${elementRevealVisibleCss(style)}}`);
    });
  });
  return rules.join('\n');
}

function elementColumnSpan(style: WebsiteElement['style'], column: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = clampElementNumber(style.columnSpan, 1, 1, columnCount);
  return Math.min(requested, Math.max(1, columnCount - column + 1));
}

function elementSlotCss(style: WebsiteElement['style'], column: number, columnCount: number, important = false): string {
  const suffix = important ? ' !important' : '';
  const span = elementColumnSpan(style, column, columnCount);
  const align = style.alignSelf === 'start' || style.alignSelf === 'center' || style.alignSelf === 'end' || style.alignSelf === 'stretch'
    ? style.alignSelf
    : 'auto';
  const maxWidth = clampElementNumber(style.maxWidth, 0, 0, 2000);
  const marginTop = clampElementNumber(style.marginTop, 0, -200, 400);
  const marginRight = clampElementNumber(style.marginRight, 0, -200, 400);
  const marginBottom = clampElementNumber(style.marginBottom, 0, -200, 400);
  const marginLeft = clampElementNumber(style.marginLeft, 0, -200, 400);
  const order = clampElementNumber(style.order, 0, -50, 50);
  return [
    `display:${style.hidden ? 'none' : 'flex'}${suffix}`,
    `order:${order}${suffix}`,
    `margin:${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px${suffix}`,
    `max-width:${maxWidth ? `${maxWidth}px` : 'none'}${suffix}`,
    `align-self:${align}${suffix}`,
    `justify-self:${align}${suffix}`,
    `grid-column:${columnCount > 1 ? `${column} / span ${span}` : '1 / span 1'}${suffix}`,
  ].join(';');
}

function cssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildDesktopElementHoverCss(sections: WebsiteSection[]): string {
  const rules: string[] = [];
  sections.forEach((section) => {
    (section.elements || []).forEach((element) => {
      const selector = `[data-tayar-element="${cssAttributeValue(element.id)}"]>.tayar-element:hover`;
      rules.push(`${selector}{${elementHoverCss(effectiveStyle(element, 'desktop'))}}`);
    });
  });
  return rules.join('\n');
}

function buildResponsiveSectionCss(sections: WebsiteSection[]): string {
  const buildRules = (device: Device) => {
    const rules: string[] = [];
    sections.forEach((section) => {
      const style = section.responsive?.[device];
      if (!style) return;
      const selector = `[data-tayar-section-id="${cssAttributeValue(section.id)}"]`;
      const sectionRules: string[] = [];
      const minHeight = Number(style.minHeight);
      const paddingY = Number(style.sectionPaddingY);
      const paddingX = Number(style.sectionPaddingX);
      const layoutGap = Number(style.layoutGap);

      if (Number.isFinite(minHeight)) sectionRules.push(`min-height:${Math.min(1200, Math.max(0, minHeight))}px!important`);
      if (Number.isFinite(paddingY)) {
        const safe = Math.min(240, Math.max(0, paddingY));
        sectionRules.push(`padding-top:${safe}px!important`, `padding-bottom:${safe}px!important`);
      }
      if (Number.isFinite(paddingX)) {
        const safe = Math.min(160, Math.max(0, paddingX));
        sectionRules.push(`padding-left:${safe}px!important`, `padding-right:${safe}px!important`);
      }
      if (sectionRules.length) rules.push(`${selector}{${sectionRules.join(';')}}`);
      if (Number.isFinite(layoutGap)) {
        const safe = Math.min(80, Math.max(0, layoutGap));
        rules.push(`${selector} .element-stack,${selector} .section-layout{gap:${safe}px!important}`);
      }
    });
    return rules.join('\n');
  };

  return `@media(max-width:900px){\n${buildRules('tablet')}\n}\n@media(max-width:700px){\n${buildRules('mobile')}\n}`;
}

function buildResponsiveElementCss(sections: WebsiteSection[]): string {
  const buildRules = (device: Device) => {
    const rules: string[] = [];
    sections.forEach((section) => {
      const configuredColumns = sectionColumnCount(section.layout);
      const columns = device === 'mobile' ? 1 : device === 'tablet' && configuredColumns === 3 ? 2 : configuredColumns;
      (section.elements || []).forEach((element, index) => {
        const column = columns === 1 ? 1 : Math.min(columns, elementColumn(element, index, configuredColumns));
        const style = effectiveStyle(element, device);
        const selector = `[data-tayar-element="${cssAttributeValue(element.id)}"]`;
        rules.push(`${selector}{${elementSlotCss(style, column, columns, true)}}`);
        rules.push(`.tayar-js ${selector}{${elementRevealCss(style, true)}}`);
        rules.push(`.tayar-js ${selector}.tayar-visible{${elementRevealVisibleCss(style, true)}}`);
        rules.push(`${selector}>.tayar-element{${elementVisualCss(style, true)}}`);
        rules.push(`${selector}>.tayar-element:hover{${elementHoverCss(style, true)}}`);
      });
    });
    return rules.join('\n');
  };

  return `@media(max-width:900px){\n${buildRules('tablet')}\n}\n@media(max-width:700px){\n${buildRules('mobile')}\n}`;
}

function sectionElementsToHtml(section: WebsiteSection, homeSlug: string, excludeButton = false): string {
  const elements = (section.elements || []).filter((element) => !excludeButton || element.type !== 'button');
  const columns = sectionColumnCount(section.layout);
  const gap = sectionLayoutGap(section);
  const align = sectionLayoutAlign(section);
  const containerClass = columns === 1 ? 'element-stack' : 'section-layout';
  const containerAttrs = columns === 1
    ? `style="gap:${gap}px;align-items:${align};--layout-align:${align}"`
    : `data-cols="${columns}" style="--layout-cols:${columns};--layout-gap:${gap}px;--layout-align:${align}"`;
  const containers = (section.containers || []).filter((container) => elements.some((element) => element.containerId === container.id));
  const renderedContainers = new Set<string>();
  const items: string[] = [];

  elements.forEach((element, index) => {
    const container = element.containerId ? containers.find((item) => item.id === element.containerId) : undefined;
    if (container) {
      if (renderedContainers.has(container.id)) return;
      renderedContainers.add(container.id);
      const members = elements.filter((item) => item.containerId === container.id);
      const fallbackColumn = elementColumn(element, index, columns);
      const column = containerColumn(container, fallbackColumn, columns);
      const span = containerColumnSpan(container, column, columns);
      const children = members.map((member) => {
        const style = effectiveStyle(member, 'desktop');
        return `<div class="container-element-item" data-tayar-element="${escapeHtml(member.id)}" data-tayar-animated data-tayar-animation-once="${member.animationOnce === false ? 'false' : 'true'}" style="${elementSlotCss(style, 1, 1)}">${elementToHtml(member, homeSlug, 'desktop')}</div>`;
      }).join('\n');
      items.push(`<div class="layout-item container-slot" data-column="${column}" data-tayar-container="${escapeHtml(container.id)}" style="grid-column:${columns > 1 ? `${column} / span ${span}` : '1 / span 1'}"><div class="tayar-container" style="${containerVisualCss(container)}">${children}</div></div>`);
      return;
    }

    const column = elementColumn(element, index, columns);
    const style = effectiveStyle(element, 'desktop');
    items.push(`<div class="layout-item" data-tayar-element="${escapeHtml(element.id)}" data-tayar-animated data-tayar-animation-once="${element.animationOnce === false ? 'false' : 'true'}" data-column="${column}" style="${elementSlotCss(style, column, columns)}">${elementToHtml(element, homeSlug, 'desktop')}</div>`);
  });

  return `<div class="${containerClass}" ${containerAttrs}>${items.join('\n')}</div>`;
}

function cloneSectionWithFreshIds(source: WebsiteSection): WebsiteSection {
  const cloned = JSON.parse(JSON.stringify(source)) as WebsiteSection;
  const containerIdMap = new Map<string, string>();
  const containers = (cloned.containers || []).map((container) => {
    const id = `container-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    containerIdMap.set(container.id, id);
    return { ...container, id };
  });
  return {
    ...cloned,
    id: `${cloned.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    containers,
    elements: (cloned.elements || []).map((element) => ({
      ...element,
      id: `${element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      containerId: element.containerId ? containerIdMap.get(element.containerId) : undefined,
    })),
    formFields: cloned.formFields?.map((field) => ({
      ...field,
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      options: field.options ? [...field.options] : undefined,
    })),
  };
}

function createPage(name = 'New Page', slug = 'page'): WebsitePage {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    slug,
    sections: [createSection('hero'), createSection('contact')],
    showInNavigation: true,
    seoTitle: '',
    seoDescription: '',
    socialImage: '',
    canonicalUrl: '',
    language: 'en',
    translationKey: '',
    noIndex: false,
  };
}

interface PageTemplateDefinition {
  id: string;
  name: string;
  description: string;
  sectionTypes: SectionType[];
  heroTitle: string;
  heroText: string;
  heroButton: string;
}

interface SectionTemplateDefinition {
  id: string;
  name: string;
  description: string;
  type: SectionType;
  title: string;
  text: string;
  buttonText?: string;
}

const PAGE_TEMPLATES: PageTemplateDefinition[] = [
  { id: 'business', name: 'Business', description: 'Professional company page with services and trust sections.', sectionTypes: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], heroTitle: 'Build a Business Customers Trust', heroText: 'Present your company, services and proof in a clear professional website built to generate enquiries.', heroButton: 'Work With Us' },
  { id: 'landing', name: 'Landing Page', description: 'Conversion-focused page for a product, offer or campaign.', sectionTypes: ['hero', 'features', 'pricing', 'testimonials', 'contact', 'footer'], heroTitle: 'One Offer. One Clear Next Step.', heroText: 'Turn campaign traffic into action with a focused landing page built around your strongest offer.', heroButton: 'Get Started' },
  { id: 'portfolio', name: 'Portfolio', description: 'Personal or studio page focused on work, credibility and contact.', sectionTypes: ['hero', 'about', 'features', 'testimonials', 'contact', 'footer'], heroTitle: 'Work That Speaks for Itself', heroText: 'Show your best projects, explain your approach and give future clients an easy way to reach you.', heroButton: 'View My Work' },
  { id: 'ecommerce', name: 'E-commerce', description: 'Storefront-style page for products, offers and customer trust.', sectionTypes: ['hero', 'features', 'services', 'testimonials', 'pricing', 'contact', 'footer'], heroTitle: 'Products Worth Coming Back For', heroText: 'Introduce your collection, highlight what makes it different and guide shoppers toward your best offers.', heroButton: 'Shop Now' },
  { id: 'restaurant', name: 'Restaurant', description: 'Restaurant page for menu highlights, story, reviews and reservations.', sectionTypes: ['hero', 'about', 'services', 'testimonials', 'contact', 'footer'], heroTitle: 'A Table Worth Booking', heroText: 'Showcase your food, atmosphere and story while making it easy for guests to plan their next visit.', heroButton: 'Book a Table' },
  { id: 'saas', name: 'SaaS / Software', description: 'Software product page with features, plans and social proof.', sectionTypes: ['hero', 'features', 'pricing', 'testimonials', 'about', 'contact', 'footer'], heroTitle: 'Software That Makes Work Simpler', heroText: 'Explain the product fast, demonstrate the value and give teams a clear path from interest to signup.', heroButton: 'Start Free' },
  { id: 'agency', name: 'Agency', description: 'Creative or digital agency page built around services and results.', sectionTypes: ['hero', 'services', 'features', 'testimonials', 'about', 'contact', 'footer'], heroTitle: 'Ideas Turned Into Measurable Growth', heroText: 'Position your agency, showcase capabilities and make your strongest results impossible to miss.', heroButton: 'Start a Project' },
  { id: 'real-estate', name: 'Real Estate', description: 'Property-focused page for listings, expertise and lead generation.', sectionTypes: ['hero', 'features', 'services', 'about', 'testimonials', 'contact', 'footer'], heroTitle: 'Find the Right Place to Call Home', heroText: 'Present featured properties, local expertise and a direct path for buyers and sellers to contact you.', heroButton: 'Explore Properties' },
  { id: 'personal-cv', name: 'Personal / CV', description: 'Professional personal site for experience, skills and opportunities.', sectionTypes: ['hero', 'about', 'features', 'testimonials', 'contact', 'footer'], heroTitle: 'Experience, Skills and Work in One Place', heroText: 'Create a professional home for your background, strengths and the work you want to be known for.', heroButton: 'Contact Me' },
  { id: 'local-services', name: 'Local Services', description: 'Lead-focused page for trades, repair, cleaning and local professionals.', sectionTypes: ['hero', 'services', 'features', 'testimonials', 'contact', 'footer'], heroTitle: 'Reliable Local Service When You Need It', heroText: 'Explain what you do, where you work and why local customers should choose you for the job.', heroButton: 'Request a Quote' },
  { id: 'event', name: 'Event', description: 'Event or conference page for agenda, value and registration.', sectionTypes: ['hero', 'features', 'about', 'pricing', 'testimonials', 'contact', 'footer'], heroTitle: 'The Event People Will Talk About', heroText: 'Build excitement, communicate the agenda and turn interested visitors into registered attendees.', heroButton: 'Register Now' },
  { id: 'fitness', name: 'Fitness / Coach', description: 'Coach, gym or trainer page for programs, proof and enquiries.', sectionTypes: ['hero', 'services', 'features', 'pricing', 'testimonials', 'contact', 'footer'], heroTitle: 'Train With a Plan That Moves You Forward', heroText: 'Present your coaching, programs and client results with a clear path to join or book a consultation.', heroButton: 'Start Training' },
];

const SECTION_TEMPLATES: SectionTemplateDefinition[] = [
  { id: 'hero-launch', name: 'Launch Hero', description: 'Strong opening section for a product or service launch.', type: 'hero', title: 'Launch Your Next Big Idea', text: 'Turn visitors into customers with a clear offer, a strong message and one focused action.', buttonText: 'Get Started' },
  { id: 'services-pro', name: 'Services Showcase', description: 'Professional services section for agencies and local businesses.', type: 'services', title: 'Services Built Around Your Goals', text: 'Show customers exactly how you can help them and why your approach is different.', buttonText: 'View Services' },
  { id: 'proof', name: 'Social Proof', description: 'Trust-building testimonial section.', type: 'testimonials', title: 'Trusted by Customers', text: 'Highlight real customer experiences and make your offer easier to trust.', buttonText: 'See More' },
  { id: 'cta-contact', name: 'Contact CTA', description: 'Focused contact section for turning interest into leads.', type: 'contact', title: 'Ready to Start?', text: 'Make the next step easy. Tell us what you need and we will get back to you.', buttonText: 'Contact Us' },
];

function createSectionFromTemplate(template: SectionTemplateDefinition): WebsiteSection {
  const section = createSection(template.type);
  const elements = section.elements.map((element) => {
    if (element.type === 'heading') return { ...element, content: template.title };
    if (element.type === 'text') return { ...element, content: template.text };
    if (element.type === 'button' && template.buttonText) return { ...element, content: template.buttonText };
    return element;
  });
  return {
    ...section,
    title: template.title,
    description: template.text,
    buttonText: template.buttonText ?? section.buttonText,
    elements,
  };
}

function normalizeAnchorId(value: string, fallback = 'section'): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function sectionDomId(section: WebsiteSection): string {
  return normalizeAnchorId(section.anchorId || section.type, section.type);
}

function videoSource(value: string): { kind: 'iframe' | 'video'; src: string } | null {
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  const youtube = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (youtube) return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: 'video', src: raw };
}

function resolveBuilderHref(value: string, homeSlug = 'home'): string {
  if (!value.startsWith('page:')) return value || '#';
  const slug = normalizeSlug(value.slice(5));
  return slug === normalizeSlug(homeSlug) ? 'index.html' : `${slug}.html`;
}

function safeFormRedirectHref(value: string, homeSlug = 'home'): string {
  const resolved = resolveBuilderHref(value || '', homeSlug).trim();
  if (!resolved || resolved === '#') return '';
  if (/^(?:https?:\/\/|\/|\.\.?\/|#)/i.test(resolved)) return resolved;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(resolved)) return resolved;
  return '';
}

function pageHref(page: WebsitePage, homePageId: string): string {
  return page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function normalizeFormFieldName(value: string, fallback = 'field'): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function formFieldToHtml(field: WebsiteFormField): string {
  const name = escapeHtml(normalizeFormFieldName(field.name, 'field'));
  const label = escapeHtml(field.label || field.name || 'Field');
  const placeholder = escapeHtml(field.placeholder || '');
  const required = field.required ? ' required' : '';

  if (field.type === 'checkbox') {
    return `<label class="form-checkbox"><input name="${name}" type="checkbox"${required}><span>${label}</span></label>`;
  }

  if (field.type === 'textarea') {
    return `<label class="form-field"><span>${label}${field.required ? ' *' : ''}</span><textarea name="${name}" placeholder="${placeholder}" maxlength="4000"${required}></textarea></label>`;
  }

  if (field.type === 'select') {
    const options = (field.options || []).filter(Boolean).map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
    return `<label class="form-field"><span>${label}${field.required ? ' *' : ''}</span><select name="${name}"${required}><option value="">${placeholder || 'Choose an option'}</option>${options}</select></label>`;
  }

  const inputType = field.type === 'email' || field.type === 'tel' ? field.type : 'text';
  const autocomplete = field.type === 'email' ? ' autocomplete="email"' : field.type === 'tel' ? ' autocomplete="tel"' : '';
  return `<label class="form-field"><span>${label}${field.required ? ' *' : ''}</span><input name="${name}" type="${inputType}" placeholder="${placeholder}" maxlength="300"${autocomplete}${required}></label>`;
}

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

function downloadTextFile(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
    centralSize += centralHeader.length;
  });

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function parseRichRows(value: string): Array<{ title: string; body: string }> {
  return (value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separator = line.indexOf('|');
      if (separator < 0) return { title: `Item ${index + 1}`, body: line };
      return {
        title: line.slice(0, separator).trim() || `Item ${index + 1}`,
        body: line.slice(separator + 1).trim(),
      };
    });
}

function safeEmbedUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function sanitizeCustomHtml(value: string): string {
  return (value || '')
    .replace(/<\s*(script|object|embed|base|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|object|embed|base|meta|link)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

function elementToHtml(element: WebsiteElement, homeSlug: string, device: Device = 'desktop'): string {
  const style = effectiveStyle(element, device);
  const css = elementVisualCss(style);
  const value = escapeHtml(element.content || '');
  if (element.type === 'heading') return `<h2 class="tayar-element" style="${css}">${value}</h2>`;
  if (element.type === 'text') return `<p class="lead tayar-element" style="${css}">${value}</p>`;
  if (element.type === 'button') return `<a class="btn tayar-element" href="${escapeHtml(resolveBuilderHref(element.href || '#', homeSlug))}" style="${css}">${value}</a>`;
  if (element.type === 'list') {
    const items = (element.content || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return `<ul class="builder-list tayar-element" style="${css}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  if (element.type === 'divider') return `<hr class="builder-divider tayar-element" style="${css}">`;
  if (element.type === 'spacer') {
    const height = Math.max(8, Math.min(320, (clampElementNumber(style.padding, 24, 0, 160) || 24) * 2));
    return `<div class="builder-spacer tayar-element" aria-hidden="true" style="${css};height:${height}px"></div>`;
  }
  if (element.type === 'video') {
    const source = videoSource(element.src || '');
    if (!source) return `<div class="builder-video-placeholder tayar-element" style="${css}">Add a YouTube, Vimeo or direct video URL</div>`;
    if (source.kind === 'iframe') return `<div class="builder-video tayar-element" style="${css}"><iframe src="${escapeHtml(source.src)}" title="${value || 'Video'}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    return `<video class="builder-video-file tayar-element" src="${escapeHtml(source.src)}" controls preload="metadata" style="${css}"></video>`;
  }
  if (element.type === 'accordion') {
    const rows = parseRichRows(element.content);
    return `<div class="builder-accordion tayar-element" style="${css}">${rows.map((row, index) => `<details${index === 0 ? ' open' : ''}><summary>${escapeHtml(row.title)}</summary><div>${escapeHtml(row.body)}</div></details>`).join('')}</div>`;
  }
  if (element.type === 'tabs') {
    const rows = parseRichRows(element.content);
    const safeId = element.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    const inputs = rows.map((row, index) => `<input class="tayar-tab-input" type="radio" name="tabs-${safeId}" id="tabs-${safeId}-${index}"${index === 0 ? ' checked' : ''}>`).join('');
    const labels = rows.map((row, index) => `<label for="tabs-${safeId}-${index}">${escapeHtml(row.title)}</label>`).join('');
    const panels = rows.map((row, index) => `<div class="tayar-tab-panel" data-tab-panel="${index}">${escapeHtml(row.body)}</div>`).join('');
    const selectors = rows.map((_, index) => `#tabs-${safeId}-${index}:checked ~ .tayar-tab-panels [data-tab-panel="${index}"]{display:block}`).join('');
    return `<div class="builder-tabs tayar-element" style="${css}"><style>${selectors}</style>${inputs}<div class="tayar-tab-labels">${labels}</div><div class="tayar-tab-panels">${panels}</div></div>`;
  }
  if (element.type === 'gallery') {
    const images = (element.content || '').split(/\r?\n/).map((item) => safeEmbedUrl(item)).filter(Boolean);
    return `<div class="builder-gallery tayar-element" style="${css}">${images.map((src, index) => `<img src="${escapeHtml(src)}" alt="Gallery image ${index + 1}" loading="lazy">`).join('')}</div>`;
  }
  if (element.type === 'embed') {
    const source = safeEmbedUrl(element.src || '');
    if (!source) return `<div class="builder-embed-placeholder tayar-element" style="${css}">Add a map or embed URL</div>`;
    return `<div class="builder-embed tayar-element" style="${css}"><iframe src="${escapeHtml(source)}" title="${value || 'Embedded content'}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`;
  }
  if (element.type === 'countdown') {
    const [rawTarget, ...labelParts] = (element.content || '').split('|');
    const target = rawTarget.trim();
    const label = labelParts.join('|').trim() || 'Countdown';
    return `<div class="builder-countdown tayar-element" data-tayar-countdown data-target="${escapeHtml(target)}" style="${css}"><p class="countdown-label">${escapeHtml(label)}</p><div class="countdown-grid"><span><strong data-unit="days">00</strong><small>Days</small></span><span><strong data-unit="hours">00</strong><small>Hours</small></span><span><strong data-unit="minutes">00</strong><small>Minutes</small></span><span><strong data-unit="seconds">00</strong><small>Seconds</small></span></div></div>`;
  }
  if (element.type === 'stats') {
    const rows = parseRichRows(element.content);
    return `<div class="builder-stats tayar-element" style="${css}">${rows.map((row) => `<div class="stat-card"><strong data-tayar-counter data-target="${escapeHtml(row.title)}">0</strong><span>${escapeHtml(row.body)}</span></div>`).join('')}</div>`;
  }
  if (element.type === 'testimonials-slider') {
    const rows = parseRichRows(element.content);
    return `<div class="builder-testimonials tayar-element" data-tayar-testimonials style="${css}"><div class="testimonial-track">${rows.map((row, index) => `<article class="testimonial-slide${index === 0 ? ' active' : ''}" data-slide="${index}"><p>“${escapeHtml(row.body)}”</p><strong>— ${escapeHtml(row.title)}</strong></article>`).join('')}</div><div class="testimonial-controls"><button type="button" data-testimonial-prev aria-label="Previous testimonial">←</button><span data-testimonial-position>1 / ${Math.max(rows.length, 1)}</span><button type="button" data-testimonial-next aria-label="Next testimonial">→</button></div></div>`;
  }
  if (element.type === 'code') {
    return `<div class="builder-custom-html tayar-element" style="${css}">${sanitizeCustomHtml(element.content)}</div>`;
  }
  if (element.type === 'image' && element.src) return `<img class="builder-image tayar-element" src="${escapeHtml(element.src)}" alt="${value}" loading="lazy" decoding="async" style="${css}">`;
  return '';
}

function sectionToHtml(section: WebsiteSection, homeSlug: string, leadCapture?: LeadCaptureConfig): string {
  const sectionId = escapeHtml(sectionDomId(section));
  if (section.type === 'contact') {
    const submitElement = (section.elements || []).find((element) => element.type === 'button');
    const submitLabel = escapeHtml(submitElement?.content || section.buttonText || 'Send Message');
    const enabled = Boolean(leadCapture?.projectId && leadCapture?.supabaseUrl && leadCapture?.supabaseAnonKey);
    const setupMessage = enabled ? '' : 'Lead capture is disabled in previews and activates on a published cloud website.';
    const submitButton = submitElement
      ? (() => {
          const submitStyle = effectiveStyle(submitElement, 'desktop');
          return `<div class="layout-item" data-tayar-element="${escapeHtml(submitElement.id)}" data-tayar-animated data-tayar-animation-once="${submitElement.animationOnce === false ? 'false' : 'true'}" data-column="1" style="${elementSlotCss(submitStyle, 1, 1)}"><button class="btn tayar-element" type="submit" style="${elementVisualCss(submitStyle)}"${enabled ? '' : ' disabled'}>${submitLabel}</button></div>`;
        })()
      : `<button class="btn" type="submit"${enabled ? '' : ' disabled'}>${submitLabel}</button>`;

    return `
<section id="${sectionId}" data-tayar-section-id="${escapeHtml(section.id)}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    ${sectionElementsToHtml(section, homeSlug, true)}
    <form class="contact-box" data-tayar-lead-form data-success-message="${escapeHtml(section.formSuccessMessage || 'Thanks! Your message has been sent.')}" data-success-action="${section.formSuccessAction === 'redirect' ? 'redirect' : 'message'}" data-redirect-url="${escapeHtml(section.formRedirectUrl ? safeFormRedirectHref(section.formRedirectUrl, homeSlug) : '')}">
      <label class="tayar-honeypot" aria-hidden="true">Company<input name="_tayar_company" type="text" tabindex="-1" autocomplete="off"></label>
      ${(section.formFields ?? createDefaultContactFormFields()).map(formFieldToHtml).join('\n      ')}
      ${submitButton}
      <p class="form-status" data-form-status aria-live="polite">${escapeHtml(setupMessage)}</p>
    </form>
  </div>
</section>`;
  }

  if (section.elements?.length) {
    return `\n<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">\n  <div class="${sectionContainerClass(section)}">${sectionElementsToHtml(section, homeSlug)}</div>\n</section>`;
  }
  const title = escapeHtml(section.title);
  const description = escapeHtml(section.description);
  const button = section.buttonText
    ? `<a class="btn" href="${escapeHtml(section.buttonUrl || '#')}">${escapeHtml(section.buttonText)}</a>`
    : '';

  if (section.type === 'footer') {
    return `
<footer id="${sectionId}" data-tayar-section-id="${escapeHtml(section.id)}" class="section footer" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
</footer>`;
  }

  if (section.type === 'features') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">FEATURES</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><div class="icon">01</div><h3>Fast</h3><p>Built for speed and a smooth user experience.</p></article>
      <article class="card"><div class="icon">02</div><h3>Powerful</h3><p>Flexible tools that help your business grow.</p></article>
      <article class="card"><div class="icon">03</div><h3>Easy</h3><p>Simple experiences your customers understand.</p></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'services') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">SERVICES</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><h3>Consulting</h3><p>Professional guidance tailored to your goals.</p></article>
      <article class="card"><h3>Development</h3><p>Modern digital solutions built for your business.</p></article>
      <article class="card"><h3>Support</h3><p>Reliable help when you need it most.</p></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'pricing') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">PRICING</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="pricing">
      <article class="price"><h3>Starter</h3><strong>$9</strong><p>For getting started.</p><a class="btn secondary" href="${escapeHtml(section.buttonUrl || '#')}">Choose</a></article>
      <article class="price featured"><h3>Pro</h3><strong>$29</strong><p>For growing businesses.</p><a class="btn" href="${escapeHtml(section.buttonUrl || '#')}">Choose</a></article>
      <article class="price"><h3>Business</h3><strong>$79</strong><p>For advanced needs.</p><a class="btn secondary" href="${escapeHtml(section.buttonUrl || '#')}">Choose</a></article>
    </div>
  </div>
</section>`;
  }

  if (section.type === 'testimonials') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">TESTIMONIALS</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><p>“Amazing experience and excellent results.”</p><strong>— Alex</strong></article>
      <article class="card"><p>“Professional, simple and exactly what we needed.”</p><strong>— Sarah</strong></article>
      <article class="card"><p>“The easiest way to present our business online.”</p><strong>— Daniel</strong></article>
    </div>
    ${button}
  </div>
</section>`;
  }


  if (section.type === 'about') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)} split">
    <div>
      <span class="eyebrow">ABOUT</span>
      <h2>${title}</h2>
      <p class="lead">${description}</p>
      ${button}
    </div>
    <div class="visual" style="border-color:${section.accent}55">
      <span style="background:${section.accent}">ABOUT</span>
    </div>
  </div>
</section>`;
  }

  return `
<section id="${sectionId}" class="section hero" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">YOUR BRAND</span>
    <h1>${title}</h1>
    <p class="lead">${description}</p>
    ${button}
  </div>
</section>`;
}

function buildFullHtml(
  sections: WebsiteSection[],
  options: {
    language: Language;
    title: string;
    description: string;
    pages: WebsitePage[];
    homePageId: string;
    currentPageId: string;
    siteName: string;
    keywords?: string[];
    canonicalUrl?: string;
    faviconUrl?: string;
    socialImageUrl?: string;
    noIndex?: boolean;
    alternateLinks?: Array<{ language: Language; href: string; isDefault?: boolean }>;
    theme?: WebsiteTheme;
    headerConfig?: WebsiteHeaderConfig;
    footerConfig?: WebsiteFooterConfig;
    siteEnhancements?: WebsiteSiteEnhancements;
    productionConfig?: WebsiteProductionConfig;
    leadProjectId?: string | null;
    analyticsProjectId?: string | null;
    analyticsEnabled?: boolean;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }
): string {
  const theme = normalizeTheme(options.theme);
  const desktopElementHoverCss = buildDesktopElementHoverCss(sections);
  const desktopElementAnimationCss = buildDesktopElementAnimationCss(sections);
  const responsiveSectionCss = buildResponsiveSectionCss(sections);
  const responsiveElementCss = buildResponsiveElementCss(sections);
  const headerConfig = normalizeHeaderConfig(options.headerConfig);
  const footerConfig = normalizeFooterConfig(options.footerConfig);
  const siteEnhancements = normalizeSiteEnhancements(options.siteEnhancements);
  const productionConfig = normalizeProductionConfig(options.productionConfig);
  const homePage = options.pages.find((page) => page.id === options.homePageId) || options.pages[0];
  const homeSlug = homePage?.slug || 'home';
  const leadCapture: LeadCaptureConfig | undefined = options.leadProjectId && options.supabaseUrl && options.supabaseAnonKey
    ? {
        projectId: options.leadProjectId,
        supabaseUrl: options.supabaseUrl,
        supabaseAnonKey: options.supabaseAnonKey,
      }
    : undefined;
  const body = sections.map((section) => sectionToHtml(section, homeSlug, leadCapture)).join('\n');
  const faqItems = sections.flatMap((section) => (section.elements || []).filter((element) => element.type === 'accordion').flatMap((element) => parseRichRows(element.content))).slice(0, 50);
  const faqSchema = faqItems.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.title, acceptedAnswer: { '@type': 'Answer', text: item.body } })) }).replace(/</g, '\\u003c')}</script>` : '';
  const direction = options.language === 'ar' ? 'rtl' : 'ltr';
  const navigationPages = options.pages.filter((page) =>
    page.showInNavigation !== false && normalizePageLanguage(page.language, options.language) === options.language
  );
  const currentPage = options.pages.find((page) => page.id === options.currentPageId);
  const translationKey = currentPage?.translationKey?.trim();
  const translationPages = translationKey
    ? options.pages.filter((page) => page.translationKey?.trim() === translationKey)
    : [];
  const brandLabel = headerConfig.brandText.trim() || options.siteName;
  const headerLogo = headerConfig.logoUrl
    ? `<img class="site-logo" src="${escapeHtml(headerConfig.logoUrl)}" alt="${escapeHtml(brandLabel)}">`
    : '';
  const headerCta = headerConfig.showCta
    ? `<a class="site-cta" href="${escapeHtml(resolveBuilderHref(headerConfig.ctaHref, homeSlug))}">${escapeHtml(headerConfig.ctaLabel)}</a>`
    : '';
  const searchTrigger = siteEnhancements.siteSearch
    ? '<button class="site-search-trigger" type="button" data-site-search-open aria-label="Search website">⌕ <span>Search</span></button>'
    : '';
  const languageSwitcher = headerConfig.languageSwitcher && translationPages.length > 1
    ? `<div class="site-language-switcher" aria-label="Language">${translationPages.map((page) => {
        const lang = normalizePageLanguage(page.language, options.language);
        return `<a href="${escapeHtml(pageHref(page, options.homePageId))}" hreflang="${lang}"${page.id === options.currentPageId ? ' class="active"' : ''}>${escapeHtml(languageCodeLabel(lang))}</a>`;
      }).join('')}</div>`
    : '';
  const navigation = headerConfig.enabled
    ? `<nav class="site-nav${headerConfig.sticky ? ' sticky' : ''}${headerConfig.mobileMenu ? ' mobile-menu' : ''}" data-tayar-mobile-nav><a class="site-brand" href="${escapeHtml(pageHref(homePage, options.homePageId))}"><span class="site-brand-wrap">${headerLogo}<span>${escapeHtml(brandLabel)}</span></span></a>${headerConfig.mobileMenu ? '<button class="site-menu-toggle" type="button" aria-expanded="false" aria-label="Toggle navigation"><span aria-hidden="true">☰</span><span>Menu</span></button>' : ''}<div class="site-links">${navigationPages.map((page) => `<a href="${escapeHtml(pageHref(page, options.homePageId))}"${page.id === options.currentPageId ? ' class="active"' : ''}>${escapeHtml(page.name)}</a>`).join('')}${languageSwitcher}${searchTrigger}${headerCta}</div></nav>`
    : '';

  const navigationScript = headerConfig.enabled && headerConfig.mobileMenu ? `<script>
(() => {
  document.querySelectorAll('[data-tayar-mobile-nav]').forEach((nav) => {
    const button = nav.querySelector('.site-menu-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const open = nav.classList.toggle('menu-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('.site-links a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('menu-open');
      button.setAttribute('aria-expanded', 'false');
    }));
  });
})();
</script>` : '';

  const socialLinks = [
    ['Instagram', footerConfig.instagramUrl],
    ['Facebook', footerConfig.facebookUrl],
    ['LinkedIn', footerConfig.linkedinUrl],
    ['X', footerConfig.xUrl],
  ].filter((item) => item[1]);
  const footerNavigation = footerConfig.showNavigation
    ? navigationPages.map((page) => `<a href="${escapeHtml(pageHref(page, options.homePageId))}">${escapeHtml(page.name)}</a>`).join('')
    : '';
  const footerSocials = socialLinks
    .map(([label, href]) => `<a href="${escapeHtml(safeSocialUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)
    .join('');
  const footerText = footerConfig.text.trim() || `© ${new Date().getFullYear()} ${options.siteName}. All rights reserved.`;
  const globalFooter = footerConfig.enabled
    ? `<footer class="global-site-footer"><div class="footer-inner"><div><strong>${escapeHtml(brandLabel)}</strong><p>${escapeHtml(footerText)}</p></div>${footerNavigation ? `<div class="footer-links">${footerNavigation}</div>` : ''}${footerSocials ? `<div class="footer-socials">${footerSocials}</div>` : ''}</div></footer>`
    : '';

  const leadScript = leadCapture ? `<script>
(() => {
  const endpoint = ${JSON.stringify(leadCapture.supabaseUrl + '/rest/v1/rpc/submit_website_form')};
  const anonKey = ${JSON.stringify(leadCapture.supabaseAnonKey)};
  const projectId = ${JSON.stringify(leadCapture.projectId)};

  document.querySelectorAll('[data-tayar-lead-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('[data-form-status]');
      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const values = {};
      const params = new URLSearchParams(location.search);
      form.querySelectorAll('[name]').forEach((field) => {
        const name = field.getAttribute('name');
        if (!name) return;
        if (field instanceof HTMLInputElement && field.type === 'checkbox') {
          values[name] = field.checked;
          return;
        }
        values[name] = String(formData.get(name) || '');
      });
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
        const value = params.get(key);
        if (value) values['_' + key] = value.slice(0, 300);
      });
      if (document.referrer) values._referrer = String(document.referrer).slice(0, 500);
      values._page_language = document.documentElement.lang || '';

      if (status) status.textContent = 'Sending…';
      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: 'Bearer ' + anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_project_id: projectId,
            p_form_data: values,
            p_page_path: (location.pathname + location.search).slice(0, 500),
          }),
        });

        if (!response.ok) throw new Error('Lead submission failed');
        form.reset();
        const successAction = form.dataset.successAction || 'message';
        const redirectUrl = form.dataset.redirectUrl || '';
        if (typeof window.tayarTrackEvent === 'function') {
          window.tayarTrackEvent('form_submit', { page: location.pathname, language: document.documentElement.lang || '', success_action: successAction });
        }
        if (successAction === 'redirect' && redirectUrl) {
          if (status) status.textContent = 'Thanks! Redirecting…';
          window.setTimeout(() => location.assign(redirectUrl), 250);
        } else if (status) {
          status.textContent = form.dataset.successMessage || 'Thanks! Your message has been sent.';
        }
      } catch {
        if (status) status.textContent = 'Could not send your message. Please try again.';
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
})();
</script>` : '';

  const analyticsEnabled = Boolean(
    options.analyticsEnabled && options.analyticsProjectId && options.supabaseUrl && options.supabaseAnonKey
  );
  const analyticsScript = analyticsEnabled ? `<script>
(() => {
  const endpoint = ${JSON.stringify((options.supabaseUrl || '') + '/rest/v1/rpc/track_website_page_view')};
  const eventEndpoint = ${JSON.stringify((options.supabaseUrl || '') + '/rest/v1/rpc/track_website_event')};
  const anonKey = ${JSON.stringify(options.supabaseAnonKey || '')};
  const projectId = ${JSON.stringify(options.analyticsProjectId || '')};
  const storageKey = 'tayar.analytics.session';
  let sessionId = '';

  try {
    sessionId = sessionStorage.getItem(storageKey) || '';
    if (!sessionId) {
      sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      sessionStorage.setItem(storageKey, sessionId);
    }
  } catch {
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  window.tayarTrackEvent = (eventType, eventData = {}) => {
    fetch(eventEndpoint, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_project_id: projectId,
        p_page_path: (location.pathname + location.search).slice(0, 500),
        p_referrer: String(document.referrer || '').slice(0, 500),
        p_session_id: sessionId.slice(0, 100),
        p_event_type: String(eventType || '').slice(0, 40),
        p_event_data: eventData || {},
      }),
    }).catch(() => {});
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;
    if (!target.matches('.btn,.site-cta,.floating-cta,[data-popup-cta]')) return;
    window.tayarTrackEvent('cta_click', {
      text: String(target.textContent || '').trim().slice(0, 120),
      href: target instanceof HTMLAnchorElement ? target.href.slice(0, 500) : '',
    });
  });

  fetch(endpoint, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_project_id: projectId,
      p_page_path: (location.pathname + location.search).slice(0, 500),
      p_referrer: String(document.referrer || '').slice(0, 500),
      p_session_id: sessionId.slice(0, 100),
    }),
  }).catch(() => {});
})();
</script>` : '';

  const cookieBanner = siteEnhancements.cookieBanner
    ? `<div class="tayar-cookie-banner" data-tayar-cookie hidden><p>${escapeHtml(siteEnhancements.cookieText)}</p><button type="button" data-cookie-accept>${escapeHtml(siteEnhancements.cookieButtonLabel)}</button></div>`
    : '';
  const scrollProgress = siteEnhancements.scrollProgress ? '<div class="tayar-scroll-progress" data-scroll-progress></div>' : '';
  const backToTop = siteEnhancements.backToTop ? '<button class="tayar-back-to-top" type="button" data-back-to-top aria-label="Back to top">↑</button>' : '';
  const announcementBar = siteEnhancements.announcementBar
    ? `<aside class="tayar-announcement" role="status"><span>${escapeHtml(siteEnhancements.announcementText)}</span>${siteEnhancements.announcementHref && siteEnhancements.announcementHref !== '#' ? `<a href="${escapeHtml(resolveBuilderHref(siteEnhancements.announcementHref, homeSlug))}">${escapeHtml(siteEnhancements.announcementLinkLabel)}</a>` : ''}</aside>`
    : '';
  const popupModal = siteEnhancements.popupEnabled
    ? `<div class="tayar-popup-backdrop" data-tayar-popup hidden><div class="tayar-popup" role="dialog" aria-modal="true" aria-label="${escapeHtml(siteEnhancements.popupTitle)}"><button class="tayar-popup-close" type="button" data-popup-close aria-label="Close">×</button><h2>${escapeHtml(siteEnhancements.popupTitle)}</h2><p>${escapeHtml(siteEnhancements.popupText)}</p><a class="btn" href="${escapeHtml(resolveBuilderHref(siteEnhancements.popupButtonHref, homeSlug))}">${escapeHtml(siteEnhancements.popupButtonLabel)}</a></div></div>`
    : '';
  const floatingCta = siteEnhancements.floatingCta
    ? `<a class="tayar-floating-cta" href="${escapeHtml(resolveBuilderHref(siteEnhancements.floatingCtaHref, homeSlug))}">${escapeHtml(siteEnhancements.floatingCtaLabel)}</a>`
    : '';
  const shareButtons = siteEnhancements.shareButtons
    ? '<div class="tayar-share-tools" data-share-tools><button type="button" data-share-native>Share</button><button type="button" data-share-copy>Copy link</button></div>'
    : '';
  const lightbox = siteEnhancements.galleryLightbox
    ? '<div class="tayar-lightbox" data-tayar-lightbox hidden><button type="button" data-lightbox-close aria-label="Close image">×</button><img data-lightbox-image alt="Gallery preview"></div>'
    : '';
  const searchIndex = options.pages.map((page) => ({
    title: page.name,
    href: pageHref(page, options.homePageId),
    text: page.sections.flatMap((section) => [section.title, section.description, ...(section.elements || []).map((element) => element.content || '')]).join(' ').replace(/\s+/g, ' ').trim().slice(0, 6000),
  }));
  const searchOverlay = siteEnhancements.siteSearch
    ? `<div class="tayar-search-overlay" data-site-search hidden><div class="tayar-search-dialog" role="dialog" aria-modal="true" aria-label="Search website"><div class="tayar-search-head"><strong>Search this site</strong><button type="button" data-site-search-close aria-label="Close search">×</button></div><input data-site-search-input type="search" placeholder="Search pages…" autocomplete="off"><div class="tayar-search-results" data-site-search-results><p>Start typing to search.</p></div></div></div>`
    : '';
  const searchIndexJson = JSON.stringify(searchIndex).replace(/</g, '\\u003c');

  const interactiveWidgetsScript = `<script>
(() => {
  document.querySelectorAll('[data-tayar-countdown]').forEach((root) => {
    const target = new Date(root.getAttribute('data-target') || '').getTime();
    const units = { days: root.querySelector('[data-unit="days"]'), hours: root.querySelector('[data-unit="hours"]'), minutes: root.querySelector('[data-unit="minutes"]'), seconds: root.querySelector('[data-unit="seconds"]') };
    const render = () => {
      const diff = Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (units.days) units.days.textContent = String(days).padStart(2, '0');
      if (units.hours) units.hours.textContent = String(hours).padStart(2, '0');
      if (units.minutes) units.minutes.textContent = String(minutes).padStart(2, '0');
      if (units.seconds) units.seconds.textContent = String(seconds).padStart(2, '0');
    };
    render();
    window.setInterval(render, 1000);
  });

  const animateCounter = (node) => {
    if (node.dataset.counted === 'true') return;
    node.dataset.counted = 'true';
    const raw = node.getAttribute('data-target') || '0';
    const match = raw.match(/-?\\d+(?:\\.\\d+)?/);
    if (!match) { node.textContent = raw; return; }
    const target = Number(match[0]);
    const prefix = raw.slice(0, match.index || 0);
    const suffix = raw.slice((match.index || 0) + match[0].length);
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const value = target * (1 - Math.pow(1 - progress, 3));
      const formatted = Number.isInteger(target) ? Math.round(value) : value.toFixed(1);
      node.textContent = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counters = Array.from(document.querySelectorAll('[data-tayar-counter]'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { animateCounter(entry.target); observer.unobserve(entry.target); } }), { threshold: .35 });
    counters.forEach((node) => observer.observe(node));
  } else counters.forEach(animateCounter);

  document.querySelectorAll('[data-tayar-testimonials]').forEach((root) => {
    const slides = Array.from(root.querySelectorAll('[data-slide]'));
    if (!slides.length) return;
    let index = 0;
    const position = root.querySelector('[data-testimonial-position]');
    const show = (next) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
      if (position) position.textContent = (index + 1) + ' / ' + slides.length;
    };
    root.querySelector('[data-testimonial-prev]')?.addEventListener('click', () => show(index - 1));
    root.querySelector('[data-testimonial-next]')?.addEventListener('click', () => show(index + 1));
    if (slides.length > 1) window.setInterval(() => show(index + 1), 6500);
    show(0);
  });

  const cookie = document.querySelector('[data-tayar-cookie]');
  if (cookie) {
    let accepted = false;
    try { accepted = localStorage.getItem('tayar.cookie.accepted') === 'yes'; } catch {}
    if (!accepted) cookie.hidden = false;
    cookie.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
      try { localStorage.setItem('tayar.cookie.accepted', 'yes'); } catch {}
      cookie.hidden = true;
    });
  }

  const progress = document.querySelector('[data-scroll-progress]');
  const back = document.querySelector('[data-back-to-top]');
  const updateScrollUi = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const ratio = Math.max(0, Math.min(1, scrollY / max));
    if (progress) progress.style.transform = 'scaleX(' + ratio + ')';
    if (back) back.classList.toggle('visible', scrollY > 420);
  };
  addEventListener('scroll', updateScrollUi, { passive: true });
  back?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  updateScrollUi();

  const popup = document.querySelector('[data-tayar-popup]');
  if (popup) {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('tayar.popup.dismissed') === 'yes'; } catch {}
    const closePopup = () => {
      popup.hidden = true;
      try { sessionStorage.setItem('tayar.popup.dismissed', 'yes'); } catch {}
    };
    popup.querySelector('[data-popup-close]')?.addEventListener('click', closePopup);
    popup.addEventListener('click', (event) => { if (event.target === popup) closePopup(); });
    if (!dismissed) window.setTimeout(() => { popup.hidden = false; }, ${Math.round(siteEnhancements.popupDelaySeconds * 1000)});
  }

  const lightbox = document.querySelector('[data-tayar-lightbox]');
  const lightboxImage = lightbox?.querySelector('[data-lightbox-image]');
  if (lightbox && lightboxImage) {
    const close = () => { lightbox.hidden = true; lightboxImage.removeAttribute('src'); };
    document.querySelectorAll('.builder-gallery img').forEach((image) => {
      image.setAttribute('tabindex', '0');
      image.setAttribute('role', 'button');
      const open = () => { lightboxImage.setAttribute('src', image.getAttribute('src') || ''); lightbox.hidden = false; };
      image.addEventListener('click', open);
      image.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    lightbox.querySelector('[data-lightbox-close]')?.addEventListener('click', close);
    lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); });
  }

  document.querySelector('[data-share-native]')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  });
  document.querySelector('[data-share-copy]')?.addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = 'Copied';
      window.setTimeout(() => { event.currentTarget.textContent = 'Copy link'; }, 1600);
    } catch {}
  });

  const searchOverlay = document.querySelector('[data-site-search]');
  const searchInput = searchOverlay?.querySelector('[data-site-search-input]');
  const searchResults = searchOverlay?.querySelector('[data-site-search-results]');
  const searchData = ${searchIndexJson};
  const closeSearch = () => { if (searchOverlay) searchOverlay.hidden = true; };
  document.querySelectorAll('[data-site-search-open]').forEach((button) => button.addEventListener('click', () => {
    if (!searchOverlay) return;
    searchOverlay.hidden = false;
    window.setTimeout(() => searchInput?.focus(), 0);
  }));
  searchOverlay?.querySelector('[data-site-search-close]')?.addEventListener('click', closeSearch);
  searchOverlay?.addEventListener('click', (event) => { if (event.target === searchOverlay) closeSearch(); });
  searchInput?.addEventListener('input', () => {
    if (!searchResults) return;
    const query = String(searchInput.value || '').trim().toLowerCase();
    if (query.length < 2) { searchResults.innerHTML = '<p>Type at least 2 characters.</p>'; return; }
    const matches = searchData.filter((item) => (item.title + ' ' + item.text).toLowerCase().includes(query)).slice(0, 8);
    searchResults.innerHTML = matches.length
      ? matches.map((item) => '<a href="' + item.href.replace(/"/g, '&quot;') + '"><strong>' + item.title.replace(/</g, '&lt;') + '</strong><span>' + item.text.slice(0, 150).replace(/</g, '&lt;') + '</span></a>').join('')
      : '<p>No matching pages found.</p>';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeSearch(); if (popup && !popup.hidden) popup.hidden = true; if (lightbox && !lightbox.hidden) lightbox.hidden = true; }
  });
})();
</script>`;

  const motionScript = `<script>
(() => {
  const items = Array.from(document.querySelectorAll('[data-tayar-animated]'));
  if (!items.length) return;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('tayar-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const item = entry.target;
      if (entry.isIntersecting) {
        item.classList.add('tayar-visible');
        if (item.getAttribute('data-tayar-animation-once') !== 'false') observer.unobserve(item);
      } else if (item.getAttribute('data-tayar-animation-once') === 'false') {
        item.classList.remove('tayar-visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

  items.forEach((item) => observer.observe(item));
})();
</script>`;

  const customCss = sanitizeCustomCss(productionConfig.customCss);
  const verificationTags = [
    productionConfig.googleVerification ? `<meta name="google-site-verification" content="${escapeHtml(productionConfig.googleVerification)}">` : '',
    productionConfig.bingVerification ? `<meta name="msvalidate.01" content="${escapeHtml(productionConfig.bingVerification)}">` : '',
  ].filter(Boolean).join('\n');
  const organizationUrl = normalizeSiteUrl(productionConfig.organizationUrl) || options.canonicalUrl || '';
  const structuredSchemas: Record<string, unknown>[] = [];
  if (productionConfig.organizationSchema) {
    structuredSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: productionConfig.organizationName || options.siteName,
      ...(organizationUrl ? { url: organizationUrl } : {}),
      ...(productionConfig.organizationLogo ? { logo: productionConfig.organizationLogo } : {}),
    });
  }
  if (productionConfig.localBusinessSchema) {
    structuredSchemas.push({
      '@context': 'https://schema.org',
      '@type': productionConfig.localBusinessType || 'LocalBusiness',
      name: productionConfig.organizationName || options.siteName,
      ...(organizationUrl ? { url: organizationUrl } : {}),
      ...(productionConfig.organizationLogo ? { image: productionConfig.organizationLogo } : {}),
      ...(productionConfig.localBusinessPhone ? { telephone: productionConfig.localBusinessPhone } : {}),
      ...(productionConfig.localBusinessAddress ? { address: productionConfig.localBusinessAddress } : {}),
    });
  }
  const productionSchema = structuredSchemas.length
    ? `<script type="application/ld+json">${JSON.stringify(structuredSchemas.length === 1 ? structuredSchemas[0] : structuredSchemas).replace(/</g, '\\u003c')}</script>`
    : '';
  const ga4Head = options.analyticsEnabled && productionConfig.ga4Id
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(productionConfig.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(productionConfig.ga4Id)});</script>`
    : '';
  const gtmHead = options.analyticsEnabled && productionConfig.gtmId
    ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer',${JSON.stringify(productionConfig.gtmId)});</script>`
    : '';
  const gtmBody = options.analyticsEnabled && productionConfig.gtmId
    ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeHtml(productionConfig.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
    : '';
  const metaPixelHead = options.analyticsEnabled && productionConfig.metaPixelId
    ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(productionConfig.metaPixelId)});fbq('track','PageView');</script>`
    : '';
  const metaPixelBody = options.analyticsEnabled && productionConfig.metaPixelId
    ? `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${escapeHtml(productionConfig.metaPixelId)}&ev=PageView&noscript=1" alt=""></noscript>`
    : '';
  const plausibleHead = options.analyticsEnabled && productionConfig.plausibleDomain
    ? `<script defer data-domain="${escapeHtml(productionConfig.plausibleDomain)}" src="https://plausible.io/js/script.js"></script>`
    : '';
  const maintenanceBody = productionConfig.maintenanceMode
    ? `<main class="tayar-maintenance"><div><span>Maintenance</span><h1>${escapeHtml(productionConfig.maintenanceTitle)}</h1><p>${escapeHtml(productionConfig.maintenanceText)}</p></div></main>`
    : '';

  return `<!DOCTYPE html>
<html lang="${options.language}" dir="${direction}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action 'self' https:;">
<script>document.documentElement.classList.add('tayar-js')</script>
<title>${escapeHtml(options.title)}</title>
<meta name="description" content="${escapeHtml(options.description)}">
<meta name="robots" content="${options.noIndex ? 'noindex,nofollow' : 'index,follow'}">
${options.keywords?.length ? `<meta name="keywords" content="${escapeHtml(options.keywords.join(', '))}">` : ''}
${options.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">` : ''}
${(options.alternateLinks || []).map((item) => `<link rel="alternate" hreflang="${item.language}" href="${escapeHtml(item.href)}">`).join('\n')}
${(options.alternateLinks || []).find((item) => item.isDefault) ? `<link rel="alternate" hreflang="x-default" href="${escapeHtml((options.alternateLinks || []).find((item) => item.isDefault)?.href || '')}">` : ''}
${options.faviconUrl ? `<link rel="icon" href="${escapeHtml(options.faviconUrl)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(options.siteName)}">
<meta property="og:title" content="${escapeHtml(options.title)}">
<meta property="og:description" content="${escapeHtml(options.description)}">
${options.canonicalUrl ? `<meta property="og:url" content="${escapeHtml(options.canonicalUrl)}">` : ''}
${options.socialImageUrl ? `<meta property="og:image" content="${escapeHtml(options.socialImageUrl)}">` : ''}
<meta name="twitter:card" content="${options.socialImageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(options.title)}">
<meta name="twitter:description" content="${escapeHtml(options.description)}">
${options.socialImageUrl ? `<meta name="twitter:image" content="${escapeHtml(options.socialImageUrl)}">` : ''}
${verificationTags}
${faqSchema}
${productionSchema}
${ga4Head}
${gtmHead}
${metaPixelHead}
${plausibleHead}
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:${theme.fontFamily},Arial,sans-serif;background:${theme.backgroundColor};color:${theme.textColor};line-height:1.6}
a{text-decoration:none}
:focus-visible{outline:3px solid ${theme.primaryColor};outline-offset:3px}
.tayar-skip-link{position:fixed;left:12px;top:12px;z-index:500;transform:translateY(-160%);background:${theme.secondaryColor};color:${theme.textColor};border:1px solid ${theme.primaryColor};border-radius:10px;padding:9px 12px;font-weight:800}.tayar-skip-link:focus{transform:none}
.site-nav{position:relative;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 24px;background:${headerConfig.backgroundColor};border-bottom:1px solid ${headerConfig.borderColor};backdrop-filter:blur(16px)}
.site-nav.sticky{position:sticky}.site-brand{color:${headerConfig.textColor};font-weight:800;font-size:${headerConfig.brandSize}px}.site-brand-wrap{display:inline-flex;align-items:center;gap:10px}.site-logo{width:34px;height:34px;border-radius:10px;object-fit:cover}.site-menu-toggle{display:none;border:1px solid ${headerConfig.borderColor};background:#ffffff0d;color:${headerConfig.textColor};padding:8px 11px;border-radius:${theme.buttonRadius}px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;align-items:center;gap:7px}.site-links{display:flex;align-items:center;gap:${headerConfig.navGap}px;flex-wrap:wrap}.site-links a{color:${headerConfig.textColor};font-size:${headerConfig.navSize}px;font-weight:600;opacity:.82}.site-links a:hover{color:${headerConfig.hoverColor};opacity:1}.site-links a.active{color:${headerConfig.activeColor};opacity:1}.site-links .site-cta{background:${headerConfig.ctaBackgroundColor};color:${headerConfig.ctaTextColor};padding:9px 14px;border-radius:${theme.buttonRadius}px;opacity:1}.site-language-switcher{display:flex;align-items:center;gap:4px;padding:3px;border:1px solid ${headerConfig.borderColor};border-radius:999px}.site-language-switcher a{min-width:32px;padding:3px 7px;border-radius:999px;text-align:center;font-size:11px!important;opacity:.75}.site-language-switcher a.active{background:${headerConfig.ctaBackgroundColor};color:${headerConfig.ctaTextColor}!important;opacity:1}
.section{padding:${theme.sectionSpacing}px 24px;color:${theme.textColor}}
.container{width:min(${theme.contentWidth}px,100%);margin:auto;text-align:center}
.section-container-full{width:100%;max-width:none}
.hero{min-height:650px;display:flex;align-items:center;justify-content:center}
h1{font-size:clamp(44px,7vw,82px);line-height:1.05;margin:16px 0;font-weight:800}
h2{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:12px 0 18px;font-weight:800}
h3{font-size:22px;margin-bottom:8px}
.lead{max-width:720px;margin:0 auto 30px;color:${theme.mutedTextColor};font-size:18px}
.eyebrow{display:inline-block;color:var(--accent);font-weight:800;font-size:12px;letter-spacing:2px}
.btn{display:inline-block;margin-top:10px;background:var(--accent);color:#fff;padding:13px 22px;border-radius:${theme.buttonRadius}px;font-weight:700;box-shadow:0 10px 30px #0003}
.btn.secondary{background:#ffffff12;border:1px solid #ffffff20}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:950px;margin:40px auto}
.card,.price{padding:28px;border:1px solid #ffffff16;background:#ffffff08;border-radius:20px;text-align:left}
.card p,.price p{color:${theme.mutedTextColor}}
.icon{color:var(--accent);font-weight:900;margin-bottom:15px}
.pricing{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:900px;margin:40px auto}
.price strong{font-size:42px;display:block;margin:12px 0}
.price.featured{border-color:var(--accent);transform:translateY(-8px)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;text-align:left}
.split .lead{margin-left:0}
.visual{height:300px;border:2px solid;border-radius:28px;background:linear-gradient(135deg,#ffffff10,#ffffff03);display:flex;align-items:center;justify-content:center}
.visual span{padding:18px 25px;border-radius:15px;font-weight:900}
.contact-box{max-width:600px;margin:35px auto;display:grid;gap:12px}.tayar-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
.contact-box input,.contact-box textarea,.contact-box select{width:100%;padding:15px;border-radius:12px;border:1px solid #ffffff18;background:#ffffff08;color:#fff;outline:none}
.contact-box textarea{min-height:130px;resize:vertical}
.form-field{display:grid;gap:7px;text-align:left}.form-field>span{font-size:12px;font-weight:700;color:${theme.mutedTextColor}}.form-checkbox{display:flex;align-items:center;gap:10px;text-align:left;color:${theme.mutedTextColor}}.form-checkbox input{width:auto}.contact-box select option{color:#111827}
.contact-box .btn{border:0;cursor:pointer}
.contact-box .btn:disabled{cursor:not-allowed;opacity:.55}
.form-status{min-height:20px;color:${theme.mutedTextColor};font-size:13px;text-align:center}
.footer{padding:45px 24px;text-align:center}
.footer h2{font-size:24px}
.footer p{color:${theme.mutedTextColor}}
.global-site-footer{padding:34px 24px;background:${theme.secondaryColor};border-top:1px solid #ffffff14}.footer-inner{width:min(${theme.contentWidth}px,100%);margin:auto;display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:28px;align-items:start}.footer-inner p{margin-top:6px;color:${theme.mutedTextColor};font-size:13px}.footer-links,.footer-socials{display:flex;flex-wrap:wrap;gap:14px}.footer-links a,.footer-socials a{color:${theme.mutedTextColor};font-size:13px;font-weight:600}.footer-links a:hover,.footer-socials a:hover{color:${theme.textColor}}
.element-stack{display:flex;flex-direction:column;align-items:center;gap:20px}
.section-layout{display:grid;grid-template-columns:repeat(var(--layout-cols),minmax(0,1fr));gap:var(--layout-gap);justify-items:var(--layout-align);align-items:start}
.layout-item{min-width:0;width:100%;display:flex;flex-direction:column;align-items:var(--layout-align,center)}
.layout-item>*{max-width:100%}
.tayar-container{max-width:100%}.container-element-item{min-width:0;width:100%;display:flex;flex-direction:column}.tayar-container[data-layout="row"]{flex-wrap:wrap}
.tayar-element{transition:transform .2s ease,opacity .2s ease,background-color .2s ease,color .2s ease,box-shadow .2s ease,border-color .2s ease}
${desktopElementAnimationCss}
${desktopElementHoverCss}
.builder-image{display:block;max-width:100%;height:auto;margin:auto}.builder-list{padding-left:1.4em;text-align:left}.builder-list li+li{margin-top:.55em}.builder-divider{display:block;height:2px;border:0;margin:8px auto}.builder-spacer{display:block}.builder-video,.builder-video-file{display:block;max-width:100%;margin:auto;overflow:hidden}.builder-video{aspect-ratio:16/9}.builder-video iframe{width:100%;height:100%;border:0;display:block}.builder-video-file{width:100%;height:auto}.builder-video-placeholder{display:flex;min-height:180px;align-items:center;justify-content:center;border:1px dashed #ffffff30;color:${theme.mutedTextColor};padding:24px;text-align:center}.builder-accordion{width:100%;text-align:left}.builder-accordion details{border:1px solid #ffffff18;border-radius:12px;padding:0 16px;background:#ffffff06}.builder-accordion details+details{margin-top:10px}.builder-accordion summary{cursor:pointer;padding:14px 0;font-weight:800}.builder-accordion details>div{padding:0 0 16px;color:${theme.mutedTextColor}}.builder-tabs{width:100%}.tayar-tab-input{position:absolute;opacity:0;pointer-events:none}.tayar-tab-labels{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.tayar-tab-labels label{cursor:pointer;border:1px solid #ffffff18;border-radius:10px;padding:9px 13px;font-weight:700;background:#ffffff08}.tayar-tab-panels{border:1px solid #ffffff18;border-radius:14px;background:#ffffff06;padding:18px;text-align:left}.tayar-tab-panel{display:none;color:${theme.mutedTextColor}}.builder-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%}.builder-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block}.builder-embed{width:100%;aspect-ratio:16/9;overflow:hidden}.builder-embed iframe{width:100%;height:100%;border:0;display:block}.builder-embed-placeholder{display:flex;min-height:220px;align-items:center;justify-content:center;border:1px dashed #ffffff30;color:${theme.mutedTextColor};padding:24px;text-align:center}.builder-custom-html{width:100%}.builder-countdown{width:100%}.countdown-label{margin-bottom:14px;font-weight:700}.countdown-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.countdown-grid span{display:grid;gap:2px;border:1px solid #ffffff18;background:#0002;border-radius:12px;padding:14px 8px}.countdown-grid strong{font-size:clamp(22px,4vw,38px);line-height:1}.countdown-grid small{font-size:10px;text-transform:uppercase;opacity:.6}.builder-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%}.stat-card{border:1px solid #ffffff18;background:#0002;border-radius:14px;padding:20px;text-align:center}.stat-card strong{display:block;font-size:clamp(28px,5vw,48px);line-height:1}.stat-card span{display:block;margin-top:8px;color:${theme.mutedTextColor};font-size:13px}.builder-testimonials{width:100%}.testimonial-slide{display:none;border:1px solid #ffffff18;background:#0002;border-radius:16px;padding:24px;text-align:center}.testimonial-slide.active{display:block}.testimonial-slide p{font-size:18px;font-style:italic}.testimonial-slide strong{display:block;margin-top:14px}.testimonial-controls{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:12px}.testimonial-controls button{width:36px;height:36px;border-radius:999px;border:1px solid #ffffff20;background:#ffffff0d;color:inherit;cursor:pointer}.site-search-trigger{border:1px solid ${headerConfig.borderColor};background:transparent;color:${headerConfig.textColor};padding:8px 11px;border-radius:10px;font:inherit;cursor:pointer}.tayar-announcement{display:flex;align-items:center;justify-content:center;gap:14px;padding:9px 18px;background:${theme.primaryColor};color:#fff;font-size:13px;font-weight:700;text-align:center}.tayar-announcement a{color:#fff;text-decoration:underline}.tayar-popup-backdrop,.tayar-search-overlay,.tayar-lightbox{position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;padding:20px;background:#020617cc;backdrop-filter:blur(8px)}.tayar-popup-backdrop[hidden],.tayar-search-overlay[hidden],.tayar-lightbox[hidden]{display:none}.tayar-popup{position:relative;width:min(520px,100%);border:1px solid #ffffff20;border-radius:22px;background:${theme.secondaryColor};padding:34px;color:${theme.textColor};box-shadow:0 30px 100px #000b;text-align:center}.tayar-popup h2{font-size:32px}.tayar-popup p{margin:12px auto;color:${theme.mutedTextColor};max-width:440px}.tayar-popup-close,.tayar-search-head button,.tayar-lightbox button{position:absolute;right:14px;top:12px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer}.tayar-floating-cta{position:fixed;left:20px;bottom:20px;z-index:92;background:${theme.primaryColor};color:#fff;padding:12px 18px;border-radius:${theme.buttonRadius}px;font-weight:800;box-shadow:0 14px 40px #0006}.tayar-share-tools{position:fixed;right:18px;top:50%;z-index:88;display:flex;flex-direction:column;gap:8px;transform:translateY(-50%)}.tayar-share-tools button{border:1px solid #ffffff20;background:${theme.secondaryColor};color:${theme.textColor};padding:9px 11px;border-radius:10px;font-weight:700;cursor:pointer}.tayar-lightbox img{max-width:min(1200px,94vw);max-height:88vh;object-fit:contain;border-radius:16px;box-shadow:0 30px 100px #000}.builder-gallery img{cursor:zoom-in}.tayar-search-dialog{position:relative;width:min(720px,100%);max-height:80vh;overflow:auto;border:1px solid #ffffff20;border-radius:20px;background:${theme.secondaryColor};padding:22px;color:${theme.textColor};box-shadow:0 30px 100px #000b}.tayar-search-head{display:flex;align-items:center;justify-content:space-between;padding-right:34px;margin-bottom:14px}.tayar-search-head button{top:10px}.tayar-search-dialog input{width:100%;border:1px solid #ffffff20;border-radius:12px;background:#ffffff08;color:${theme.textColor};padding:13px 14px;outline:none}.tayar-search-results{display:grid;gap:8px;margin-top:14px}.tayar-search-results>a{display:grid;gap:4px;border:1px solid #ffffff16;border-radius:12px;padding:12px;color:${theme.textColor};background:#ffffff05}.tayar-search-results>a span,.tayar-search-results p{color:${theme.mutedTextColor};font-size:12px}.tayar-cookie-banner{position:fixed;left:18px;right:18px;bottom:18px;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:18px;max-width:850px;margin:auto;padding:16px 18px;border:1px solid #ffffff20;background:${theme.secondaryColor};color:${theme.textColor};border-radius:16px;box-shadow:0 18px 60px #0008}.tayar-cookie-banner[hidden]{display:none}.tayar-cookie-banner p{font-size:13px;color:${theme.mutedTextColor}}.tayar-cookie-banner button{border:0;background:${theme.primaryColor};color:#fff;padding:9px 14px;border-radius:${theme.buttonRadius}px;font-weight:700;cursor:pointer}.tayar-scroll-progress{position:fixed;left:0;top:0;z-index:120;width:100%;height:3px;transform:scaleX(0);transform-origin:left center;background:${theme.primaryColor};pointer-events:none}.tayar-back-to-top{position:fixed;right:20px;bottom:20px;z-index:90;width:44px;height:44px;border-radius:999px;border:1px solid #ffffff22;background:${theme.secondaryColor};color:${theme.textColor};font-size:20px;cursor:pointer;opacity:0;pointer-events:none;transform:translateY(12px);transition:.2s}.tayar-back-to-top.visible{opacity:1;pointer-events:auto;transform:none}@media(max-width:700px){.builder-gallery{grid-template-columns:1fr}.tayar-tab-labels{flex-direction:column}.tayar-tab-labels label{width:100%}.builder-stats{grid-template-columns:1fr}.countdown-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tayar-cookie-banner{align-items:stretch;flex-direction:column}.tayar-back-to-top{right:14px;bottom:14px}.tayar-floating-cta{left:14px;bottom:14px}.tayar-share-tools{right:10px;top:auto;bottom:72px;transform:none}.tayar-announcement{align-items:flex-start;flex-direction:column;gap:3px;text-align:left}.site-search-trigger span{display:none}.tayar-popup{padding:30px 22px}.tayar-popup h2{font-size:27px}}
@media(max-width:900px){.section-layout[data-cols="3"]{grid-template-columns:repeat(2,minmax(0,1fr))}.section-layout[data-cols="3"] .layout-item[data-column="3"]{grid-column:2!important}}
@media(max-width:700px){
.site-nav{align-items:flex-start;flex-direction:column}.site-nav.mobile-menu{align-items:center;flex-direction:row;flex-wrap:wrap}.site-nav.mobile-menu .site-menu-toggle{display:inline-flex;margin-left:auto}.site-nav.mobile-menu .site-links{display:none;width:100%;flex-direction:column;align-items:stretch;gap:8px;padding-top:10px}.site-nav.mobile-menu.menu-open .site-links{display:flex}.site-nav.mobile-menu .site-links a{display:block;width:100%;padding:9px 4px}.site-nav:not(.mobile-menu) .site-links{gap:12px}.footer-inner{grid-template-columns:1fr}.footer-links,.footer-socials{gap:10px}
.section{padding:65px 18px}
.section-layout{grid-template-columns:1fr!important}.section-layout .layout-item{grid-column:1!important}.tayar-container{flex-direction:column!important}
.cards,.pricing,.split{grid-template-columns:1fr}
.price.featured{transform:none}
h1{font-size:45px}
}
${responsiveSectionCss}
${responsiveElementCss}
@media(prefers-reduced-motion:reduce){.tayar-js [data-tayar-animated]{opacity:1!important;transform:none!important;transition:none!important;will-change:auto!important}}
.tayar-maintenance{min-height:100vh;display:grid;place-items:center;padding:32px;background:${theme.backgroundColor};color:${theme.textColor};text-align:center}.tayar-maintenance>div{width:min(720px,100%)}.tayar-maintenance span{display:inline-block;margin-bottom:14px;color:${theme.primaryColor};font-weight:900;text-transform:uppercase;letter-spacing:.16em;font-size:12px}.tayar-maintenance h1{font-size:clamp(42px,8vw,78px)}.tayar-maintenance p{max-width:640px;margin:18px auto;color:${theme.mutedTextColor};font-size:18px}
${customCss}
</style>
</head>
<body>
${gtmBody}
${metaPixelBody}
${productionConfig.maintenanceMode ? maintenanceBody : `<a class="tayar-skip-link" href="#tayar-main-content">Skip to content</a>${scrollProgress}
${announcementBar}
${navigation}
<main id="tayar-main-content">${body}</main>
${globalFooter}
${floatingCta}
${shareButtons}
${searchOverlay}
${popupModal}
${lightbox}
${cookieBanner}
${backToTop}
${navigationScript}
${leadScript}
${analyticsScript}
${interactiveWidgetsScript}
${motionScript}`}
</body>
</html>`;
}

function effectiveStyle(element: WebsiteElement, device: Device) {
  return { ...element.style, ...(element.responsive?.[device] || {}) };
}

function effectiveSectionStyle(section: WebsiteSection, device: Device): WebsiteSection {
  return { ...section, ...(section.responsive?.[device] || {}) };
}

function ElementPreview({
  element,
  selected,
  dragging,
  dragOver,
  device,
  onSelect,
  onDragStart,
  onDragMove,
  onDragOver,
  onDrop,
  onDragEnd,
  onInlineContentChange,
  onInlineSourceChange,
}: {
  element: WebsiteElement;
  selected: boolean;
  dragging: boolean;
  dragOver: boolean;
  device: Device;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragMove: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onInlineContentChange: (content: string) => void;
  onInlineSourceChange: (src: string) => void;
}) {
  const style = effectiveStyle(element, device);
  const [hovered, setHovered] = useState(false);
  const [editingInline, setEditingInline] = useState(false);
  const inlineEditRef = useRef<HTMLElement | null>(null);
  const inlineEditable = element.type === 'heading' || element.type === 'text' || element.type === 'button';

  useEffect(() => {
    if (!editingInline || !inlineEditRef.current) return;
    inlineEditRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(inlineEditRef.current);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [editingInline]);
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const positionX = clampElementNumber(style.positionX, 0, -4000, 4000);
  const positionY = clampElementNumber(style.positionY, 0, -4000, 4000);
  const hoverScale = hovered ? clampElementNumber(style.hoverScale, 1, 0.5, 1.6) : 1;
  const commonStyle = {
    color: hovered && style.hoverColor ? style.hoverColor : style.color,
    backgroundColor: hovered && style.hoverBackgroundColor ? style.hoverBackgroundColor : style.backgroundColor,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    fontWeight: style.fontWeight,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing !== undefined ? `${style.letterSpacing}px` : undefined,
    padding: style.padding ? `${style.padding}px` : undefined,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
    borderStyle: style.borderWidth ? (style.borderStyle || 'solid') : undefined,
    borderColor: style.borderColor,
    boxShadow: elementShadowCss(hovered && style.hoverShadow ? style.hoverShadow : style.shadow),
    opacity: hovered && style.hoverOpacity !== undefined ? style.hoverOpacity : style.opacity,
    transform: `translate3d(${positionX}px, ${positionY}px, 0) rotate(${rotate}deg) scale(${hoverScale})`,
    transition: 'transform .2s ease, opacity .2s ease, background-color .2s ease, color .2s ease, box-shadow .2s ease, border-color .2s ease',
    width: style.width ? `${style.width}%` : undefined,
  } as const;

  const wrapper = `relative max-w-full rounded-lg outline-none transition duration-150 ${editingInline ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'} ${
    selected ? 'ring-2 ring-violet-400/90 shadow-[0_0_0_4px_rgba(139,92,246,0.08)]' : 'hover:ring-1 hover:ring-violet-400/40'
  } ${dragging ? 'scale-[0.99] opacity-55 shadow-xl' : 'opacity-100'} ${dragOver ? 'ring-2 ring-cyan-400/80' : ''}`;

  const commitInlineEdit = () => {
    if (!editingInline) return;
    const next = (inlineEditRef.current?.textContent || '').replace(/\u00a0/g, ' ').trim();
    setEditingInline(false);
    if (next && next !== element.content) onInlineContentChange(next);
  };

  const cancelInlineEdit = () => {
    if (inlineEditRef.current) inlineEditRef.current.textContent = element.content;
    setEditingInline(false);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEdit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inlineEditRef.current?.blur();
    }
  };

  const dragProps = {
    draggable: !editingInline,
    onDragStart: (e: React.DragEvent) => {
      if (editingInline) { e.preventDefault(); return; }
      e.stopPropagation(); onDragStart(e);
    },
    onDrag: (e: React.DragEvent) => {
      if (editingInline) return;
      e.stopPropagation();
      onDragMove(e);
    },
    onDragOver: (e: React.DragEvent) => { e.stopPropagation(); onDragOver(e); },
    onDrop: (e: React.DragEvent) => { e.stopPropagation(); onDrop(e); },
    onDragEnd: (e: React.DragEvent) => { e.stopPropagation(); onDragEnd(); },
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelect(); },
    onDoubleClick: (e: React.MouseEvent) => {
      if (element.type === 'image' || element.type === 'video' || element.type === 'embed') {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        const sourceLabel = element.type === 'image' ? 'Image URL' : element.type === 'video' ? 'Video URL' : 'Embed URL';
        const nextSource = window.prompt(sourceLabel, element.src || '')?.trim();
        if (nextSource && nextSource !== element.src) onInlineSourceChange(nextSource);
        return;
      }
      if (!inlineEditable) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      setEditingInline(true);
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (element.type === 'heading') {
    return <h2 {...dragProps} ref={(node) => { inlineEditRef.current = node; }} contentEditable={editingInline} suppressContentEditableWarning onBlur={commitInlineEdit} onKeyDown={handleInlineKeyDown} className={`${wrapper} ${editingInline ? 'ring-2 ring-cyan-400/80 bg-black/10' : ''}`} style={commonStyle} title={editingInline ? 'Press Enter to finish · Esc to cancel' : 'Double-click to edit text'}>{element.content}</h2>;
  }
  if (element.type === 'text') {
    return <p {...dragProps} ref={(node) => { inlineEditRef.current = node; }} contentEditable={editingInline} suppressContentEditableWarning onBlur={commitInlineEdit} onKeyDown={handleInlineKeyDown} className={`${wrapper} ${editingInline ? 'ring-2 ring-cyan-400/80 bg-black/10' : ''}`} style={commonStyle} title={editingInline ? 'Press Enter to finish · Esc to cancel' : 'Double-click to edit text'}>{element.content}</p>;
  }
  if (element.type === 'button') {
    return <button {...dragProps} ref={(node) => { inlineEditRef.current = node; }} type="button" contentEditable={editingInline} suppressContentEditableWarning onBlur={commitInlineEdit} onKeyDown={handleInlineKeyDown} className={`${wrapper} ${editingInline ? 'ring-2 ring-cyan-400/80 bg-black/10' : ''}`} style={commonStyle} title={editingInline ? 'Press Enter to finish · Esc to cancel' : 'Double-click to edit button text'}>{element.content}</button>;
  }
  if (element.type === 'list') {
    const items = (element.content || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return <ul {...dragProps} className={`${wrapper} list-disc space-y-2 pl-6`} style={commonStyle}>{items.map((item, index) => <li key={`${element.id}-${index}`}>{item}</li>)}</ul>;
  }
  if (element.type === 'divider') {
    return <div {...dragProps} className={`${wrapper} py-2`} style={{ ...commonStyle, backgroundColor: 'transparent', padding: undefined, borderWidth: undefined, boxShadow: undefined }}><div style={{ height: '2px', width: '100%', background: style.backgroundColor || '#7c3aed', opacity: style.opacity ?? 0.35 }} /></div>;
  }
  if (element.type === 'spacer') {
    const height = Math.max(8, Math.min(320, (clampElementNumber(style.padding, 24, 0, 160) || 24) * 2));
    return <div {...dragProps} className={`${wrapper} flex w-full items-center justify-center border border-dashed border-white/10 text-[10px] text-gray-500`} style={{ ...commonStyle, height: `${height}px` }}>Spacer {height}px</div>;
  }
  if (element.type === 'video') {
    const source = videoSource(element.src || '');
    return (
      <div {...dragProps} className={`${wrapper} overflow-hidden`} style={commonStyle} title="Double-click to edit video URL">
        {source?.kind === 'iframe' ? <iframe src={source.src} title={element.content || 'Video'} className="aspect-video w-full border-0" /> : source?.kind === 'video' ? <video src={source.src} controls className="h-auto w-full" /> : <div className="flex min-h-40 w-full items-center justify-center border border-dashed border-white/20 bg-black/20 px-6 text-center text-xs text-gray-400">Double-click to add a video URL</div>}
      </div>
    );
  }
  if (element.type === 'accordion') {
    const rows = parseRichRows(element.content);
    return <div {...dragProps} className={`${wrapper} w-full space-y-2 text-left`} style={commonStyle}>{rows.map((row, index) => <details key={`${element.id}-accordion-${index}`} open={index === 0} className="rounded-lg border border-white/10 bg-white/5 px-3"><summary className="cursor-pointer py-3 font-bold">{row.title}</summary><p className="pb-3 text-sm opacity-75">{row.body}</p></details>)}</div>;
  }
  if (element.type === 'tabs') {
    const rows = parseRichRows(element.content);
    return <div {...dragProps} className={`${wrapper} w-full`} style={commonStyle}><div className="mb-2 flex flex-wrap gap-2">{rows.map((row, index) => <span key={`${element.id}-tab-${index}`} className={`rounded-lg border px-3 py-2 text-xs font-bold ${index === 0 ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 bg-white/5'}`}>{row.title}</span>)}</div><div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left text-sm opacity-80">{rows[0]?.body || 'Add tab content'}</div></div>;
  }
  if (element.type === 'gallery') {
    const images = (element.content || '').split(/\r?\n/).map((item) => safeEmbedUrl(item)).filter(Boolean);
    return <div {...dragProps} className={`${wrapper} grid w-full grid-cols-2 gap-2 md:grid-cols-3`} style={commonStyle}>{images.length ? images.map((src, index) => <img key={`${element.id}-gallery-${index}`} src={src} alt={`Gallery ${index + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" draggable={false} />) : <div className="col-span-full flex min-h-32 items-center justify-center border border-dashed border-white/20 text-xs text-gray-400">Add one image URL per line</div>}</div>;
  }
  if (element.type === 'embed') {
    const source = safeEmbedUrl(element.src || '');
    return <div {...dragProps} className={`${wrapper} w-full overflow-hidden`} style={commonStyle} title="Double-click to edit embed URL">{source ? <iframe src={source} title={element.content || 'Embedded content'} className="aspect-video w-full border-0" /> : <div className="flex min-h-44 items-center justify-center border border-dashed border-white/20 px-6 text-center text-xs text-gray-400">Double-click to add an embeddable URL</div>}</div>;
  }
  if (element.type === 'countdown') {
    const [target, ...labelParts] = (element.content || '').split('|');
    return <div {...dragProps} className={`${wrapper} w-full`} style={commonStyle}><p className="mb-3 text-xs font-semibold opacity-70">{labelParts.join('|').trim() || 'Countdown'}</p><div className="grid grid-cols-4 gap-2">{['Days','Hours','Minutes','Seconds'].map((label) => <div key={label} className="rounded-lg border border-white/10 bg-black/15 p-3"><strong className="block text-xl">00</strong><span className="text-[9px] uppercase opacity-60">{label}</span></div>)}</div><p className="mt-2 text-[9px] opacity-50">Target: {target.trim() || 'set date in inspector'}</p></div>;
  }
  if (element.type === 'stats') {
    const rows = parseRichRows(element.content);
    return <div {...dragProps} className={`${wrapper} grid w-full grid-cols-1 gap-2 sm:grid-cols-3`} style={commonStyle}>{rows.map((row, index) => <div key={`${element.id}-stat-${index}`} className="rounded-xl border border-white/10 bg-black/10 p-4 text-center"><strong className="block text-2xl">{row.title}</strong><span className="text-xs opacity-65">{row.body}</span></div>)}</div>;
  }
  if (element.type === 'testimonials-slider') {
    const rows = parseRichRows(element.content);
    const first = rows[0];
    return <div {...dragProps} className={`${wrapper} w-full`} style={commonStyle}><div className="rounded-xl border border-white/10 bg-black/10 p-5 text-center"><p className="text-sm italic opacity-85">“{first?.body || 'Add testimonial text'}”</p><strong className="mt-3 block text-xs">— {first?.title || 'Customer'}</strong></div><div className="mt-2 text-center text-[9px] opacity-50">Slider preview • {rows.length} testimonials</div></div>;
  }
  if (element.type === 'code') {
    return <div {...dragProps} className={`${wrapper} w-full overflow-hidden`} style={commonStyle}><div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: sanitizeCustomHtml(element.content) }} /></div>;
  }
  if (element.type === 'image') {
    return (
      <div {...dragProps} className={`${wrapper} overflow-hidden`} style={commonStyle} title="Double-click to replace image">
        {element.src ? (
          <img src={element.src} alt={element.content || 'Website image'} className="h-auto w-full object-cover" draggable={false} />
        ) : (
          <div className="flex min-h-32 w-full items-center justify-center border border-dashed border-white/20 bg-white/5 px-6 text-xs text-gray-400">Double-click to add image URL</div>
        )}
      </div>
    );
  }
  return <div {...dragProps} className={`${wrapper} overflow-hidden`} style={commonStyle}>{element.content}</div>;
}

function SectionPreview({
  section,
  selected,
  selectedElementId,
  onSelect,
  onSelectElement,
  draggedElementId,
  dragOverElementId,
  dragOverElementPosition,
  onElementDragStart,
  onElementDragMove,
  onElementDragOver,
  onElementDrop,
  onElementDragEnd,
  onResizeElementStart,
  onResizeElementWidth,
  onResetElementPosition,
  onQuickUpdateElement,
  onOpenMediaLibrary,
  onOpenInspector,
  onDuplicateSelectedElement,
  onDeleteSelectedElement,
  onInlineContentChange,
  onInlineSourceChange,
  onAddElement,
  onMoveSection,
  onDeleteSection,
  canMoveSectionUp,
  canMoveSectionDown,
  canDeleteSection,
  device,
  theme,
}: {
  section: WebsiteSection;
  selected: boolean;
  selectedElementId: string | null;
  onSelect: () => void;
  onSelectElement: (id: string) => void;
  draggedElementId: string | null;
  dragOverElementId: string | null;
  dragOverElementPosition: 'before' | 'after' | null;
  onElementDragStart: (id: string, e: React.DragEvent) => void;
  onElementDragMove: (id: string, e: React.DragEvent) => void;
  onElementDragOver: (id: string, e: React.DragEvent) => void;
  onElementDrop: (id: string, e: React.DragEvent) => void;
  onElementDragEnd: () => void;
  onResizeElementStart: (id: string) => void;
  onResizeElementWidth: (id: string, width: number) => void;
  onResetElementPosition: (id: string) => void;
  onQuickUpdateElement: (id: string, changes: Partial<WebsiteElement>) => void;
  onOpenMediaLibrary: () => void;
  onOpenInspector: () => void;
  onDuplicateSelectedElement: () => void;
  onDeleteSelectedElement: () => void;
  onInlineContentChange: (elementId: string, content: string) => void;
  onInlineSourceChange: (elementId: string, src: string) => void;
  onAddElement: (type: WebsiteElementType) => void;
  onMoveSection: (direction: 'up' | 'down') => void;
  onDeleteSection: () => void;
  canMoveSectionUp: boolean;
  canMoveSectionDown: boolean;
  canDeleteSection: boolean;
  device: Device;
  theme: WebsiteTheme;
}) {
  const compact = device === 'mobile';
  const responsiveSection = effectiveSectionStyle(section, device);
  const configuredColumns = sectionColumnCount(section.layout);
  const previewColumns = compact ? 1 : device === 'tablet' && configuredColumns === 3 ? 2 : configuredColumns;
  const layoutGap = sectionLayoutGap(responsiveSection);
  const layoutAlign = sectionLayoutAlign(section);
  const visibleElements = section.elements.filter((element) => section.type !== 'contact' || element.type !== 'button');
  const previewContainers = (section.containers || []).filter((container) => visibleElements.some((element) => element.containerId === container.id));
  const previewEntries: Array<{ kind: 'element'; element: WebsiteElement; sourceIndex: number } | { kind: 'container'; container: WebsiteElementContainer; elements: WebsiteElement[]; sourceIndex: number }> = [];
  const seenContainers = new Set<string>();
  visibleElements.forEach((element, sourceIndex) => {
    const container = element.containerId ? previewContainers.find((item) => item.id === element.containerId) : undefined;
    if (!container) {
      previewEntries.push({ kind: 'element', element, sourceIndex });
      return;
    }
    if (seenContainers.has(container.id)) return;
    seenContainers.add(container.id);
    previewEntries.push({ kind: 'container', container, elements: visibleElements.filter((item) => item.containerId === container.id), sourceIndex });
  });
  const contactSubmitElement = section.type === 'contact' ? section.elements.find((element) => element.type === 'button') : undefined;
  const contactSubmitStyle = contactSubmitElement ? effectiveStyle(contactSubmitElement, device) : undefined;
  const sectionMinHeight = sectionVisualNumber(responsiveSection.minHeight, 0, 0, 1200);
  const sectionPaddingY = sectionVisualNumber(responsiveSection.sectionPaddingY, theme.sectionSpacing, 0, 240);
  const sectionPaddingX = sectionVisualNumber(responsiveSection.sectionPaddingX, compact ? 20 : 40, 0, 160);
  const sectionRadius = sectionVisualNumber(section.sectionRadius, 0, 0, 80);
  const sectionFullWidth = sectionContentWidth(section) === 'full';

  const renderSelectedElementToolbar = (element: WebsiteElement) => {
    if (selectedElementId !== element.id) return null;
    const elementStyle = effectiveStyle(element, device);
    const width = clampElementNumber(elementStyle.width, 100, 10, 100);
    const positionX = clampElementNumber(elementStyle.positionX, 0, -4000, 4000);
    const positionY = clampElementNumber(elementStyle.positionY, 0, -4000, 4000);
    const hasFreePosition = positionX !== 0 || positionY !== 0;
    const directEditHint = element.type === 'image'
      ? 'Double-click replace'
      : element.type === 'video' || element.type === 'embed'
        ? 'Double-click source'
        : element.type === 'heading' || element.type === 'text' || element.type === 'button'
          ? 'Double-click edit'
          : null;
    return (
      <div
        draggable={false}
        className="absolute -top-9 z-40 flex max-w-full items-center gap-0.5 rounded-md border border-white/10 bg-[#111122]/95 p-0.5 shadow-lg backdrop-blur"
        style={{
          right: `${Math.max(0, 100 - width)}%`,
          transform: `translate3d(${positionX}px, ${positionY}px, 0)`,
        }}
        title="Drag to move · Arrows nudge · Shift+arrow 10px · Ctrl/Cmd+D duplicate · Delete remove · Esc deselect · Shift+drag reorder"
        onDragStart={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <MousePointer2 className="ml-1 h-3 w-3 shrink-0 text-gray-500" />
        <span className="max-w-20 truncate px-1 text-[8px] font-bold text-violet-300">{ELEMENT_LABELS[element.type]}</span>
        {directEditHint && (
          <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[7px] font-semibold text-cyan-300">{directEditHint}</span>
        )}
        {hasFreePosition && (
          <span className="max-w-24 truncate rounded bg-white/5 px-1 py-0.5 text-[7px] font-semibold text-gray-400">
            X {positionX} · Y {positionY}
          </span>
        )}
        {element.type === 'button' && (
          <button
            type="button"
            onClick={() => {
              const next = window.prompt('Button link', element.href || '#');
              if (next !== null) onQuickUpdateElement(element.id, { href: next.trim() || '#' });
            }}
            className="rounded p-1 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200"
            title="Edit button link"
          >
            <Link className="h-3.5 w-3.5" />
          </button>
        )}
        {element.type === 'image' && (
          <button type="button" onClick={onOpenMediaLibrary} className="rounded p-1 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200" title="Open media library">
            <Images className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onOpenInspector} className="rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white" title="Open inspector">
          <Palette className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDuplicateSelectedElement} className="rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white" title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </button>
        {hasFreePosition && (
          <button type="button" onClick={() => onResetElementPosition(element.id)} className="rounded p-1 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200" title="Reset position">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onDeleteSelectedElement} className="rounded p-1 text-red-300 hover:bg-red-500/15 hover:text-red-200" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderSelectedElementResizeHandle = (element: WebsiteElement) => {
    if (selectedElementId !== element.id) return null;
    const elementStyle = effectiveStyle(element, device);
    const width = clampElementNumber(elementStyle.width, 100, 10, 100);
    const positionX = clampElementNumber(elementStyle.positionX, 0, -4000, 4000);
    const positionY = clampElementNumber(elementStyle.positionY, 0, -4000, 4000);

    return (
      <>
        <div
          className="pointer-events-none absolute z-30 border-r-2 border-violet-400/80"
          style={{
            left: `calc(${width}% + ${positionX}px)`,
            top: `calc(8px + ${positionY}px)`,
            bottom: `calc(8px - ${positionY}px)`,
          }}
        />
        <button
          type="button"
          draggable={false}
          aria-label="Resize element"
          title={`Drag to resize · ${Math.round(width)}%`}
          className="absolute z-50 h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-white bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.18)] transition hover:scale-125"
          style={{
            left: `calc(${width}% + ${positionX}px - 7px)`,
            top: `calc(50% + ${positionY}px - 7px)`,
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const host = event.currentTarget.parentElement;
            if (!host) return;
            const hostWidth = Math.max(1, host.getBoundingClientRect().width);
            const startClientX = event.clientX;
            const startWidth = width;
            onResizeElementStart(element.id);

            const handleMove = (moveEvent: PointerEvent) => {
              const deltaPercent = ((moveEvent.clientX - startClientX) / hostWidth) * 100;
              const nextWidth = Math.max(10, Math.min(100, Math.round(startWidth + deltaPercent)));
              onResizeElementWidth(element.id, nextWidth);
            };
            const handleUp = () => {
              window.removeEventListener('pointermove', handleMove);
              window.removeEventListener('pointerup', handleUp);
            };
            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp, { once: true });
          }}
        />
      </>
    );
  };

  return (
    <section
      id={sectionDomId(section)}
      onClick={onSelect}
      className={`relative group cursor-pointer border border-transparent transition-all duration-150 ${selected ? 'ring-2 ring-violet-500/70 ring-inset' : 'hover:ring-1 hover:ring-violet-400/35 hover:ring-inset'}`}
      style={{
        background: sectionBackgroundCss(section),
        minHeight: sectionMinHeight ? `${sectionMinHeight}px` : undefined,
        borderRadius: `${sectionRadius}px`,
        overflow: 'hidden',
      }}
    >
      {selected && !selectedElementId && (
        <>
          <div className="absolute left-2 top-2 z-30 flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-lg">
            <MousePointer2 className="h-3 w-3" /> {SECTION_LABELS[section.type]}
          </div>
          <div
            draggable={false}
            className="absolute right-2 top-2 z-30 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#111122]/95 p-1 shadow-xl backdrop-blur"
            onDragStart={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => onMoveSection('up')} disabled={!canMoveSectionUp} className="rounded-md p-1.5 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30" title="Move section up">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onMoveSection('down')} disabled={!canMoveSectionDown} className="rounded-md p-1.5 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30" title="Move section down">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDeleteSection} disabled={!canDeleteSection} className="rounded-md p-1.5 text-red-300 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-30" title="Delete section">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
      <div
        className="mx-auto min-h-[260px] w-full"
        style={{
          maxWidth: sectionFullWidth || compact ? undefined : `${theme.contentWidth}px`,
          paddingTop: `${sectionPaddingY}px`,
          paddingBottom: `${sectionPaddingY}px`,
          paddingLeft: `${sectionPaddingX}px`,
          paddingRight: `${sectionPaddingX}px`,
        }}
      >
        <div
          className={previewColumns === 1 ? 'flex w-full flex-col justify-center' : 'grid w-full content-center'}
          style={previewColumns === 1
            ? { gap: `${layoutGap}px`, alignItems: layoutAlign }
            : { gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))`, gap: `${layoutGap}px`, justifyItems: layoutAlign }}
        >
          {previewEntries.map((entry) => {
            if (entry.kind === 'container') {
              const first = entry.elements[0];
              const fallbackColumn = previewColumns === 1 ? 1 : Math.min(previewColumns, elementColumn(first, entry.sourceIndex, configuredColumns));
              const column = containerColumn(entry.container, fallbackColumn, previewColumns);
              const span = containerColumnSpan(entry.container, column, previewColumns);
              const alignItems = entry.container.align === 'start' ? 'flex-start' : entry.container.align === 'end' ? 'flex-end' : entry.container.align === 'stretch' ? 'stretch' : 'center';
              return (
                <div
                  key={entry.container.id}
                  className="relative flex min-w-0 w-full flex-col"
                  style={{ gridColumn: previewColumns === 1 ? '1 / span 1' : `${column} / span ${span}` }}
                >
                  <div className="absolute -top-2 left-2 z-20 rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{entry.container.name}</div>
                  <div
                    className="flex min-w-0 w-full"
                    style={{
                      flexDirection: entry.container.layout === 'row' && device !== 'mobile' ? 'row' : 'column',
                      flexWrap: entry.container.layout === 'row' ? 'wrap' : undefined,
                      gap: `${clampElementNumber(entry.container.gap, 16, 0, 80)}px`,
                      alignItems,
                      background: entry.container.backgroundColor || 'transparent',
                      padding: `${clampElementNumber(entry.container.padding, 20, 0, 120)}px`,
                      borderRadius: `${clampElementNumber(entry.container.borderRadius, 16, 0, 120)}px`,
                      borderWidth: `${clampElementNumber(entry.container.borderWidth, 1, 0, 16)}px`,
                      borderStyle: 'solid',
                      borderColor: entry.container.borderColor || 'transparent',
                      boxShadow: elementShadowCss(entry.container.shadow),
                    }}
                  >
                    {entry.elements.map((element) => {
                      const elementLayoutStyle = effectiveStyle(element, device);
                      const hiddenOnDevice = elementLayoutStyle.hidden === true;
                      return (
                        <div
                          key={element.id}
                          className="relative flex min-w-0 flex-col"
                          style={{
                            flex: entry.container.layout === 'row' && device !== 'mobile' ? '1 1 180px' : '0 0 auto',
                            width: '100%',
                            order: clampElementNumber(elementLayoutStyle.order, 0, -50, 50),
                            marginTop: `${clampElementNumber(elementLayoutStyle.marginTop, 0, -200, 400)}px`,
                            marginRight: `${clampElementNumber(elementLayoutStyle.marginRight, 0, -200, 400)}px`,
                            marginBottom: `${clampElementNumber(elementLayoutStyle.marginBottom, 0, -200, 400)}px`,
                            marginLeft: `${clampElementNumber(elementLayoutStyle.marginLeft, 0, -200, 400)}px`,
                            opacity: hiddenOnDevice ? 0.32 : 1,
                          }}
                        >
                          {dragOverElementId === element.id && dragOverElementPosition && draggedElementId !== element.id && (
                            <span className={`pointer-events-none absolute left-0 right-0 z-50 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)] ${dragOverElementPosition === 'before' ? '-top-2' : '-bottom-2'}`} />
                          )}
                          {hiddenOnDevice && <span className="absolute right-1 top-1 z-20 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">Hidden on {device}</span>}
                          {renderSelectedElementToolbar(element)}
                          {renderSelectedElementResizeHandle(element)}
                          <ElementPreview
                            element={element}
                            selected={selectedElementId === element.id}
                            dragging={draggedElementId === element.id}
                            dragOver={dragOverElementId === element.id && draggedElementId !== element.id}
                            device={device}
                            onSelect={() => onSelectElement(element.id)}
                            onDragStart={(e) => onElementDragStart(element.id, e)}
                            onDragMove={(e) => onElementDragMove(element.id, e)}
                            onDragOver={(e) => onElementDragOver(element.id, e)}
                            onDrop={(e) => onElementDrop(element.id, e)}
                            onDragEnd={onElementDragEnd}
                            onInlineContentChange={(content) => onInlineContentChange(element.id, content)}
                            onInlineSourceChange={(src) => onInlineSourceChange(element.id, src)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const element = entry.element;
            const column = previewColumns === 1 ? 1 : Math.min(previewColumns, elementColumn(element, entry.sourceIndex, configuredColumns));
            const elementLayoutStyle = effectiveStyle(element, device);
            const span = elementColumnSpan(elementLayoutStyle, column, previewColumns);
            const selfAlign = elementLayoutStyle.alignSelf === 'start' || elementLayoutStyle.alignSelf === 'center' || elementLayoutStyle.alignSelf === 'end' || elementLayoutStyle.alignSelf === 'stretch'
              ? elementLayoutStyle.alignSelf
              : undefined;
            const hiddenOnDevice = elementLayoutStyle.hidden === true;
            const wrapperStyle: React.CSSProperties = {
              gridColumn: previewColumns === 1 ? '1 / span 1' : `${column} / span ${span}`,
              alignItems: layoutAlign,
              order: clampElementNumber(elementLayoutStyle.order, 0, -50, 50),
              marginTop: `${clampElementNumber(elementLayoutStyle.marginTop, 0, -200, 400)}px`,
              marginRight: `${clampElementNumber(elementLayoutStyle.marginRight, 0, -200, 400)}px`,
              marginBottom: `${clampElementNumber(elementLayoutStyle.marginBottom, 0, -200, 400)}px`,
              marginLeft: `${clampElementNumber(elementLayoutStyle.marginLeft, 0, -200, 400)}px`,
              maxWidth: elementLayoutStyle.maxWidth ? `${clampElementNumber(elementLayoutStyle.maxWidth, 0, 0, 2000)}px` : undefined,
              alignSelf: selfAlign,
              justifySelf: selfAlign,
              opacity: hiddenOnDevice ? 0.32 : 1,
            };
            return (
              <div key={element.id} className="relative flex min-w-0 w-full flex-col" style={wrapperStyle}>
                {dragOverElementId === element.id && dragOverElementPosition && draggedElementId !== element.id && (
                  <span className={`pointer-events-none absolute left-0 right-0 z-50 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)] ${dragOverElementPosition === 'before' ? '-top-2' : '-bottom-2'}`} />
                )}
                {hiddenOnDevice && (
                  <span className="absolute right-1 top-1 z-20 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">Hidden on {device}</span>
                )}
                {renderSelectedElementToolbar(element)}
                {renderSelectedElementResizeHandle(element)}
                <ElementPreview
                  element={element}
                  selected={selectedElementId === element.id}
                  dragging={draggedElementId === element.id}
                  dragOver={dragOverElementId === element.id && draggedElementId !== element.id}
                  device={device}
                  onSelect={() => onSelectElement(element.id)}
                  onDragStart={(e) => onElementDragStart(element.id, e)}
                  onDragMove={(e) => onElementDragMove(element.id, e)}
                  onDragOver={(e) => onElementDragOver(element.id, e)}
                  onDrop={(e) => onElementDrop(element.id, e)}
                  onDragEnd={onElementDragEnd}
                  onInlineContentChange={(content) => onInlineContentChange(element.id, content)}
                  onInlineSourceChange={(src) => onInlineSourceChange(element.id, src)}
                />
              </div>
            );
          })}
        </div>
        {selected && (
          <div className="flex justify-center px-4 pb-4 pt-2">
            <details
              className="relative"
              draggable={false}
              onDragStart={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-violet-400/30 bg-[#111122]/90 px-3 py-1.5 text-[10px] font-bold text-violet-200 shadow-lg backdrop-blur hover:bg-violet-500/15 [&::-webkit-details-marker]:hidden">
                <Plus className="h-3.5 w-3.5" /> Add element
              </summary>
              <div className="absolute bottom-9 left-1/2 z-50 grid w-52 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#111122] p-2 shadow-2xl">
                {(['heading', 'text', 'button', 'image'] as WebsiteElementType[]).map((type) => (
                  <button key={type} type="button" onClick={() => onAddElement(type)} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">
                    + {ELEMENT_LABELS[type]}
                  </button>
                ))}
                <button type="button" onClick={() => onAddElement('spacer')} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">+ {ELEMENT_LABELS.spacer}</button>
                <button type="button" onClick={() => onAddElement('divider')} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">+ {ELEMENT_LABELS.divider}</button>
              </div>
            </details>
          </div>
        )}
                {section.type === 'contact' && (
          <div className={`mx-auto mt-5 grid w-full max-w-xl gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 ${compact ? 'text-xs' : 'text-sm'}`}>
            {(section.formFields ?? createDefaultContactFormFields()).map((field) => (
              field.type === 'checkbox' ? (
                <label key={field.id} className="flex items-center gap-2 text-left text-gray-300">
                  <input type="checkbox" disabled className="h-4 w-4" />
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                </label>
              ) : field.type === 'textarea' ? (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <textarea disabled rows={3} placeholder={field.placeholder} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400" />
                </label>
              ) : field.type === 'select' ? (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <select disabled className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400">
                    <option>{field.placeholder || 'Choose an option'}</option>
                  </select>
                </label>
              ) : (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <input disabled type={field.type === 'email' || field.type === 'tel' ? field.type : 'text'} placeholder={field.placeholder} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400" />
                </label>
              )
            ))}
            <div className="relative">
              {contactSubmitElement && renderSelectedElementToolbar(contactSubmitElement)}
              {contactSubmitElement && renderSelectedElementResizeHandle(contactSubmitElement)}
            {contactSubmitStyle?.hidden ? (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); if (contactSubmitElement) onSelectElement(contactSubmitElement.id); }}
                className={`rounded-lg border border-dashed border-amber-400/60 px-4 py-3 text-xs font-semibold text-amber-300 ${selectedElementId === contactSubmitElement?.id ? 'ring-2 ring-violet-400' : ''}`}
              >
                Submit button hidden on {device}
              </button>
            ) : (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); if (contactSubmitElement) onSelectElement(contactSubmitElement.id); }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!contactSubmitElement) return;
                  onSelectElement(contactSubmitElement.id);
                  const nextText = window.prompt('Button text', contactSubmitElement.content || '')?.trim();
                  if (nextText && nextText !== contactSubmitElement.content) onInlineContentChange(contactSubmitElement.id, nextText);
                }}
                title="Double-click to edit button text"
                className={`font-semibold opacity-90 transition ${selectedElementId === contactSubmitElement?.id ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent' : 'hover:ring-1 hover:ring-violet-400/40'}`}
                style={{
                  color: contactSubmitStyle?.color || '#ffffff',
                  background: contactSubmitStyle?.backgroundColor || section.accent,
                  fontSize: contactSubmitStyle?.fontSize ? `${contactSubmitStyle.fontSize}px` : undefined,
                  fontWeight: contactSubmitStyle?.fontWeight,
                  padding: `${clampElementNumber(contactSubmitStyle?.padding, 12, 0, 160)}px`,
                  borderRadius: `${clampElementNumber(contactSubmitStyle?.borderRadius, theme.buttonRadius, 0, 160)}px`,
                  width: contactSubmitStyle?.width ? `${clampElementNumber(contactSubmitStyle.width, 100, 0, 100)}%` : undefined,
                  maxWidth: contactSubmitStyle?.maxWidth ? `${clampElementNumber(contactSubmitStyle.maxWidth, 0, 0, 2000)}px` : undefined,
                  marginTop: `${clampElementNumber(contactSubmitStyle?.marginTop, 0, -200, 400)}px`,
                  marginRight: `${clampElementNumber(contactSubmitStyle?.marginRight, 0, -200, 400)}px`,
                  marginBottom: `${clampElementNumber(contactSubmitStyle?.marginBottom, 0, -200, 400)}px`,
                  marginLeft: `${clampElementNumber(contactSubmitStyle?.marginLeft, 0, -200, 400)}px`,
                  order: clampElementNumber(contactSubmitStyle?.order, 0, -50, 50),
                }}
              >
                {contactSubmitElement?.content || section.buttonText || 'Send Message'}
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

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
  const [aiPlan, setAiPlan] = useState<{ summary: string; pages: Array<{ name: string; sections: number }> } | null>(null);
  const [aiMessages, setAiMessages] = useState<AIBuilderMessage[]>([
    {
      id: 'ai-welcome',
      role: 'assistant',
      content: 'Describe the website you want. I will plan the pages, build the structure and hand it to the visual editor.',
    },
  ]);
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
  const draggedSectionRef = useRef<string | null>(null);
  const draggedElementRef = useRef<string | null>(null);
  const draggedElementSectionRef = useRef<string | null>(null);
  const freeElementDragRef = useRef<{
    sectionId: string;
    elementId: string;
    symbolId?: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
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
  const aiOperationSequenceRef = useRef(0);
  const aiQualityOperationSequenceRef = useRef(0);
  const cloudProjectsRefreshSequenceRef = useRef(0);
  const cloudProjectsRefreshAbortControllerRef = useRef<AbortController | null>(null);
  const publishOperationSequenceRef = useRef(0);
  const previewOperationSequenceRef = useRef(0);
  const liveVerificationSequenceRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const reusableRefreshSequenceRef = useRef(0);
  const reusableOperationSequenceRef = useRef(0);
  const mediaRefreshSequenceRef = useRef(0);
  const mediaOperationSequenceRef = useRef(0);
  const billingRefreshSequenceRef = useRef(0);
  const billingOperationSequenceRef = useRef(0);
  const saveProjectRef = useRef<(options?: { automatic?: boolean; createHistory?: boolean }) => Promise<boolean>>(async () => false);

  activeUserIdRef.current = user?.id ?? null;

  useEffect(() => {
    reusableOperationSequenceRef.current += 1;
    mediaOperationSequenceRef.current += 1;
    billingRefreshSequenceRef.current += 1;
    billingOperationSequenceRef.current += 1;
    aiOperationSequenceRef.current += 1;
    aiQualityOperationSequenceRef.current += 1;
    setReusableBusy(false);
    setMediaLoading(false);
    setMediaUploading(false);
    setBillingLoading(false);
    setBillingBusy(false);
    setAiBusy(false);
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
    publishOperationSequenceRef.current += 1;
    previewOperationSequenceRef.current += 1;
    liveVerificationSequenceRef.current += 1;
    aiOperationSequenceRef.current += 1;
    aiQualityOperationSequenceRef.current += 1;
    setCloudBusy(false);
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
      if (!window.confirm(`Restore the recovery snapshot from ${parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : 'the previous edit'}?`)) return;
      saveRecoverySnapshot('before recovery restore');
      skipNextAutosaveRef.current = true;
      applyProjectData(parsed.project);
      setAutoSaveStatus('saving');
      setSaved(false);
      setOperationsOpen(false);
    } catch {
      window.alert('The recovery snapshot could not be restored.');
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
    const section = cloneSectionWithFreshIds(template.section);
    setSections((current) => [...current, section]);
    setSelectedId(section.id);
    setSelectedElementId(section.elements[0]?.id ?? null);
    setSaved(false);
  }

  async function deleteReusableSection(template: ReusableSectionTemplate) {
    if (!window.confirm(`Delete reusable section “${template.title}”?`)) return;
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
  function applyThemeToSection(section: WebsiteSection, index: number): WebsiteSection {
    const background = section.type === 'footer'
      ? theme.secondaryColor
      : index % 2 === 0 ? theme.backgroundColor : theme.secondaryColor;
    return {
      ...section,
      background,
      accent: theme.primaryColor,
      elements: section.elements.map((element) => {
        if (element.type === 'heading') {
          return { ...element, style: { ...element.style, color: theme.textColor } };
        }
        if (element.type === 'text') {
          return { ...element, style: { ...element.style, color: theme.mutedTextColor } };
        }
        if (element.type === 'button') {
          return { ...element, style: { ...element.style, backgroundColor: theme.primaryColor, borderRadius: theme.buttonRadius } };
        }
        return element;
      }),
    };
  }

  function applyThemeToCurrentPage() {
    remember(sections);
    setSections(sections.map((section, index) => applyThemeToSection(section, index)));
    setSaved(false);
  }

  function applyThemeToAllPages() {
    remember(sections, 'Apply theme to all pages');
    const currentPages = getCurrentPages();
    const nextPages = currentPages.map((page) => ({
      ...page,
      sections: page.sections.map((section, index) => applyThemeToSection(section, index)),
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

  async function verifyPublishedRoute(url: string): Promise<boolean> {
    if (!url) return false;

    // Vite dev does not run the Vercel /api proxy. Storage verification remains
    // useful locally, while production verifies the exact URL customers open.
    if (import.meta.env.DEV) return true;

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'text/html' },
      });

      if (!response.ok) return false;

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html')) return false;
      if (response.headers.get('x-tayar-published-site') !== '1') return false;

      const body = await response.text();
      const head = body.slice(0, 4096);
      return /<!doctype\s+html|<html(?:\s|>)/i.test(head);
    } catch {
      return false;
    }
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
    newProjectIntentRef.current = false;
    setCloudProjectId(project.id);
    saveActiveWebsiteProjectId(project.id);

    const identifiedContent = {
      ...project.content,
      cloudProjectId: project.id,
    };

    saveLocalWebsiteProject(identifiedContent);

    await refreshProjectTeamAccess(project.id, loadSequence);
    if (projectLoadSequenceRef.current !== loadSequence) return;

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
    const confirmed = window.confirm('Delete this lead permanently?');
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

    const uploadSequence = ++mediaOperationSequenceRef.current;
    const uploadProjectSequence = projectLoadSequenceRef.current;
    const uploadIsCurrentUser = () =>
      mediaOperationSequenceRef.current === uploadSequence &&
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
    if (!window.confirm(`Delete ${asset.name} from your media library?`)) return;

    const deleteSequence = ++mediaOperationSequenceRef.current;
    const deleteProjectSequence = projectLoadSequenceRef.current;
    const deleteIsCurrentUser = () =>
      mediaOperationSequenceRef.current === deleteSequence &&
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

  const canvasKeyboardActionsRef = useRef({
    duplicate: duplicateSelectedElement,
    remove: deleteSelectedElement,
    nudge: nudgeSelectedElement,
  });
  canvasKeyboardActionsRef.current = {
    duplicate: duplicateSelectedElement,
    remove: deleteSelectedElement,
    nudge: nudgeSelectedElement,
  };

  useEffect(() => {
    if (!selectedSection || !selectedElement) return;

    const handleCanvasKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return;

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

    window.addEventListener('keydown', handleCanvasKeyDown);
    return () => window.removeEventListener('keydown', handleCanvasKeyDown);
  }, [selectedSection, selectedElement]);

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
    return {
      ...productionConfig,
      customCss: billingEntitlements.features.customCss ? productionConfig.customCss : '',
      ga4Id: billingEntitlements.features.productionIntegrations ? productionConfig.ga4Id : '',
      gtmId: billingEntitlements.features.productionIntegrations ? productionConfig.gtmId : '',
      metaPixelId: billingEntitlements.features.productionIntegrations ? productionConfig.metaPixelId : '',
      plausibleDomain: billingEntitlements.features.productionIntegrations ? productionConfig.plausibleDomain : '',
    };
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

    const raw = data as Record<string, unknown>;
    const rawPlan = raw.plan === 'business' ? 'business' : raw.plan === 'pro' ? 'pro' : 'free';
    const rawEntitlements = raw.entitlements && typeof raw.entitlements === 'object'
      ? raw.entitlements as Record<string, unknown>
      : {};
    const rawFeatures = rawEntitlements.features && typeof rawEntitlements.features === 'object'
      ? rawEntitlements.features as Partial<Record<BillingFeature, boolean>>
      : {};
    const local = LOCAL_BILLING_ENTITLEMENTS[rawPlan];
    const entitlements: BillingEntitlements = {
      plan: rawPlan,
      maxPages: Number(rawEntitlements.maxPages) || local.maxPages,
      maxWebsiteProjects: Number(rawEntitlements.maxWebsiteProjects) || local.maxWebsiteProjects,
      maxReleaseHistory: Number(rawEntitlements.maxReleaseHistory) || local.maxReleaseHistory,
      maxLeads: Number(rawEntitlements.maxLeads) || local.maxLeads,
      maxAnalyticsEvents: Number(rawEntitlements.maxAnalyticsEvents) || local.maxAnalyticsEvents,
      features: { ...local.features, ...rawFeatures },
    };
    const rawUsage = raw.usage && typeof raw.usage === 'object' ? raw.usage as Record<string, unknown> : {};

    setBillingState({
      plan: rawPlan,
      entitlements,
      subscription: raw.subscription && typeof raw.subscription === 'object' ? raw.subscription as BillingSubscriptionSnapshot : null,
      usage: {
        websiteProjects: Number(rawUsage.websiteProjects) || 0,
        pages: pages.length,
        releases: Number(rawUsage.releases) || 0,
        leads: Number(rawUsage.leads) || 0,
        analyticsEvents: Number(rawUsage.analyticsEvents) || 0,
      },
    });
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
    setBillingOpen(true);
    if (billingResult === 'success') {
      setBillingError('Payment completed. Stripe is syncing your subscription; refresh billing if the badge does not update immediately.');
      window.setTimeout(() => void refreshBilling(cloudProjectId), 1200);
    } else if (billingResult === 'canceled') {
      setBillingError('Checkout was canceled. Your current plan was not changed.');
    }
    params.delete('billing');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [cloudProjectId, refreshBilling]);

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
    const timer = window.setTimeout(() => { void saveProjectRef.current({ automatic: true, createHistory: false }); }, 600);
    return () => window.clearTimeout(timer);
  }, [networkOnline, cloudSyncFailed, user?.id, projectTeamAccess.canEdit]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery('');
        return;
      }
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); void saveProject(); }
      else if (key === 'z' && event.shiftKey) { event.preventDefault(); redo(); }
      else if (key === 'z') { event.preventDefault(); undo(); }
      else if (key === 'p' && event.shiftKey) { event.preventDefault(); previewWebsite(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  useEffect(() => {
    setPages((current) => current.map((page) =>
      page.id === activePageId ? { ...page, sections } : page
    ));
  }, [sections, activePageId]);

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
    setAutoSaveStatus('saving');
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
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

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0] ?? null,
    [pages, activePageId]
  );

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
    setActivePageId(target.id);
    setSections(target.sections);
    setSelectedId(target.sections[0]?.id ?? null);
    setSelectedElementId(target.sections[0]?.elements[0]?.id ?? null);
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
    setPages((current) => [...current, page]);
    setActivePageId(page.id);
    setSections(page.sections);
    setSelectedId(page.sections[0]?.id ?? null);
    setSelectedElementId(page.sections[0]?.elements[0]?.id ?? null);
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
    const clonedSections = activePage.sections.map(cloneSectionWithFreshIds);
    const page: WebsitePage = {
      ...activePage,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${activePage.name} Copy`,
      slug,
      sections: clonedSections,
      showInNavigation: false,
      canonicalUrl: '',
    };
    setPages((current) => [...current, page]);
    setActivePageId(page.id);
    setSections(clonedSections);
    setSelectedId(clonedSections[0]?.id ?? null);
    setSelectedElementId(clonedSections[0]?.elements[0]?.id ?? null);
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
      window.alert(`A ${PAGE_LANGUAGE_LABELS[language]} version already exists in this translation group.`);
      return;
    }
    const used = new Set(pages.map((page) => normalizeSlug(page.slug)));
    const base = `${normalizeSlug(activePage.slug)}-${language}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const clonedSections = activePage.sections.map(cloneSectionWithFreshIds);
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
    setPages((current) => current
      .map((item) => item.id === activePage.id ? { ...item, translationKey: groupKey } : item)
      .concat(page));
    setActivePageId(page.id);
    setSections(clonedSections);
    setSelectedId(clonedSections[0]?.id ?? null);
    setSelectedElementId(clonedSections[0]?.elements[0]?.id ?? null);
    setSaved(false);
  }

  function updateActivePageMeta(changes: Partial<Pick<WebsitePage, 'name' | 'slug' | 'showInNavigation' | 'seoTitle' | 'seoDescription' | 'socialImage' | 'canonicalUrl' | 'language' | 'translationKey' | 'noIndex'>>) {
    remember(sections, 'Edit page settings');
    setPages((current) => current.map((page) => {
      if (page.id !== activePageId) return page;
      return {
        ...page,
        ...changes,
        slug: changes.slug !== undefined ? normalizeSlug(changes.slug) : page.slug,
      };
    }));
    setSaved(false);
  }

  function movePage(pageId: string, direction: 'up' | 'down') {
    remember(sections, 'Move page');
    setPages((current) => {
      const index = current.findIndex((page) => page.id === pageId);
      if (index === -1) return current;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
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
    setPages(remaining);
    if (activePageId === homePageId) setHomePageId(next.id);
    setActivePageId(next.id);
    setSections(next.sections);
    setSelectedId(next.sections[0]?.id ?? null);
    setSelectedElementId(next.sections[0]?.elements[0]?.id ?? null);
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
    const redoEntry = createEditHistoryEntry(previous.label);
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [redoEntry, ...current].slice(0, 50));
    skipNextAutosaveRef.current = true;
    applyProjectData(previous.snapshot, false, false);
    setSaved(false);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    const undoEntry = createEditHistoryEntry(next.label);
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
    const currentEntry = createEditHistoryEntry('Current state before history restore');
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
    setSelectedId(sectionId);
    setSelectedElementId(element.id);
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
    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    remember(sections);
  }

  function resizeElementWidth(sectionId: string, elementId: string, width: number) {
    const targetSection = sections.find((section) => section.id === sectionId);
    const targetElement = targetSection?.elements.find((element) => element.id === elementId);
    if (!targetSection || !targetElement) return;
    const symbolId = targetElement.symbolId;
    const safeWidth = Math.max(10, Math.min(100, Math.round(width)));

    const resizeElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          width: safeWidth,
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
    const currentStyle = effectiveStyle(selectedElement, device);
    const currentX = clampElementNumber(currentStyle.positionX, 0, -4000, 4000);
    const currentY = clampElementNumber(currentStyle.positionY, 0, -4000, 4000);
    const nextX = Math.max(-4000, Math.min(4000, currentX + deltaX));
    const nextY = Math.max(-4000, Math.min(4000, currentY + deltaY));
    if (nextX === currentX && nextY === currentY) return;

    remember(sections);
    const symbolId = selectedElement.symbolId;
    const moveElement = (element: WebsiteElement): WebsiteElement => ({
      ...element,
      responsive: {
        ...element.responsive,
        [device]: {
          ...(element.responsive?.[device] || {}),
          positionX: nextX,
          positionY: nextY,
        },
      },
    });
    const moveSection = (section: WebsiteSection): WebsiteSection => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = symbolId ? element.symbolId === symbolId : element.id === selectedElement.id;
        return matches ? moveElement(element) : element;
      }),
    });

    setSections((current) => current.map((section) => section.id === selectedSection.id || symbolId ? moveSection(section) : section));
    if (symbolId) {
      setPages((current) => current.map((page) => page.id === activePageId ? page : {
        ...page,
        sections: page.sections.map(moveSection),
      }));
      setSymbols((current) => current.map((symbol) => symbol.id === symbolId ? {
        ...symbol,
        element: moveElement(symbol.element),
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
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
    remember(sections);
    const remaining = selectedSection.elements.filter((element) => element.id !== selectedElementId);
    setSections((current) => current.map((section) =>
      section.id === selectedSection.id ? { ...section, elements: remaining } : section
    ));
    setSelectedElementId(remaining[0]?.id ?? null);
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
    const index = selectedSection.elements.findIndex((element) => element.id === selectedElement.id);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const elements = [...section.elements];
      elements.splice(index + 1, 0, duplicate);
      return { ...section, elements };
    }));
    setSelectedElementId(duplicate.id);
    setSaved(false);
  }

  function createContainerForSelected() {
    if (!selectedSection || !selectedElement) return;
    remember(sections);
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
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, containerId: id } : element),
    } : section));
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
    setSymbols((current) => [symbol, ...current].slice(0, 50));
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

    setSelectedElementId(instance.id);
    setSelectedContainerId(null);
    setSelectedFormFieldId(null);
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
    if (!window.confirm('Delete this component? Existing instances will become normal elements.')) return;
    remember(sections, 'Delete reusable component');
    setSymbols((current) => current.filter((symbol) => symbol.id !== symbolId));
    const detach = (section: WebsiteSection) => ({
      ...section,
      elements: section.elements.map((element) => element.symbolId === symbolId ? { ...element, symbolId: undefined } : element),
    });
    setSections((current) => current.map(detach));
    setPages((current) => current.map((page) => ({ ...page, sections: page.sections.map(detach) })));
    setSaved(false);
  }

  function resetSelectedElementResponsive() {
    if (!selectedSection || !selectedElementId) return;
    remember(sections);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      return {
        ...section,
        elements: section.elements.map((element) => {
          if (element.id !== selectedElementId) return element;
          const responsive = { ...(element.responsive || {}) };
          delete responsive[device];
          return { ...element, responsive };
        }),
      };
    }));
    setSaved(false);
  }

  function moveSelectedElement(direction: 'up' | 'down') {
    if (!selectedSection || !selectedElementId) return;
    const index = selectedSection.elements.findIndex((element) => element.id === selectedElementId);
    if (index === -1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= selectedSection.elements.length) return;

    remember(sections);
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section;
      const elements = [...section.elements];
      [elements[index], elements[target]] = [elements[target], elements[index]];
      return { ...section, elements };
    }));
    setSaved(false);
  }

  function handleElementDragStart(sectionId: string, id: string, e: React.DragEvent) {
    const sourceSection = sections.find((section) => section.id === sectionId);
    const sourceElement = sourceSection?.elements.find((element) => element.id === id);
    if (!sourceSection || !sourceElement) return;
    remember(sections);
    draggedElementRef.current = id;
    draggedElementSectionRef.current = sectionId;
    const sourceStyle = effectiveStyle(sourceElement, device);
    freeElementDragRef.current = {
      sectionId,
      elementId: id,
      symbolId: sourceElement.symbolId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: clampElementNumber(sourceStyle.positionX, 0, -4000, 4000),
      startY: clampElementNumber(sourceStyle.positionY, 0, -4000, 4000),
      currentX: clampElementNumber(sourceStyle.positionX, 0, -4000, 4000),
      currentY: clampElementNumber(sourceStyle.positionY, 0, -4000, 4000),
    };
    setDraggedElementId(id);
    setDragOverElementId(null);
    setDragOverElementPosition(null);
    setSelectedId(sectionId);
    setSelectedElementId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-tayar-element', id);
    e.dataTransfer.setData('application/x-tayar-section', sectionId);
  }

  function handleElementDragMove(sectionId: string, id: string, e: React.DragEvent) {
    const drag = freeElementDragRef.current;
    if (!drag || drag.sectionId !== sectionId || drag.elementId !== id) return;
    if (!e.clientX && !e.clientY) return;

    const nextX = Math.max(-4000, Math.min(4000, Math.round(drag.startX + (e.clientX - drag.startClientX))));
    const nextY = Math.max(-4000, Math.min(4000, Math.round(drag.startY + (e.clientY - drag.startClientY))));
    if (nextX === drag.currentX && nextY === drag.currentY) return;
    drag.currentX = nextX;
    drag.currentY = nextY;

    setSections((current) => current.map((section) => ({
      ...section,
      elements: section.elements.map((element) => {
        const matches = drag.symbolId ? element.symbolId === drag.symbolId : section.id === sectionId && element.id === id;
        if (!matches) return element;
        return {
          ...element,
          responsive: {
            ...element.responsive,
            [device]: {
              ...(element.responsive?.[device] || {}),
              positionX: nextX,
              positionY: nextY,
            },
          },
        };
      }),
    })));
    setSaved(false);
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
    if (!sourceId || !sourceSectionId || sourceId === targetId) return;

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
      draggedElementSectionRef.current = targetSectionId;
      setSelectedId(targetSectionId);

      return current.map((section) => {
        if (section.id === sourceSectionId) return { ...section, elements: section.elements.filter((element) => element.id !== sourceId) };
        if (section.id === targetSectionId) return { ...section, elements: nextTargetElements };
        return section;
      });
    });
    setSaved(false);
  }

  function handleElementDrop(targetSectionId: string, targetId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedElementRef.current || e.dataTransfer.getData('application/x-tayar-element');
    if (sourceId && e.shiftKey) {
      setSelectedId(targetSectionId);
      setSelectedElementId(sourceId);
      setDragOverElementId(targetId);
    }
    handleElementDragEnd();
  }

  function handleElementDragEnd() {
    const drag = freeElementDragRef.current;
    if (drag?.symbolId) {
      setPages((current) => current.map((page) => ({
        ...page,
        sections: page.sections.map((section) => ({
          ...section,
          elements: section.elements.map((element) => element.symbolId === drag.symbolId ? {
            ...element,
            responsive: {
              ...element.responsive,
              [device]: {
                ...(element.responsive?.[device] || {}),
                positionX: drag.currentX,
                positionY: drag.currentY,
              },
            },
          } : element),
        })),
      })));
      setSymbols((current) => current.map((symbol) => symbol.id === drag.symbolId ? {
        ...symbol,
        element: {
          ...symbol.element,
          responsive: {
            ...symbol.element.responsive,
            [device]: {
              ...(symbol.element.responsive?.[device] || {}),
              positionX: drag.currentX,
              positionY: drag.currentY,
            },
          },
        },
        updatedAt: new Date().toISOString(),
      } : symbol));
    }
    freeElementDragRef.current = null;
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
    setSelectedId(section.id);
    setSelectedElementId(section.elements[0]?.id ?? null);
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
    setSelectedId(section.id);
    setSelectedElementId(section.elements[0]?.id ?? null);
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
    setSections(nextSections);
    setSelectedId(nextSections[0]?.id ?? null);
    setSelectedElementId(nextSections[0]?.elements[0]?.id ?? null);
    setSaved(false);
  }

  function addSectionTemplate(template: SectionTemplateDefinition) {
    remember(sections);
    const section = createSectionFromTemplate(template);
    setSections((current) => [...current, section]);
    setSelectedId(section.id);
    setSelectedElementId(section.elements[0]?.id ?? null);
    setSaved(false);
  }

  function deleteSection(id: string) {
    remember(sections);
    setSections((current) => {
      if (current.length <= 1) return current;

      const index = current.findIndex((section) => section.id === id);
      const next = current.filter((section) => section.id !== id);

      if (id === selectedId) {
        setSelectedId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id);
      }

      return next;
    });

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
    setDraggedId(id);
    setDragOverId(null);
    setDragOverSectionPosition(null);
    setSelectedId(id);
    setSelectedElementId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const sourceId = draggedSectionRef.current;
    if (!sourceId || sourceId === targetId) return;

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

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedSectionRef.current || e.dataTransfer.getData('text/plain');
    if (sourceId) setSelectedId(sourceId);
    setDragOverId(targetId);
    handleDragEnd();
  }

  function handleDragEnd() {
    draggedSectionRef.current = null;
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

  async function requestGeneratedImage(prompt: string) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) throw new Error('Image prompt is required.');
    const ai = createAIService('website-builder');
    const response = await ai.completeJSON<{ url: string; assetPath?: string; persisted?: boolean; persistenceError?: string }>(
      { action: 'generate-image', prompt: cleanPrompt },
      [],
      { temperature: 0.8, maxTokens: 1000 },
    );
    if (!response.json?.url) throw new Error('Image generation did not return an image.');
    if (user) void refreshMedia();
    return response.json;
  }

  async function generateMediaLibraryImage(
    prompt: string,
  ) {
    const cleanPrompt =
      prompt.trim();

    if (!cleanPrompt) {
      throw new Error(
        'Describe the image first.'
      );
    }

    setMediaError('');

    try {
      const generated =
        await requestGeneratedImage(
          cleanPrompt,
        );

      if (!generated.persisted) {
        throw new Error(
          generated.persistenceError ||
          'Image was generated but could not be saved to Media.'
        );
      }

      await refreshMedia();

      return generated;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate image.';

      setMediaError(message);

      throw new Error(message);
    }
  }

  async function generateWithAI(agentMode = false) {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const operationLoadSequence = projectLoadSequenceRef.current;
    const operationUserId = user?.id ?? null;
    const operationIsCurrent = () =>
      aiOperationSequenceRef.current === operationSequence &&
      projectLoadSequenceRef.current === operationLoadSequence &&
      activeUserIdRef.current === operationUserId;

    const requestId = `ai-request-${Date.now()}`;
    pushProjectCheckpoint(agentMode ? 'Before Tayar Agent build' : 'Before AI build');
    setAiBusy(true);
    setAiError('');
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
        { temperature: 0.65, maxTokens: 9000 },
      );

      if (!operationIsCurrent()) return;

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
        throw new Error('AI returned an invalid website plan. Please try a more specific description.');
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
        throw new Error('AI did not return usable pages or sections. Please try again.');
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
            const generatedImage = await requestGeneratedImage(target.prompt);
            if (!operationIsCurrent()) return;
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
            if (!operationIsCurrent()) return;
            // Agent image generation is best-effort; the site remains fully editable if the image provider is unavailable.
          }
        }
      }

      const firstPage = nextPages[0];
      const totalSections = nextPages.reduce((sum, page) => sum + page.sections.length, 0);
      const summary = generated.summary?.trim() || `${nextPages.length} page website with ${totalSections} structured sections.`;

      if (!operationIsCurrent()) return;

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
      setAiUndoSnapshot(null);
      setAiQualityReview(null);
      setSaved(false);
      setAiPrompt('');
      setAiStage('ready');
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
      if (!operationIsCurrent()) return;
      const message = error instanceof Error ? error.message : 'AI generation failed.';
      setAiError(message);
      setAiStage('error');
      setAiMessages((current) => [
        ...current,
        { id: `ai-error-${Date.now()}`, role: 'assistant' as const, content: message },
      ].slice(-12));
    } finally {
      if (operationIsCurrent()) setAiBusy(false);
    }
  }

  function buildAIEditableSnapshot() {
    return {
      siteName,
      activePageId,
      homePageId,
      selection: {
        pageId: activePageId,
        sectionId: selectedId,
        elementId: selectedElementId,
        device,
      },
      seo: {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords.slice(0, 20),
      },
      header: {
        enabled: headerConfig.enabled,
        sticky: headerConfig.sticky,
        mobileMenu: headerConfig.mobileMenu,
        languageSwitcher: headerConfig.languageSwitcher,
        brandText: headerConfig.brandText,
        logoUrl: headerConfig.logoUrl,
        showCta: headerConfig.showCta,
        ctaLabel: headerConfig.ctaLabel,
        ctaHref: headerConfig.ctaHref,
        backgroundColor: headerConfig.backgroundColor,
        textColor: headerConfig.textColor,
        activeColor: headerConfig.activeColor,
        hoverColor: headerConfig.hoverColor,
        ctaBackgroundColor: headerConfig.ctaBackgroundColor,
        ctaTextColor: headerConfig.ctaTextColor,
        navGap: headerConfig.navGap,
        brandSize: headerConfig.brandSize,
        navSize: headerConfig.navSize,
        borderColor: headerConfig.borderColor,
      },
      theme: {
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        mutedTextColor: theme.mutedTextColor,
        fontFamily: theme.fontFamily,
        contentWidth: theme.contentWidth,
        buttonRadius: theme.buttonRadius,
        sectionSpacing: theme.sectionSpacing,
      },
      symbols: symbols.slice(0, 50).map((symbol) => ({
        id: symbol.id,
        name: symbol.name,
        type: symbol.element.type,
        content: symbol.element.content,
      })),
      pages: getCurrentPages().map((page) => ({
        id: page.id,
        name: page.name,
        slug: page.slug,
        showInNavigation: page.showInNavigation,
        seoTitle: page.seoTitle || '',
        seoDescription: page.seoDescription || '',
        canonicalUrl: page.canonicalUrl || '',
        noIndex: page.noIndex === true,
        sections: page.sections.map((section) => ({
          id: section.id,
          type: section.type,
          title: section.title,
          description: section.description,
          buttonText: section.buttonText,
          buttonUrl: section.buttonUrl,
          background: section.background,
          accent: section.accent,
          image: section.image,
          imagePrompt: section.imagePrompt,
          backgroundMode: section.backgroundMode,
          backgroundImage: section.backgroundImage,
          backgroundPosition: section.backgroundPosition,
          backgroundSize: section.backgroundSize,
          gradientFrom: section.gradientFrom,
          gradientTo: section.gradientTo,
          gradientAngle: section.gradientAngle,
          overlayColor: section.overlayColor,
          overlayOpacity: section.overlayOpacity,
          sectionRadius: section.sectionRadius,
          anchorId: section.anchorId,
          layout: section.layout,
          layoutAlign: section.layoutAlign,
          contentWidth: section.contentWidth,
          minHeight: section.minHeight,
          sectionPaddingY: section.sectionPaddingY,
          sectionPaddingX: section.sectionPaddingX,
          layoutGap: section.layoutGap,
          responsive: section.responsive || {},
          containers: (section.containers || []).slice(0, 30).map((container) => ({
            id: container.id,
            name: container.name,
            layout: container.layout,
            gap: container.gap,
            align: container.align,
            backgroundColor: container.backgroundColor,
            padding: container.padding,
            borderRadius: container.borderRadius,
            borderWidth: container.borderWidth,
            borderColor: container.borderColor,
            shadow: container.shadow,
            layoutColumn: container.layoutColumn,
            columnSpan: container.columnSpan,
          })),
          form: section.type === 'contact' ? {
            successMessage: section.formSuccessMessage || '',
            successAction: section.formSuccessAction || 'message',
            redirectUrl: section.formRedirectUrl || '',
            fields: (section.formFields || createDefaultContactFormFields()).slice(0, 20).map((field) => ({
              id: field.id,
              name: field.name,
              label: field.label,
              type: field.type,
              placeholder: field.placeholder || '',
              required: field.required,
              options: field.options || [],
            })),
          } : undefined,
          elements: section.elements.slice(0, 20).map((element) => ({
            id: element.id,
            type: element.type,
            content: element.content,
            href: element.href,
            src: element.src,
            layoutColumn: element.layoutColumn,
            containerId: element.containerId,
            symbolId: element.symbolId,
            animationOnce: element.animationOnce,
            style: element.style,
            responsive: element.responsive || {},
          })),
        })),
      })),
    };
  }

  function undoLastAIChange() {
    if (!aiUndoSnapshot || aiBusy) return;
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
    setAiUndoSnapshot(null);
    setAiStage('ready');
    setSaved(false);
    setAiMessages((current) => [
      ...current,
      { id: `ai-undo-${Date.now()}`, role: 'assistant' as const, content: 'Reverted the last AI change.' },
    ].slice(-12));
  }

  async function applyAIChange(requestedPrompt?: string) {
    const prompt = typeof requestedPrompt === 'string' ? requestedPrompt.trim() : aiPrompt.trim();
    if (!prompt || aiBusy) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const operationLoadSequence = projectLoadSequenceRef.current;
    const operationUserId = user?.id ?? null;
    const operationIsCurrent = () =>
      aiOperationSequenceRef.current === operationSequence &&
      projectLoadSequenceRef.current === operationLoadSequence &&
      activeUserIdRef.current === operationUserId;

    const requestId = `ai-edit-${Date.now()}`;
    remember(sections, `AI change: ${prompt.slice(0, 60)}`);
    pushProjectCheckpoint(`Before AI change · ${prompt.slice(0, 60)}`);
    const currentPages = getCurrentPages();
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
    setAiStage('planning');
    setAiMessages((current) => [
      ...current,
      { id: requestId, role: 'user' as const, content: prompt },
    ].slice(-12));

    try {
      const ai = createAIService('website-builder');
      const editableSnapshot = buildAIEditableSnapshot();
      const planResponse = await ai.completeJSON<AIWebsiteAgentPlan>(
        {
          action: 'plan-edit',
          prompt,
          currentSite: editableSnapshot,
        },
        aiMessages.slice(-16).map((message) => ({ role: message.role, content: message.content })),
        { temperature: 0.2, maxTokens: 3500 },
      );

      if (!operationIsCurrent()) return;

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
          content: `Plan: ${planPreview}${agentPlan.warnings?.length ? ` · ${agentPlan.warnings.join(' · ')}` : ''}`,
        },
      ].slice(-30));

      const response = await ai.completeJSON<AIWebsitePatch>(
        {
          action: 'edit',
          prompt,
          currentSite: editableSnapshot,
          executionPlan: agentPlan,
        },
        aiMessages.slice(-16).map((message) => ({ role: message.role, content: message.content })),
        { temperature: 0.25, maxTokens: 12000 },
      );

      if (!operationIsCurrent()) return;

      let patch = response.json;
      if (!patch && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        patch = JSON.parse(cleaned) as AIWebsitePatch;
      }

      const operations = Array.isArray(patch?.operations) ? patch.operations.slice(0, 60) : [];
      if (!patch || operations.length === 0) {
        throw new Error('AI did not return any safe website changes. Try a more specific request.');
      }

      const destructiveActions = new Set([
        'remove_page', 'remove_section', 'remove_container', 'remove_element', 'remove_form_field',
      ]);
      const destructiveOperations = operations.filter((operation) => operation && destructiveActions.has(operation.action));
      const removesPage = destructiveOperations.some((operation) => operation.action === 'remove_page');
      if (removesPage || destructiveOperations.length >= 3) {
        const confirmed = window.confirm(
          `Tayar AI wants to run ${destructiveOperations.length} destructive change${destructiveOperations.length === 1 ? '' : 's'}. Continue?`
        );
        if (!confirmed) {
          setAiStage('ready');
          setAiMessages((current) => [
            ...current,
            { id: `ai-cancel-${Date.now()}`, role: 'assistant' as const, content: 'AI change cancelled before destructive operations were applied.' },
          ].slice(-20));
          return;
        }
      }

      setAiStage('building');

      const allowedTypes = new Set<SectionType>([
        'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
      ]);
      const allowedElementTypes = new Set<WebsiteElementType>([
        'heading', 'text', 'button', 'image', 'video', 'list', 'divider', 'spacer',
        'accordion', 'tabs', 'gallery', 'embed', 'code', 'countdown', 'stats', 'testimonials-slider',
      ]);
      const allowedShadows = new Set<ElementShadow>(['none', 'sm', 'md', 'lg', 'xl']);
      const allowedAnimations = new Set<ElementAnimation>(['none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in', 'zoom-out']);
      const allowedFormFieldTypes = new Set<WebsiteFormFieldType>(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']);
      const validHex = (value?: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');
      const finiteStyleNumber = (value: unknown, min: number, max: number) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
      const normalizeSlugValue = (value: string) => value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const updateSectionContent = (section: WebsiteSection, changes: AIWebsitePatchChanges): WebsiteSection => {
        const next: WebsiteSection = {
          ...section,
          title: typeof changes.title === 'string' ? changes.title.trim() : section.title,
          description: typeof changes.description === 'string' ? changes.description.trim() : section.description,
          buttonText: typeof changes.buttonText === 'string' ? changes.buttonText.trim() : section.buttonText,
          buttonUrl: typeof changes.buttonUrl === 'string' ? changes.buttonUrl.trim() : section.buttonUrl,
          background: validHex(changes.background) ? changes.background! : section.background,
          accent: validHex(changes.accent) ? changes.accent! : section.accent,
          image: typeof changes.image === 'string' ? changes.image.trim() || undefined : section.image,
          imagePrompt: typeof changes.imagePrompt === 'string' ? changes.imagePrompt.trim() || undefined : section.imagePrompt,
        };

        return {
          ...next,
          elements: section.elements.map((element) => {
            if (changes.title !== undefined && element.type === 'heading') {
              return { ...element, content: next.title };
            }
            if (changes.description !== undefined && element.type === 'text') {
              return { ...element, content: next.description };
            }
            if (element.type === 'button') {
              return {
                ...element,
                content: changes.buttonText !== undefined ? next.buttonText : element.content,
                href: changes.buttonUrl !== undefined ? next.buttonUrl : element.href,
                style: changes.accent !== undefined
                  ? { ...element.style, backgroundColor: next.accent }
                  : element.style,
              };
            }
            return element;
          }),
        };
      };

      const validateAIProjectIntegrity = (candidatePages: WebsitePage[], expectedHomePageId: string, candidateSymbols: WebsiteSymbol[]): string[] => {
        const errors: string[] = [];
        if (!candidatePages.length) return ['The project must keep at least one page.'];
        const pageIds = new Set<string>();
        const sectionIds = new Set<string>();
        const elementIds = new Set<string>();

        for (const page of candidatePages) {
          if (!page.id || pageIds.has(page.id)) errors.push(`Duplicate or missing page id: ${page.id || 'unknown'}.`);
          pageIds.add(page.id);
          if (!Array.isArray(page.sections) || page.sections.length === 0) {
            errors.push(`${page.name || page.id}: page must contain at least one section.`);
            continue;
          }

          for (const section of page.sections) {
            if (!section.id || sectionIds.has(section.id)) errors.push(`Duplicate or missing section id: ${section.id || 'unknown'}.`);
            sectionIds.add(section.id);
            if (!Array.isArray(section.elements) || section.elements.length === 0) {
              errors.push(`${page.name}: section ${section.id || section.type} must keep at least one editable element.`);
              continue;
            }

            const containerIds = new Set<string>();
            for (const container of section.containers || []) {
              if (!container.id || containerIds.has(container.id)) errors.push(`${page.name}: duplicate or missing container id in ${section.id}.`);
              containerIds.add(container.id);
            }

            for (const element of section.elements) {
              if (!element.id || elementIds.has(element.id)) errors.push(`Duplicate or missing element id: ${element.id || 'unknown'}.`);
              elementIds.add(element.id);
              if (element.containerId && !containerIds.has(element.containerId)) {
                errors.push(`${page.name}: element ${element.id} points to missing container ${element.containerId}.`);
              }
            }
          }
        }

        if (!candidatePages.some((page) => page.id === expectedHomePageId)) errors.push('The selected home page no longer exists.');

        const symbolIds = new Set<string>();
        for (const symbol of candidateSymbols) {
          if (!symbol.id || symbolIds.has(symbol.id)) errors.push(`Duplicate or missing reusable component id: ${symbol.id || 'unknown'}.`);
          symbolIds.add(symbol.id);
        }
        for (const page of candidatePages) {
          for (const section of page.sections) {
            for (const element of section.elements) {
              if (element.symbolId && !symbolIds.has(element.symbolId)) errors.push(`${page.name}: element ${element.id} points to missing reusable component ${element.symbolId}.`);
            }
          }
        }
        return [...new Set(errors)].slice(0, 20);
      };

      let nextPages = JSON.parse(JSON.stringify(currentPages)) as WebsitePage[];
      let nextSiteName = siteName;
      let nextHomePageId = homePageId;
      let nextTheme = { ...theme };
      let nextSeo: WebsiteSEO = { ...seo, keywords: [...seo.keywords] };
      let nextHeaderConfig: WebsiteHeaderConfig = { ...headerConfig };
      let nextSymbols = JSON.parse(JSON.stringify(symbols)) as WebsiteSymbol[];
      let applied = 0;

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

      const cloneElementForAI = (element: WebsiteElement, containerIdMap?: Map<string, string>): WebsiteElement => ({
        ...element,
        id: `${element.type}-ai-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        style: { ...element.style },
        responsive: element.responsive
          ? JSON.parse(JSON.stringify(element.responsive)) as WebsiteElement['responsive']
          : undefined,
        containerId: element.containerId
          ? (containerIdMap ? containerIdMap.get(element.containerId) : element.containerId)
          : undefined,
        symbolId: undefined,
      });

      const cloneSectionForAI = (section: WebsiteSection): WebsiteSection => {
        const containerIdMap = new Map<string, string>();
        const clonedContainers = (section.containers || []).map((container, index) => {
          const nextId = `container-ai-copy-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
          containerIdMap.set(container.id, nextId);
          return { ...container, id: nextId };
        });
        const clonedFields = Array.isArray(section.formFields)
          ? section.formFields.map((field, index) => ({
              ...field,
              id: `field-ai-copy-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
              options: Array.isArray(field.options) ? [...field.options] : field.options,
            }))
          : section.formFields;
        return normalizeSection({
          ...section,
          id: `${section.type}-ai-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          anchorId: undefined,
          containers: clonedContainers,
          formFields: clonedFields,
          elements: section.elements.map((element) => cloneElementForAI(element, containerIdMap)),
        });
      };

      for (const operation of operations) {
        if (!operation || typeof operation.action !== 'string') continue;

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
          nextPages.push({
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
          });
          applied += 1;
          continue;
        }

        if (operation.action === 'duplicate_page') {
          if (nextPages.length >= billingEntitlements.maxPages || (!operation.pageId && !operation.pageSlug)) continue;
          const sourceIndex = resolvePageIndex(operation);
          if (sourceIndex < 0 || sourceIndex >= nextPages.length) continue;
          const sourcePage = nextPages[sourceIndex];
          const changes = operation.changes || {};
          const requestedName = typeof changes.name === 'string' && changes.name.trim()
            ? changes.name.trim().slice(0, 60)
            : `${sourcePage.name} Copy`;
          const requestedSlug = typeof changes.slug === 'string' && changes.slug.trim()
            ? normalizeSlugValue(changes.slug)
            : normalizeSlugValue(`${sourcePage.slug}-copy`);
          const clonedPage: WebsitePage = {
            ...sourcePage,
            id: `page-ai-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: requestedName,
            slug: requestedSlug || `page-copy-${Date.now()}`,
            sections: sourcePage.sections.map((section) => cloneSectionForAI(section)),
            translationKey: '',
            canonicalUrl: '',
          };
          nextPages.splice(sourceIndex + 1, 0, clonedPage);
          applied += 1;
          continue;
        }

        if (operation.action === 'remove_page') {
          if (nextPages.length <= 1 || (!operation.pageId && !operation.pageSlug)) continue;
          const pageIndex = resolvePageIndex(operation);
          if (pageIndex < 0 || pageIndex >= nextPages.length) continue;
          const targetPage = nextPages[pageIndex];
          if (targetPage.id === nextHomePageId) continue;
          nextPages.splice(pageIndex, 1);
          applied += 1;
          continue;
        }

        if (operation.action === 'set_home_page') {
          if (!operation.pageId && !operation.pageSlug) continue;
          const pageIndex = resolvePageIndex(operation);
          if (pageIndex < 0 || pageIndex >= nextPages.length) continue;
          const targetPage = nextPages[pageIndex];
          if (targetPage.id !== nextHomePageId) {
            nextHomePageId = targetPage.id;
            applied += 1;
          }
          continue;
        }

        if (operation.action === 'move_page') {
          if (!operation.pageId || (!operation.beforePageId && !operation.afterPageId)) continue;
          const sourceIndex = nextPages.findIndex((page) => page.id === operation.pageId);
          if (sourceIndex < 0) continue;
          const sourcePage = nextPages[sourceIndex];
          const withoutSource = nextPages.filter((page) => page.id !== sourcePage.id);
          const destinationId = operation.beforePageId || operation.afterPageId || '';
          const destinationIndex = withoutSource.findIndex((page) => page.id === destinationId);
          if (destinationIndex < 0) continue;
          const insertAt = destinationIndex + (operation.afterPageId ? 1 : 0);
          withoutSource.splice(Math.min(insertAt, withoutSource.length), 0, sourcePage);
          nextPages = withoutSource;
          applied += 1;
          continue;
        }

        if (operation.action === 'update_theme') {
          const changes = operation.changes || {};
          const next = normalizeTheme({
            ...nextTheme,
            primaryColor: validHex(changes.primaryColor) ? changes.primaryColor : nextTheme.primaryColor,
            secondaryColor: validHex(changes.secondaryColor) ? changes.secondaryColor : nextTheme.secondaryColor,
            backgroundColor: validHex(changes.backgroundColor) ? changes.backgroundColor : nextTheme.backgroundColor,
            textColor: validHex(changes.textColor) ? changes.textColor : nextTheme.textColor,
            mutedTextColor: validHex(changes.mutedTextColor) ? changes.mutedTextColor : nextTheme.mutedTextColor,
            fontFamily: typeof changes.fontFamily === 'string' && FONT_OPTIONS.includes(changes.fontFamily)
              ? changes.fontFamily
              : nextTheme.fontFamily,
            contentWidth: finiteStyleNumber(changes.themeContentWidth, 720, 1440) ?? nextTheme.contentWidth,
            buttonRadius: finiteStyleNumber(changes.themeButtonRadius, 0, 40) ?? nextTheme.buttonRadius,
            sectionSpacing: finiteStyleNumber(changes.themeSectionSpacing, 40, 140) ?? nextTheme.sectionSpacing,
          });
          if (JSON.stringify(next) !== JSON.stringify(nextTheme)) {
            nextTheme = next;
            applied += 1;
          }
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

        if (operation.action === 'update_seo') {
          const changes = operation.changes || {};
          const nextTitle = typeof changes.seoTitle === 'string' ? changes.seoTitle.trim().slice(0, 120) : nextSeo.title;
          const nextDescription = typeof changes.seoDescription === 'string' ? changes.seoDescription.trim().slice(0, 300) : nextSeo.description;
          const nextKeywords = Array.isArray(changes.seoKeywords)
            ? changes.seoKeywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 20)
            : nextSeo.keywords;
          if (nextTitle !== nextSeo.title || nextDescription !== nextSeo.description || JSON.stringify(nextKeywords) !== JSON.stringify(nextSeo.keywords)) {
            nextSeo = { title: nextTitle, description: nextDescription, keywords: nextKeywords };
            applied += 1;
          }
          continue;
        }

        if (operation.action === 'update_header') {
          const changes = operation.changes || {};
          const requestedLogo = typeof changes.headerLogoUrl === 'string' ? changes.headerLogoUrl.trim().slice(0, 2000) : '';
          const safeLogo = requestedLogo && /^(?:https?:\/\/|\/)/i.test(requestedLogo) ? requestedLogo : undefined;
          const next: WebsiteHeaderConfig = {
            ...nextHeaderConfig,
            enabled: typeof changes.headerEnabled === 'boolean' ? changes.headerEnabled : nextHeaderConfig.enabled,
            sticky: typeof changes.headerSticky === 'boolean' ? changes.headerSticky : nextHeaderConfig.sticky,
            mobileMenu: typeof changes.headerMobileMenu === 'boolean' ? changes.headerMobileMenu : nextHeaderConfig.mobileMenu,
            languageSwitcher: typeof changes.headerLanguageSwitcher === 'boolean' ? changes.headerLanguageSwitcher : nextHeaderConfig.languageSwitcher,
            brandText: typeof changes.headerBrandText === 'string' ? changes.headerBrandText.trim().slice(0, 100) : nextHeaderConfig.brandText,
            logoUrl: safeLogo !== undefined ? safeLogo : nextHeaderConfig.logoUrl,
            showCta: typeof changes.showCta === 'boolean' ? changes.showCta : nextHeaderConfig.showCta,
            ctaLabel: typeof changes.ctaLabel === 'string' ? changes.ctaLabel.trim().slice(0, 80) : nextHeaderConfig.ctaLabel,
            ctaHref: typeof changes.ctaHref === 'string' ? changes.ctaHref.trim().slice(0, 500) : nextHeaderConfig.ctaHref,
            backgroundColor: validHex(changes.headerBackgroundColor) ? changes.headerBackgroundColor! : nextHeaderConfig.backgroundColor,
            textColor: validHex(changes.headerTextColor) ? changes.headerTextColor! : nextHeaderConfig.textColor,
            activeColor: validHex(changes.headerActiveColor) ? changes.headerActiveColor! : nextHeaderConfig.activeColor,
            hoverColor: validHex(changes.headerHoverColor) ? changes.headerHoverColor! : nextHeaderConfig.hoverColor,
            ctaBackgroundColor: validHex(changes.headerCtaBackgroundColor) ? changes.headerCtaBackgroundColor! : nextHeaderConfig.ctaBackgroundColor,
            ctaTextColor: validHex(changes.headerCtaTextColor) ? changes.headerCtaTextColor! : nextHeaderConfig.ctaTextColor,
            navGap: finiteStyleNumber(changes.headerNavGap, 0, 64) ?? nextHeaderConfig.navGap,
            brandSize: finiteStyleNumber(changes.headerBrandSize, 10, 42) ?? nextHeaderConfig.brandSize,
            navSize: finiteStyleNumber(changes.headerNavSize, 10, 32) ?? nextHeaderConfig.navSize,
            borderColor: validHex(changes.headerBorderColor) ? changes.headerBorderColor! : nextHeaderConfig.borderColor,
          };
          if (JSON.stringify(next) !== JSON.stringify(nextHeaderConfig)) {
            nextHeaderConfig = next;
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

        if (operation.action === 'update_page') {
          const changes = operation.changes || {};
          const nextName = typeof changes.name === 'string' && changes.name.trim()
            ? changes.name.trim().slice(0, 60)
            : page.name;
          const requestedSlug = typeof changes.slug === 'string' ? normalizeSlugValue(changes.slug) : '';
          const nextSlug = requestedSlug || page.slug;
          nextPages[pageIndex] = {
            ...page,
            name: nextName,
            slug: nextSlug,
            showInNavigation: typeof changes.showInNavigation === 'boolean'
              ? changes.showInNavigation
              : page.showInNavigation,
            seoTitle: typeof changes.seoTitle === 'string' ? changes.seoTitle.trim().slice(0, 120) : page.seoTitle,
            seoDescription: typeof changes.seoDescription === 'string' ? changes.seoDescription.trim().slice(0, 300) : page.seoDescription,
            canonicalUrl: typeof changes.canonicalUrl === 'string' ? changes.canonicalUrl.trim().slice(0, 500) : page.canonicalUrl,
            noIndex: typeof changes.noIndex === 'boolean' ? changes.noIndex : page.noIndex,
          };
          applied += 1;
          continue;
        }

        if (operation.action === 'duplicate_section') {
          if (!operation.sectionId || page.sections.length >= 20) continue;
          const sourceIndex = page.sections.findIndex((section) => section.id === operation.sectionId);
          if (sourceIndex < 0) continue;
          const sourceSection = page.sections[sourceIndex];
          const clonedSection = cloneSectionForAI(sourceSection);
          const sectionList = [...page.sections];
          const beforeIndex = operation.beforeSectionId
            ? sectionList.findIndex((section) => section.id === operation.beforeSectionId)
            : -1;
          const afterIndex = operation.afterSectionId
            ? sectionList.findIndex((section) => section.id === operation.afterSectionId)
            : -1;
          const insertAt = beforeIndex >= 0
            ? beforeIndex
            : afterIndex >= 0
              ? afterIndex + 1
              : sourceIndex + 1;
          sectionList.splice(Math.min(Math.max(insertAt, 0), sectionList.length), 0, clonedSection);
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'move_section') {
          if (!operation.sectionId || (!operation.beforeSectionId && !operation.afterSectionId)) continue;
          const sourceIndex = page.sections.findIndex((section) => section.id === operation.sectionId);
          if (sourceIndex < 0) continue;
          const sourceSection = page.sections[sourceIndex];
          const withoutSource = page.sections.filter((section) => section.id !== sourceSection.id);
          const destinationId = operation.beforeSectionId || operation.afterSectionId || '';
          const destinationIndex = withoutSource.findIndex((section) => section.id === destinationId);
          if (destinationIndex < 0) continue;
          const insertAt = destinationIndex + (operation.afterSectionId ? 1 : 0);
          withoutSource.splice(Math.min(insertAt, withoutSource.length), 0, sourceSection);
          nextPages[pageIndex] = { ...page, sections: withoutSource };
          applied += 1;
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
          const sectionList = [...page.sections];
          const requestedAfter = operation.afterSectionId
            ? sectionList.findIndex((section) => section.id === operation.afterSectionId)
            : -1;
          const footerIndex = sectionList.findIndex((section) => section.type === 'footer');
          const insertAt = requestedAfter >= 0
            ? requestedAfter + 1
            : footerIndex >= 0
              ? footerIndex
              : sectionList.length;
          sectionList.splice(insertAt, 0, created);
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        const sectionIndex = resolveSectionIndex(page, operation);
        if (sectionIndex < 0 || sectionIndex >= page.sections.length) continue;

        if (operation.action === 'add_container') {
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const existingContainers = targetSection.containers || [];
          if (existingContainers.length >= 30) continue;

          const changes = operation.changes || {};
          const columns = sectionColumnCount(targetSection.layout);
          const requestedColumn = finiteStyleNumber(changes.containerColumn, 1, columns);
          const requestedSpan = finiteStyleNumber(changes.containerColumnSpan, 1, columns);
          const container: WebsiteElementContainer = {
            id: `container-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: typeof changes.containerName === 'string' && changes.containerName.trim()
              ? changes.containerName.trim().slice(0, 80)
              : `AI Container ${existingContainers.length + 1}`,
            layout: changes.containerLayout === 'row' ? 'row' : 'stack',
            gap: finiteStyleNumber(changes.containerGap, 0, 80) ?? 16,
            align: changes.containerAlign === 'start' || changes.containerAlign === 'end' || changes.containerAlign === 'stretch'
              ? changes.containerAlign
              : 'center',
            backgroundColor: validHex(changes.containerBackgroundColor) ? changes.containerBackgroundColor! : '#ffffff08',
            padding: finiteStyleNumber(changes.containerPadding, 0, 120) ?? 20,
            borderRadius: finiteStyleNumber(changes.containerBorderRadius, 0, 120) ?? 16,
            borderWidth: finiteStyleNumber(changes.containerBorderWidth, 0, 16) ?? 1,
            borderColor: validHex(changes.containerBorderColor) ? changes.containerBorderColor! : '#ffffff18',
            shadow: changes.containerShadow && allowedShadows.has(changes.containerShadow) ? changes.containerShadow : 'none',
            layoutColumn: targetSection.layout === 'stack' ? undefined : Math.round(requestedColumn ?? 1),
            columnSpan: Math.round(requestedSpan ?? 1),
          };

          const nextElements = targetSection.elements.map((element) =>
            operation.elementId && element.id === operation.elementId && !element.symbolId
              ? { ...element, containerId: container.id }
              : element
          );

          sectionList[sectionIndex] = {
            ...targetSection,
            containers: [...existingContainers, container],
            elements: nextElements,
          };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'update_container') {
          if (!operation.containerId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const containers = [...(targetSection.containers || [])];
          const containerIndex = containers.findIndex((container) => container.id === operation.containerId);
          if (containerIndex < 0) continue;

          const current = containers[containerIndex];
          const changes = operation.changes || {};
          const columns = sectionColumnCount(targetSection.layout);
          const nextColumn = finiteStyleNumber(changes.containerColumn, 1, columns);
          const nextSpan = finiteStyleNumber(changes.containerColumnSpan, 1, columns);

          containers[containerIndex] = {
            ...current,
            name: typeof changes.containerName === 'string' && changes.containerName.trim() ? changes.containerName.trim().slice(0, 80) : current.name,
            layout: changes.containerLayout === 'row' || changes.containerLayout === 'stack' ? changes.containerLayout : current.layout,
            gap: finiteStyleNumber(changes.containerGap, 0, 80) ?? current.gap,
            align: changes.containerAlign === 'start' || changes.containerAlign === 'center' || changes.containerAlign === 'end' || changes.containerAlign === 'stretch'
              ? changes.containerAlign
              : current.align,
            backgroundColor: validHex(changes.containerBackgroundColor) ? changes.containerBackgroundColor! : current.backgroundColor,
            padding: finiteStyleNumber(changes.containerPadding, 0, 120) ?? current.padding,
            borderRadius: finiteStyleNumber(changes.containerBorderRadius, 0, 120) ?? current.borderRadius,
            borderWidth: finiteStyleNumber(changes.containerBorderWidth, 0, 16) ?? current.borderWidth,
            borderColor: validHex(changes.containerBorderColor) ? changes.containerBorderColor! : current.borderColor,
            shadow: changes.containerShadow && allowedShadows.has(changes.containerShadow) ? changes.containerShadow : current.shadow,
            layoutColumn: targetSection.layout === 'stack' ? undefined : nextColumn !== undefined ? Math.round(nextColumn) : current.layoutColumn,
            columnSpan: nextSpan !== undefined ? Math.round(nextSpan) : current.columnSpan,
          };

          sectionList[sectionIndex] = { ...targetSection, containers };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'remove_container') {
          if (!operation.containerId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (!(targetSection.containers || []).some((container) => container.id === operation.containerId)) continue;
          sectionList[sectionIndex] = {
            ...targetSection,
            containers: (targetSection.containers || []).filter((container) => container.id !== operation.containerId),
            elements: targetSection.elements.map((element) =>
              element.containerId === operation.containerId ? { ...element, containerId: undefined } : element
            ),
          };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'assign_element_container') {
          if (!operation.elementId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const elementIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (elementIndex < 0 || targetSection.elements[elementIndex].symbolId) continue;

          const targetContainer = operation.containerId
            ? (targetSection.containers || []).find((container) => container.id === operation.containerId)
            : undefined;
          if (operation.containerId && !targetContainer) continue;

          const elements = [...targetSection.elements];
          elements[elementIndex] = { ...elements[elementIndex], containerId: targetContainer?.id };
          sectionList[sectionIndex] = { ...targetSection, elements };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'create_symbol') {
          if (!operation.elementId || nextSymbols.length >= 50) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const elementIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (elementIndex < 0) continue;
          const targetElement = targetSection.elements[elementIndex];
          if (targetElement.symbolId) continue;

          const symbolId = `symbol-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const symbolName = typeof operation.symbolName === 'string' && operation.symbolName.trim()
            ? operation.symbolName.trim().slice(0, 80)
            : (targetElement.content?.trim().slice(0, 60) || ELEMENT_LABELS[targetElement.type] || 'Reusable component');
          const symbol: WebsiteSymbol = {
            id: symbolId,
            name: symbolName,
            element: cloneSymbolElement(targetElement),
            updatedAt: new Date().toISOString(),
          };
          nextSymbols = [symbol, ...nextSymbols].slice(0, 50);

          const elements = [...targetSection.elements];
          elements[elementIndex] = { ...targetElement, symbolId };
          sectionList[sectionIndex] = { ...targetSection, elements };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'insert_symbol') {
          if (!operation.symbolId) continue;
          const symbol = nextSymbols.find((item) => item.id === operation.symbolId);
          if (!symbol) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.elements.length >= 60) continue;

          const instance: WebsiteElement = {
            ...JSON.parse(JSON.stringify(symbol.element)) as WebsiteElement,
            id: `${symbol.element.type}-ai-symbol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            symbolId: symbol.id,
            containerId: undefined,
            layoutColumn: targetSection.layout === 'stack' ? undefined : 1,
          };
          const elements = [...targetSection.elements];
          const beforeIndex = operation.beforeElementId ? elements.findIndex((element) => element.id === operation.beforeElementId) : -1;
          const afterIndex = operation.afterElementId ? elements.findIndex((element) => element.id === operation.afterElementId) : -1;
          const insertAt = beforeIndex >= 0 ? beforeIndex : afterIndex >= 0 ? afterIndex + 1 : elements.length;
          elements.splice(Math.min(Math.max(insertAt, 0), elements.length), 0, instance);
          sectionList[sectionIndex] = { ...targetSection, elements };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'detach_symbol') {
          if (!operation.elementId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const elementIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (elementIndex < 0 || !targetSection.elements[elementIndex].symbolId) continue;
          const elements = [...targetSection.elements];
          elements[elementIndex] = { ...elements[elementIndex], symbolId: undefined };
          sectionList[sectionIndex] = { ...targetSection, elements };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'duplicate_element') {
          if (!operation.elementId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.elements.length >= 60) continue;
          const sourceIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (sourceIndex < 0) continue;
          const sourceElement = targetSection.elements[sourceIndex];
          const clonedElement: WebsiteElement = {
            ...cloneElementForAI(sourceElement),
            containerId: sourceElement.containerId,
          };
          const nextElements = [...targetSection.elements];
          const beforeIndex = operation.beforeElementId
            ? nextElements.findIndex((element) => element.id === operation.beforeElementId)
            : -1;
          const afterIndex = operation.afterElementId
            ? nextElements.findIndex((element) => element.id === operation.afterElementId)
            : -1;
          const insertAt = beforeIndex >= 0
            ? beforeIndex
            : afterIndex >= 0
              ? afterIndex + 1
              : sourceIndex + 1;
          nextElements.splice(Math.min(Math.max(insertAt, 0), nextElements.length), 0, clonedElement);
          sectionList[sectionIndex] = { ...targetSection, elements: nextElements };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
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

          const newElement: WebsiteElement = {
            ...created,
            content: typeof changes.elementContent === 'string' ? changes.elementContent.slice(0, 5000) : created.content,
            href: typeof changes.elementHref === 'string' ? changes.elementHref.trim().slice(0, 2000) : created.href,
            src: typeof changes.elementSrc === 'string' ? changes.elementSrc.trim().slice(0, 2000) : created.src,
            style: createdStyle,
            animationOnce: typeof changes.elementAnimationOnce === 'boolean' ? changes.elementAnimationOnce : created.animationOnce,
          };

          const nextElements = [...targetSection.elements];
          const beforeIndex = operation.beforeElementId
            ? nextElements.findIndex((element) => element.id === operation.beforeElementId)
            : -1;
          const afterIndex = operation.afterElementId
            ? nextElements.findIndex((element) => element.id === operation.afterElementId)
            : -1;
          const insertAt = beforeIndex >= 0
            ? beforeIndex
            : afterIndex >= 0
              ? afterIndex + 1
              : nextElements.length;
          nextElements.splice(Math.min(Math.max(insertAt, 0), nextElements.length), 0, newElement);

          sectionList[sectionIndex] = { ...targetSection, elements: nextElements };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'remove_element') {
          if (!operation.elementId) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.elements.length <= 1) continue;
          const elementIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (elementIndex < 0) continue;
          const targetElement = targetSection.elements[elementIndex];
          if (targetElement.symbolId) continue;

          sectionList[sectionIndex] = {
            ...targetSection,
            elements: targetSection.elements.filter((element) => element.id !== operation.elementId),
          };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
          continue;
        }

        if (operation.action === 'move_element') {
          if (!operation.elementId || (!operation.beforeElementId && !operation.afterElementId)) continue;
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          const sourceIndex = targetSection.elements.findIndex((element) => element.id === operation.elementId);
          if (sourceIndex < 0) continue;
          const sourceElement = targetSection.elements[sourceIndex];
          if (sourceElement.symbolId) continue;

          const withoutSource = targetSection.elements.filter((element) => element.id !== sourceElement.id);
          const destinationId = operation.beforeElementId || operation.afterElementId || '';
          const destinationIndex = withoutSource.findIndex((element) => element.id === destinationId);
          if (destinationIndex < 0) continue;
          const destinationElement = withoutSource[destinationIndex];
          if (destinationElement.symbolId) continue;

          const insertAt = destinationIndex + (operation.afterElementId ? 1 : 0);
          withoutSource.splice(Math.min(Math.max(insertAt, 0), withoutSource.length), 0, sourceElement);
          sectionList[sectionIndex] = { ...targetSection, elements: withoutSource };
          nextPages[pageIndex] = { ...page, sections: sectionList };
          applied += 1;
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

          const hasContentChange = typeof changes.elementContent === 'string' || typeof changes.elementHref === 'string' || typeof changes.elementSrc === 'string';
          const hasElementMetaChange = typeof changes.elementAnimationOnce === 'boolean';
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

        if (operation.action === 'update_form') {
          const sectionList = [...page.sections];
          const targetSection = sectionList[sectionIndex];
          if (targetSection.type !== 'contact') continue;
          const changes = operation.changes || {};

          sectionList[sectionIndex] = {
            ...targetSection,
            formSuccessMessage: typeof changes.formSuccessMessage === 'string'
              ? changes.formSuccessMessage.trim().slice(0, 500)
              : targetSection.formSuccessMessage,
            formSuccessAction: changes.formSuccessAction === 'redirect' ? 'redirect' : changes.formSuccessAction === 'message' ? 'message' : targetSection.formSuccessAction,
            formRedirectUrl: typeof changes.formRedirectUrl === 'string'
              ? changes.formRedirectUrl.trim().slice(0, 1000)
              : targetSection.formRedirectUrl,
          };
          nextPages[pageIndex] = { ...page, sections: sectionList };
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
            const generatedImage = await requestGeneratedImage(imagePrompt);
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

        if (operation.action === 'remove_section') {
          if (page.sections.length <= 1) continue;
          nextPages[pageIndex] = {
            ...page,
            sections: page.sections.filter((_, index) => index !== sectionIndex),
          };
          applied += 1;
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
      }

      if (applied === 0) {
        throw new Error('AI changes could not be matched safely to this website. Try naming the page or section more clearly.');
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

      let agentReview: AIWebsiteAgentReview | null = null;
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
            proposedProject,
          },
          [],
          { temperature: 0.1, maxTokens: 3200 },
        );

        if (!operationIsCurrent()) return;

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
          agentReview = {
            score,
            summary: typeof rawReview.summary === 'string' ? rawReview.summary.trim().slice(0, 300) : undefined,
            findings,
            followUpPrompt: typeof rawReview.followUpPrompt === 'string' ? rawReview.followUpPrompt.trim().slice(0, 500) : undefined,
          };
        }
      } catch {
        // Agent review is advisory. Deterministic project integrity remains the blocking safety gate.
      }

      if (!operationIsCurrent()) return;

      const integrityErrors = validateAIProjectIntegrity(nextPages, nextHomePageId, nextSymbols);
      if (integrityErrors.length) {
        throw new Error(`AI change blocked by project safety validation: ${integrityErrors.join(' ')}`);
      }

      const finalActive = nextPages.find((page) => page.id === activeAfterPatch?.id) || nextPages[0];
      if (!operationIsCurrent()) return;
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

      const handoffOperation = [...operations].reverse().find((operation) =>
        operation && typeof operation.action === 'string' &&
        !['repair_accessibility', 'repair_responsive', 'update_theme', 'restyle_site', 'update_site', 'update_seo', 'update_header'].includes(operation.action)
      );
      const handoffPage = handoffOperation?.pageId
        ? nextPages.find((candidatePage) => candidatePage.id === handoffOperation.pageId)
        : handoffOperation?.pageSlug
          ? nextPages.find((candidatePage) => normalizeSlugValue(candidatePage.slug) === normalizeSlugValue(handoffOperation.pageSlug || ''))
          : finalActive;
      const handoffSection = handoffOperation?.sectionId
        ? handoffPage?.sections.find((candidateSection) => candidateSection.id === handoffOperation.sectionId)
        : handoffPage?.sections[0];
      const handoffElement = handoffOperation?.elementId
        ? handoffSection?.elements.find((candidateElement) => candidateElement.id === handoffOperation.elementId)
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
      setAiPrompt('');
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

      const skipped = Math.max(0, operations.length - applied);
      const patchWarnings = Array.isArray(patch.warnings)
        ? patch.warnings.map((warning) => String(warning).trim()).filter(Boolean).slice(0, 5)
        : [];
      const confidence = Number.isFinite(Number(patch.confidence))
        ? Math.min(1, Math.max(0, Number(patch.confidence)))
        : null;
      const summary = patch.summary?.trim() || `Applied ${applied} targeted AI change${applied === 1 ? '' : 's'}.`;
      setAiPlan({
        summary,
        pages: nextPages.map((page) => ({ name: page.name, sections: page.sections.length })),
      });
      setAiMessages((current) => [
        ...current,
        {
          id: `ai-patch-result-${Date.now()}`,
          role: 'assistant' as const,
          content: `${summary} Planned ${(agentPlan.steps || []).length} step${(agentPlan.steps || []).length === 1 ? '' : 's'} and applied ${applied} safe native operation${applied === 1 ? '' : 's'} without rebuilding unrelated content.${skipped ? ` ${skipped} unsupported or unsafe operation${skipped === 1 ? ' was' : 's were'} skipped.` : ''}${patchWarnings.length ? ` Warnings: ${patchWarnings.join(' · ')}` : ''}${confidence !== null ? ` Confidence: ${Math.round(confidence * 100)}%.` : ''}${agentReview ? ` Agent review${typeof agentReview.score === 'number' ? ` ${agentReview.score}/100` : ''}: ${agentReview.summary || 'Review complete.'}${agentReview.findings?.length ? ` · ${agentReview.findings.map((finding) => `${finding.severity}: ${finding.title}`).join(' · ')}` : ''}${agentReview.followUpPrompt ? ` · Suggested follow-up: ${agentReview.followUpPrompt}` : ''}` : ''}`,
        },
      ].slice(-12));
    } catch (error) {
      if (!operationIsCurrent()) return;
      const message = error instanceof Error ? error.message : 'AI edit failed.';
      setAiError(message);
      setAiStage('error');
      setAiMessages((current) => [
        ...current,
        { id: `ai-patch-error-${Date.now()}`, role: 'assistant' as const, content: message },
      ].slice(-12));
    } finally {
      if (operationIsCurrent()) setAiBusy(false);
    }
  }

  async function generateRealImage() {
    if (!selectedSection || aiBusy) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const operationLoadSequence = projectLoadSequenceRef.current;
    const operationUserId = user?.id ?? null;
    const operationIsCurrent = () =>
      aiOperationSequenceRef.current === operationSequence &&
      projectLoadSequenceRef.current === operationLoadSequence &&
      activeUserIdRef.current === operationUserId;
    const targetSection = selectedSection;
    const targetElementId = selectedElement?.type === 'image' ? selectedElement.id : null;
    const existingImageId = targetElementId
      ? null
      : targetSection.elements.find((element) => element.type === 'image')?.id ?? null;

    setAiBusy(true);
    setAiError('');
    pushProjectCheckpoint(`Before AI image · ${targetSection.title || SECTION_LABELS[targetSection.type]}`);

    try {
      const generatedImage = await requestGeneratedImage(
        targetSection.imagePrompt || targetSection.title || `Professional ${targetSection.type} website image`,
      );

      if (!operationIsCurrent()) return;

      remember(sections);

      setSections((current) => current.map((section) => {
        if (section.id !== targetSection.id) return section;

        if (targetElementId) {
          return {
            ...section,
            image: generatedImage.url,
            elements: section.elements.map((element) =>
              element.id === targetElementId
                ? { ...element, src: generatedImage.url, content: targetSection.title || 'Generated image' }
                : element
            ),
          };
        }

        if (targetSection.type === 'hero') {
          return {
            ...section,
            image: generatedImage.url,
            backgroundMode: 'image',
            backgroundImage: generatedImage.url,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            overlayColor: '#000000',
            overlayOpacity: 0.42,
          };
        }

        if (existingImageId) {
          return {
            ...section,
            image: generatedImage.url,
            elements: section.elements.map((element) =>
              element.id === existingImageId
                ? { ...element, src: generatedImage.url, content: targetSection.title || 'Generated image' }
                : element
            ),
          };
        }

        const element: WebsiteElement = {
          ...createElement('image', targetSection.accent),
          src: generatedImage.url,
          content: targetSection.title || 'Generated image',
        };

        return {
          ...section,
          image: generatedImage.url,
          elements: [...section.elements, element],
        };
      }));

      setSaved(false);
      setAiMessages((current) => [
        ...current,
        { id: `ai-image-${Date.now()}`, role: 'assistant' as const, content: 'Generated the image, saved it to Media Library and applied it to the selected section.' },
      ].slice(-12));
    } catch (error) {
      if (!operationIsCurrent()) return;
      setAiError(error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
      if (operationIsCurrent()) setAiBusy(false);
    }
  }

  async function generateImagePrompt() {
    if (!selectedSection || aiBusy) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const operationLoadSequence = projectLoadSequenceRef.current;
    const operationUserId = user?.id ?? null;
    const operationIsCurrent = () =>
      aiOperationSequenceRef.current === operationSequence &&
      projectLoadSequenceRef.current === operationLoadSequence &&
      activeUserIdRef.current === operationUserId;
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
        { temperature: 0.8, maxTokens: 800 },
      );

      if (!operationIsCurrent()) return;

      if (!response.json?.prompt) {
        throw new Error('AI could not create image prompt.');
      }

      setSections((current) => current.map((section) =>
        section.id === targetSection.id
          ? { ...section, imagePrompt: response.json!.prompt }
          : section
      ));
      setSaved(false);
    } catch (error) {
      if (!operationIsCurrent()) return;
      setAiError(
        error instanceof Error
          ? error.message
          : 'Image prompt generation failed.'
      );
    } finally {
      if (operationIsCurrent()) setAiBusy(false);
    }
  }

  async function runAIQualityCheck(): Promise<AIQualityReview | null> {
    if (aiQualityBusy || aiBusy) return aiQualityReview;

    const operationSequence = ++aiQualityOperationSequenceRef.current;
    const operationLoadSequence = projectLoadSequenceRef.current;
    const operationUserId = user?.id ?? null;
    const operationIsCurrent = () =>
      aiQualityOperationSequenceRef.current === operationSequence &&
      projectLoadSequenceRef.current === operationLoadSequence &&
      activeUserIdRef.current === operationUserId;
    const currentSite = buildAIEditableSnapshot();
    const qualityAudit = {
      score: siteAudit.score,
      errors: [...siteAudit.errors],
      warnings: [...siteAudit.warnings],
      diagnostics: {
        ...qualityDiagnostics,
        warnings: [...qualityDiagnostics.warnings],
      },
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
        { temperature: 0.25, maxTokens: 5000 },
      );

      if (!operationIsCurrent()) return null;

      let review = response.json;
      if (!review && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        review = JSON.parse(cleaned) as AIQualityReview;
      }
      if (!review) throw new Error('AI quality check returned no review.');

      const normalized: AIQualityReview = {
        score: Math.max(0, Math.min(100, Number(review.score) || 0)),
        summary: String(review.summary || 'Quality review completed.').slice(0, 500),
        findings: Array.isArray(review.findings)
          ? review.findings.slice(0, 8).map((finding) => ({
              severity: finding.severity === 'critical' || finding.severity === 'warning' ? finding.severity : 'improvement',
              title: String(finding.title || 'Website improvement').slice(0, 120),
              detail: String(finding.detail || '').slice(0, 500),
            }))
          : [],
        fixPrompt: String(review.fixPrompt || '').slice(0, 5000),
      };

      if (!operationIsCurrent()) return null;
      setAiQualityReview(normalized);
      return normalized;
    } catch (error) {
      if (!operationIsCurrent()) return null;
      const message = error instanceof Error ? error.message : 'AI quality check failed.';
      setAiError(message);
      setAiQualityReview({
        score: qualityAudit.score,
        summary: 'Automated builder audit is available, but the AI review could not complete.',
        findings: [
          ...qualityAudit.errors.slice(0, 4).map((detail) => ({ severity: 'critical' as const, title: 'Publish blocker', detail })),
          ...qualityAudit.warnings.slice(0, 4).map((detail) => ({ severity: 'warning' as const, title: 'Recommended improvement', detail })),
        ].slice(0, 8),
        fixPrompt: '',
      });
      return null;
    } finally {
      if (operationIsCurrent()) setAiQualityBusy(false);
    }
  }

  async function fixAIQualityIssues() {
    if (!aiQualityReview?.fixPrompt || aiBusy) return;
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
  async function createSharePreview() {
    if (cloudProjectId && !projectTeamAccess.canPublish) {
      setPreviewError('Only the project owner can create public share previews.');
      return;
    }
    if (!user || !cloudProjectId) {
      setPreviewError('Save this project to the cloud before creating a share preview.');
      return;
    }

    const previewSequence = ++previewOperationSequenceRef.current;
    const previewLoadSequence = projectLoadSequenceRef.current;
    const previewProjectId = cloudProjectId;
    const previewUserId = user.id;
    const existingPreviewToken = previewToken;
    const previewIsCurrent = () =>
      previewOperationSequenceRef.current === previewSequence &&
      projectLoadSequenceRef.current === previewLoadSequence &&
      activeUserIdRef.current === previewUserId;

    setPreviewBusy(true);
    setPreviewError('');

    const latestSaved = await saveProject({ automatic: true, createHistory: false });

    if (!previewIsCurrent()) return;

    if (!latestSaved) {
      setPreviewError('The latest editor changes could not be synchronized before creating the preview.');
      setPreviewBusy(false);
      return;
    }

    try {
      if (existingPreviewToken) {
        const existingFolder = `${previewUserId}/${previewProjectId}/previews/${existingPreviewToken}`;
        await removePublishedWebsiteFiles(existingFolder);
        if (!previewIsCurrent()) return;
      }

      const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const folder = `${previewUserId}/${previewProjectId}/previews/${token}`;
      const publicBaseUrl = buildPreviewSiteBaseUrl(previewUserId, previewProjectId, token);
      if (!publicBaseUrl) throw new Error('Could not build the public preview URL.');

      const currentPages = getCurrentPages();
      const files: Array<{ name: string; content: string; contentType: string }> = currentPages.map((page) => ({
        name: page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`,
        content: getHtml(page.sections, page.id, publicBaseUrl, true, false),
        contentType: 'text/html; charset=utf-8',
      }));
      files.push({ name: '404.html', content: get404Html(publicBaseUrl, true, false), contentType: 'text/html; charset=utf-8' });

      await uploadPublishedWebsiteFolderFiles(folder, files);

      if (!previewIsCurrent()) return;

      const nextUrl = buildPreviewSiteUrl(previewUserId, previewProjectId, token, 'index.html');
      if (!nextUrl) throw new Error('Could not build the public preview URL.');

      const routeHealthy = await verifyPublishedRoute(nextUrl);

      if (!previewIsCurrent()) return;

      if (!routeHealthy) {
        throw new Error('Preview files were saved, but the public preview renderer did not return HTML.');
      }

      const createdAt = new Date().toISOString();
      setPreviewToken(token);
      setPreviewUrl(nextUrl);
      setPreviewCreatedAt(createdAt);
      setSaved(false);
      try { await navigator.clipboard.writeText(nextUrl); } catch { /* Clipboard access is optional. */ }
    } catch (error) {
      if (!previewIsCurrent()) return;
      setPreviewError(error instanceof Error ? error.message : 'Could not create share preview.');
    } finally {
      if (previewOperationSequenceRef.current === previewSequence) {
        setPreviewBusy(false);
      }
    }
  }
  async function revokeSharePreview(updateBusy = true) {
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
  async function rollbackPublishVersion(version: WebsitePublishVersion) {
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can rollback a published release.');
      return;
    }
    if (!window.confirm(`Rollback the live website to the release from ${new Date(version.created_at).toLocaleString()}? Your editor draft will stay unchanged.`)) return;

    const rollbackSequence = ++publishOperationSequenceRef.current;
    const rollbackLoadSequence = projectLoadSequenceRef.current;
    const rollbackProjectId = cloudProjectId;
    const rollbackUserId = user.id;
    const rollbackBaseProjectData = buildProjectData();
    const rollbackIsCurrent = () =>
      publishOperationSequenceRef.current === rollbackSequence &&
      projectLoadSequenceRef.current === rollbackLoadSequence &&
      activeUserIdRef.current === rollbackUserId;

    setPublishBusy(true);
    setPublishError('');

    try {
      const folder = `${rollbackUserId}/${rollbackProjectId}`;
      const manifest = Array.isArray(version.file_manifest) ? version.file_manifest : [];
      if (!manifest.length) throw new Error('This release has no stored files.');

      const liveNames = new Set(manifest.map((item) => item.name));
      await removeStalePublishedWebsiteFiles(folder, liveNames);

      if (!rollbackIsCurrent()) return;

      const nextPublishedBaseUrl = buildPublishedSiteBaseUrl(rollbackUserId, rollbackProjectId);
      const nextPublishedUrl = buildPublishedSiteUrl(rollbackUserId, rollbackProjectId, 'index.html');
      if (!nextPublishedBaseUrl || !nextPublishedUrl) throw new Error('Could not build the live website URL.');

      const legacyVersionUrl = normalizePublishedSiteUrl(version.published_url || '');
      const legacyVersionBase = (version.published_url || '').replace(/\/index\.html(?:[?#].*)?$/i, '');
      const canonicalVersionBase = legacyVersionUrl.replace(/\/index\.html(?:[?#].*)?$/i, '');

      for (const file of manifest) {
        if (!rollbackIsCurrent()) return;

        const { data: blob, error: downloadError } = await downloadPublishedWebsiteFile(`${version.storage_prefix}/${file.name}`);
        if (!rollbackIsCurrent()) return;
        if (downloadError || !blob) throw downloadError || new Error(`Could not restore ${file.name}`);

        let uploadBody: Blob = blob;
        const textual = /(?:text\/|application\/(?:json|xml))/i.test(file.contentType || blob.type || '') || /\.(?:html?|xml|txt|css|js|json)$/i.test(file.name);
        if (textual) {
          let text = await blob.text();
          if (!rollbackIsCurrent()) return;
          if (legacyVersionBase && legacyVersionBase !== canonicalVersionBase) {
            text = text.split(legacyVersionBase).join(nextPublishedBaseUrl);
          }
          if (canonicalVersionBase && canonicalVersionBase !== nextPublishedBaseUrl) {
            text = text.split(canonicalVersionBase).join(nextPublishedBaseUrl);
          }
          uploadBody = new Blob([text], { type: file.contentType || blob.type || 'text/plain; charset=utf-8' });
        }

        if (!rollbackIsCurrent()) return;

        const { error: uploadError } = await uploadPublishedWebsiteBlob({
          path: `${folder}/${file.name}`,
          body: uploadBody,
          contentType: file.contentType || blob.type || 'application/octet-stream',
          cacheControl: '0',
          upsert: true,
        });

        if (!rollbackIsCurrent()) return;
        if (uploadError) throw uploadError;
      }

      if (!rollbackIsCurrent()) return;

      const nextPublishedAt = new Date().toISOString();
      const projectData = {
        ...rollbackBaseProjectData,
        publishedUrl: nextPublishedUrl,
        publishedAt: nextPublishedAt,
        lastPublishedVersionId: version.id,
        lastPublishedFingerprint: version.editor_fingerprint,
        updatedAt: nextPublishedAt,
      };

      if (!rollbackIsCurrent()) return;

      const { error: projectError } = await updateWebsiteProjectPublicationState({
        projectId: rollbackProjectId,
        userId: rollbackUserId,
        content: projectData,
        published: true,
        updatedAt: nextPublishedAt,
      });

      if (!rollbackIsCurrent()) return;
      if (projectError) throw projectError;

      setCloudProjects((current) =>
        current.map((project) =>
          project.id === rollbackProjectId
            ? {
                ...project,
                content: projectData,
                status: 'completed',
                updated_at: nextPublishedAt,
              }
            : project
        )
      );
      setPublishedUrl(nextPublishedUrl);
      setPublishedAt(nextPublishedAt);
      setLastPublishedVersionId(version.id);
      setLastPublishedFingerprint(version.editor_fingerprint);
      saveLocalWebsiteProject(projectData);
      lastSavedSnapshotRef.current = '';
      setAutoSaveStatus('saved');

      await verifyLiveDeployment(
        rollbackProjectId,
        rollbackUserId,
        rollbackLoadSequence,
      );
    } catch (error) {
      if (!rollbackIsCurrent()) return;
      setPublishError(error instanceof Error ? error.message : 'Could not rollback this release.');
    } finally {
      if (publishOperationSequenceRef.current === rollbackSequence) {
        setPublishBusy(false);
      }
    }
  }
  function restorePublishVersionToEditor(version: WebsitePublishVersion) {
    if (!window.confirm('Restore this release into the editor? The live website will not change until you publish again.')) return;
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
    skipNextAutosaveRef.current = true;
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
    if (!window.confirm('Delete this stored release archive? This cannot be undone.')) return;

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
      const { error } = await deleteWebsitePublishVersionArchive({
        versionId: version.id,
        projectId: deleteProjectId,
        ownerId: deleteOwnerId,
        storagePrefix: version.storage_prefix,
        fileManifest: manifest,
      });

      if (!deleteIsCurrent()) return;
      if (error) throw error;

      setPublishVersions((current) => current.filter((item) => item.id !== version.id));
    } catch (error) {
      if (!deleteIsCurrent()) return;
      setPublishVersionsError(error instanceof Error ? error.message : 'Could not delete this release.');
    } finally {
      if (deleteIsCurrent()) {
        setPublishVersionsLoading(false);
      }
    }
  }

  async function saveProject(options: { automatic?: boolean; createHistory?: boolean } = {}): Promise<boolean> {
    const automatic = options.automatic === true;
    if (user && projectId && cloudProjectId !== projectId) {
      setCloudError('Opening your saved website. Save will continue when it is loaded.');
      return false;
    }

    if (user && !cloudProjectId) {
      const preservedProjectId = projectId || loadActiveWebsiteProjectId();
      if (preservedProjectId) {
        setCloudError('Your existing website is still reconnecting. Tayar will not create a duplicate draft while its saved identity is available.');
        setAutoSaveStatus('failed');
        return false;
      }

      if (!newProjectIntentRef.current && cloudProjectsLoaded && cloudProjects.length > 0) {
        const fallbackProject =
          cloudProjects.find((project) => project.user_id === user.id) ??
          cloudProjects[0];

        saveActiveWebsiteProjectId(fallbackProject.id);
        setCloudError('Opening your most recent saved website before saving. No duplicate draft was created.');
        setAutoSaveStatus('saving');
        void loadCloudProjectRef.current(fallbackProject.id);
        return false;
      }
    }

    const createHistory = options.createHistory ?? !automatic;
    const fingerprint = buildProjectFingerprint();

    if (user && cloudProjectId && !projectTeamAccess.canEdit) {
      setCloudError('This shared project is read-only for your Viewer role.');
      setAutoSaveStatus('failed');
      return false;
    }

    if (saveInFlightRef.current) {
      return false;
    }

    const saveLoadSequence = projectLoadSequenceRef.current;
    const saveController = new AbortController();
    const saveIsCurrent = () =>
      !saveController.signal.aborted &&
      projectLoadSequenceRef.current === saveLoadSequence;

    saveAbortControllerRef.current = saveController;
    saveInFlightRef.current = true;

    try {
      let historyEntries = projectHistory;
      if (createHistory) {
        const snapshot = buildProjectSnapshot();
        const entry = createProjectHistoryEntry(snapshot) as ProjectHistoryEntry;
        historyEntries = [entry, ...projectHistory].slice(0, 30);
      }

      const projectData = buildProjectData(historyEntries);
    const localSaved = saveLocalWebsiteProject(projectData);
    if (!localSaved) {
      setCloudError('Local recovery storage is full. Cloud save will still be attempted.');
    }

    let cloudSaved = !user;
    if (user) {
      setCloudBusy(true);
      setCloudError('');
      setAutoSaveStatus('saving');

      if (!networkOnline) {
        setCloudSyncFailed(true);
        setCloudError('You are offline. Changes are saved locally and will retry when the connection returns.');
      } else if (cloudProjectId) {
        const result = await updateWebsiteProjectInCloud({
          projectId: cloudProjectId,
          title: siteName.trim() || 'My Website',
          content: projectData,
          published: Boolean(publishedUrl),
          signal: saveController.signal,
        });

        if (!saveIsCurrent()) return false;

        if (result.error) {
          if (/limit reached/i.test(result.error.message || '')) openBillingWithMessage(result.error.message);
          setCloudError(result.error.message || (automatic ? 'Autosaved locally, but cloud autosave failed.' : 'Saved locally, but cloud save failed.'));
          setCloudSyncFailed(true);
        } else {
          cloudSaved = true;
          setCloudSyncFailed(false);
          setCloudProjects((current) =>
            current.map((project) =>
              project.id === cloudProjectId
                ? {
                    ...project,
                    title: siteName.trim() || 'My Website',
                    content: projectData,
                    status: publishedUrl ? 'completed' : 'draft',
                    updated_at: String(projectData.updatedAt || new Date().toISOString()),
                  }
                : project
            )
          );
        }
      } else {
        const result = await createWebsiteProjectInCloud({
          userId: user.id,
          title: siteName.trim() || 'My Website',
          content: projectData,
          published: Boolean(publishedUrl),
          signal: saveController.signal,
        });

        if (!saveIsCurrent()) return false;

        if (result.error || !result.data) {
          if (result.error && /limit reached/i.test(result.error.message || '')) openBillingWithMessage(result.error.message);
          setCloudError(result.error?.message || (automatic ? 'Autosaved locally, but cloud autosave failed.' : 'Saved locally, but cloud save failed.'));
          setCloudSyncFailed(true);
        } else {
          newProjectIntentRef.current = false;
          setCloudProjectId(result.data.id);
          saveActiveWebsiteProjectId(result.data.id);
          saveLocalWebsiteProject({
            ...projectData,
            cloudProjectId: result.data.id,
          });
          setProjectTeamAccess({ ...DEFAULT_EDITOR_PROJECT_ACCESS, ownerId: user.id });
          setCloudProjects((current) => [
            {
              id: result.data.id,
              user_id: user.id,
              workspace_id: null,
              title: siteName.trim() || 'My Website',
              content: projectData,
              status: publishedUrl ? 'completed' : 'draft',
              updated_at: typeof result.data.updated_at === 'string'
                ? result.data.updated_at
                : String(projectData.updatedAt || new Date().toISOString()),
            },
            ...current.filter((project) => project.id !== result.data.id),
          ]);
          cloudSaved = true;
          setCloudSyncFailed(false);
        }
      }

      if (!saveIsCurrent()) return false;
    }

    if (!saveIsCurrent()) return false;

    if (createHistory && (localSaved || cloudSaved)) {
      setProjectHistory(historyEntries);
    }

    const durableSaved = user ? cloudSaved : localSaved;
    if (durableSaved) lastSavedSnapshotRef.current = fingerprint;
    setAutoSaveStatus(durableSaved ? 'saved' : 'failed');

    if (!automatic) {
      setSaved(durableSaved);
      if (durableSaved) window.setTimeout(() => setSaved(false), 2000);
    }
    return durableSaved;
    } catch (error) {
      if (!saveController.signal.aborted && projectLoadSequenceRef.current === saveLoadSequence) {
        const message = error instanceof Error ? error.message : 'Unexpected save failure.';
        setCloudSyncFailed(Boolean(user));
        setCloudError(user ? `Save failed: ${message}` : message);
        setAutoSaveStatus('failed');
        if (!automatic) setSaved(false);
      }
      return false;
    } finally {
      if (saveAbortControllerRef.current === saveController) {
        saveAbortControllerRef.current = null;
        saveInFlightRef.current = false;
        setCloudBusy(false);
      }
    }
  }

  saveProjectRef.current = saveProject;

  async function duplicateProject() {
    if (user && billingState.usage.websiteProjects >= billingEntitlements.maxWebsiteProjects) {
      openBillingWithMessage(`Your ${BILLING_PLAN_DETAILS[billingPlan].label} plan supports ${billingEntitlements.maxWebsiteProjects} Website Builder project${billingEntitlements.maxWebsiteProjects === 1 ? '' : 's'}. Upgrade before duplicating another project.`);
      return;
    }

    cancelPendingProjectPersistence();
    projectLoadSequenceRef.current += 1;
    const duplicateLoadSequence = projectLoadSequenceRef.current;
    const duplicateUserId = user?.id ?? null;
    const duplicateIsCurrent = () =>
      projectLoadSequenceRef.current === duplicateLoadSequence &&
      activeUserIdRef.current === duplicateUserId;

    const duplicateTitle = `${siteName.trim() || 'My Website'} Copy`;
    const duplicateContent = {
      ...buildProjectSnapshot(),
      cloudProjectId: null,
      siteName: duplicateTitle,
      publishedUrl: '',
      publishedAt: null,
      previewUrl: '',
      previewToken: '',
      previewCreatedAt: null,
      lastPublishedVersionId: null,
      lastPublishedFingerprint: '',
      deliveryConfig: { ...deliveryConfig, status: 'building', approvedAt: null, approvedFingerprint: '', deliveredAt: null },
      history: [],
      updatedAt: new Date().toISOString(),
    };

    if (!user) {
      setCloudProjectId(null);
      saveActiveWebsiteProjectId(null);
      setProjectHistory([]);
      setHistory([]);
      setFuture([]);
      setSiteName(duplicateTitle);
      setPublishedUrl('');
      setPublishedAt(null);
      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setDeliveryConfig((current) => ({ ...current, status: 'building', approvedAt: null, approvedFingerprint: '', deliveredAt: null }));
      setPublishVersions([]);
      setReleaseHistoryOpen(false);
      setLiveVerification('idle');
      saveLocalWebsiteProject(duplicateContent);
      lastSavedSnapshotRef.current = '';
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      return;
    }

    if (!duplicateUserId) return;

    setCloudBusy(true);
    setCloudError('');
    const { data, error } = await createWebsiteProjectInCloud({
      userId: duplicateUserId,
      title: duplicateTitle,
      content: duplicateContent,
      published: false,
    });

    if (!duplicateIsCurrent()) return;

    if (error || !data) {
      if (error && /limit reached/i.test(error.message || '')) openBillingWithMessage(error.message);
      setCloudError(error?.message || 'Could not duplicate this project.');
      setCloudBusy(false);
      return;
    }

    newProjectIntentRef.current = false;
    setCloudProjectId(data.id);
    saveActiveWebsiteProjectId(data.id);
    setProjectHistory([]);
    setHistory([]);
    setFuture([]);
    setLeads([]);
    setLeadsOpen(false);
    setSiteName(duplicateTitle);
    setPublishedUrl('');
    setPublishedAt(null);
    setPreviewUrl('');
    setPreviewToken('');
    setPreviewCreatedAt(null);
    setLastPublishedVersionId(null);
    setLastPublishedFingerprint('');
    setDeliveryConfig((current) => ({ ...current, status: 'building', approvedAt: null, approvedFingerprint: '', deliveredAt: null }));
    setPublishVersions([]);
    setReleaseHistoryOpen(false);
    setLiveVerification('idle');
    saveLocalWebsiteProject({
      ...duplicateContent,
      cloudProjectId: data.id,
    });
    lastSavedSnapshotRef.current = '';
    await refreshCloudProjects();
    if (!duplicateIsCurrent()) return;
    setCloudBusy(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function restoreHistoryEntry(entry: ProjectHistoryEntry) {
    const confirmed = window.confirm(`Restore "${entry.label}"? Your current unsaved changes will be replaced.`);
    if (!confirmed) return;

    saveRecoverySnapshot('before restoring history entry');

    const undoEntry = createEditHistoryEntry(`Before restoring ${entry.label}`);
    setHistory((current) => [...current.slice(-49), undoEntry]);
    setFuture([]);

    applyProjectData(entry.snapshot, false, false);
    setHistoryOpen(false);
    setSaved(false);
    setAutoSaveStatus('saving');
  }

  function resetProject() {
    const confirmed = window.confirm(
      'Reset the website builder to the default project?'
    );

    if (!confirmed) return;

    saveRecoverySnapshot('before reset');
    cancelPendingProjectPersistence();
    projectLoadSequenceRef.current += 1;
    newProjectIntentRef.current = true;
    setSections(defaultSections);
    setPages([{ id: 'page-home', name: 'Home', slug: 'home', sections: defaultSections, showInNavigation: true }]);
    setActivePageId('page-home');
    setHomePageId('page-home');
    setSelectedId(defaultSections[0].id);
    setSelectedElementId(defaultSections[0].elements[0]?.id ?? null);
    setSiteName('My Website');
    setSiteUrl('');
    setFaviconUrl('');
    setBrand(defaultBrand);
    setTheme(DEFAULT_THEME);
    setHeaderConfig(DEFAULT_HEADER_CONFIG);
    setFooterConfig(DEFAULT_FOOTER_CONFIG);
    setSiteEnhancements(DEFAULT_SITE_ENHANCEMENTS);
    setProductionConfig(DEFAULT_PRODUCTION_CONFIG);
    setDeliveryConfig(DEFAULT_DELIVERY_CONFIG);
    setDeliveryOpen(false);
    setSymbols([]);
    setSeo(defaultSEO);
    setPublishedUrl('');
    setPublishedAt(null);
    setPreviewUrl('');
    setPreviewToken('');
    setPreviewCreatedAt(null);
    setLastPublishedVersionId(null);
    setLastPublishedFingerprint('');
    setPublishVersions([]);
    setReleaseHistoryOpen(false);
    setLiveVerification('idle');
    setPublishError('');
    setPreviewError('');
    clearLocalWebsiteProjects();
    setCloudProjectId(null);
    saveActiveWebsiteProjectId(null);
    setCloudError('');
    setProjectHistory([]);
    setHistory([]);
    setFuture([]);
    setLeads([]);
    setLeadsOpen(false);
    setLeadsError('');
    setAnalyticsEvents([]);
    setAnalyticsOpen(false);
    setAnalyticsError('');
    setHistoryOpen(false);
    lastSavedSnapshotRef.current = '';
    setAutoSaveStatus('idle');
    setSaved(false);
  }

  function getHtml(
    pageSections: WebsiteSection[] = sections,
    pageId = activePageId,
    productionUrlOverride?: string,
    homeUsesIndexFile = false,
    trackAnalytics = false,
  ) {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const page = currentPages.find((item) => item.id === pageId) || currentPages[0];
    const productionUrl = normalizeSiteUrl(productionUrlOverride ?? siteUrl);
    const filename = page?.id === homePageId ? 'index.html' : `${normalizeSlug(page?.slug || 'page')}.html`;
    const canonicalOverride = page?.canonicalUrl?.trim() ? normalizeSiteUrl(page.canonicalUrl) : '';
    const canonicalUrl = canonicalOverride || (productionUrl
      ? page?.id === homePageId
        ? homeUsesIndexFile ? `${productionUrl}/index.html` : `${productionUrl}/`
        : `${productionUrl}/${filename}`
      : '');
    const baseTitle = seo.title.trim() || siteName;
    const defaultPageTitle = page?.id === homePageId ? baseTitle : `${page?.name || 'Page'} | ${baseTitle}`;
    const pageTitle = page?.seoTitle?.trim() || defaultPageTitle;
    const pageDescription = page?.seoDescription?.trim() || seo.description.trim();
    const pageLanguage = normalizePageLanguage(page?.language, prefs.language);
    const translationKey = page?.translationKey?.trim();
    const translationPages = translationKey ? currentPages.filter((item) => item.translationKey?.trim() === translationKey) : [];
    const alternateLinks = productionUrl && translationPages.length > 1
      ? translationPages.map((item, index) => ({
          language: normalizePageLanguage(item.language, prefs.language),
          href: item.id === homePageId
            ? homeUsesIndexFile ? `${productionUrl}/index.html` : `${productionUrl}/`
            : `${productionUrl}/${normalizeSlug(item.slug)}.html`,
          isDefault: index === 0,
        }))
      : [];

    return buildFullHtml(pageSections, {
      language: pageLanguage,
      title: pageTitle,
      description: pageDescription,
      keywords: seo.keywords,
      canonicalUrl,
      faviconUrl: faviconUrl.trim(),
      socialImageUrl: page?.socialImage?.trim() || '',
      noIndex: page?.noIndex === true,
      alternateLinks,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig: effectiveProductionConfig(),
      pages: currentPages,
      homePageId,
      currentPageId: pageId,
      siteName,
      leadProjectId: trackAnalytics ? cloudProjectId : null,
      analyticsProjectId: cloudProjectId,
      analyticsEnabled: trackAnalytics,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    });
  }

  function get404Html(productionUrlOverride?: string, homeUsesIndexFile = false, trackAnalytics = false) {
    const productionUrl = normalizeSiteUrl(productionUrlOverride ?? siteUrl);
    const homeHref = productionUrl
      ? homeUsesIndexFile ? `${productionUrl}/index.html` : `${productionUrl}/`
      : 'index.html';
    const notFoundSection = createSection('hero');
    notFoundSection.title = 'Page not found';
    notFoundSection.description = 'The page you are looking for does not exist or may have moved.';
    notFoundSection.buttonText = 'Back to Home';
    notFoundSection.buttonUrl = homeHref;
    notFoundSection.elements = notFoundSection.elements.map((element) => {
      if (element.type === 'heading') return { ...element, content: '404 — Page not found' };
      if (element.type === 'text') return { ...element, content: 'The page you are looking for does not exist or may have moved.' };
      if (element.type === 'button') return { ...element, content: 'Back to Home', href: homeHref };
      return element;
    });
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const homeLanguage = normalizePageLanguage(currentPages.find((page) => page.id === homePageId)?.language, prefs.language);
    return buildFullHtml([notFoundSection], {
      language: homeLanguage,
      title: `404 | ${seo.title.trim() || siteName}`,
      description: 'Page not found.',
      keywords: [],
      faviconUrl: faviconUrl.trim(),
      noIndex: true,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig: effectiveProductionConfig(),
      pages: currentPages,
      homePageId,
      currentPageId: '__404__',
      siteName,
      analyticsProjectId: cloudProjectId,
      analyticsEnabled: trackAnalytics,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    });
  }

  function exportProjectBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Tayar Website Builder',
      project: buildProjectData(),
    };
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-backup.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function importProjectBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const project = parsed?.project ?? parsed;
        if (!project || (!Array.isArray(project.pages) && !Array.isArray(project.sections))) throw new Error('Invalid project backup');
        const importedProject = {
          ...project,
          cloudProjectId: null,
          publishedUrl: '',
          publishedAt: null,
          previewUrl: '',
          previewToken: '',
          previewCreatedAt: null,
          lastPublishedVersionId: null,
          lastPublishedFingerprint: '',
          deliveryConfig: {
            ...normalizeDeliveryConfig(project.deliveryConfig),
            status: 'building',
            approvedAt: null,
            approvedFingerprint: '',
            deliveredAt: null,
          },
          history: [],
          updatedAt: new Date().toISOString(),
        };
        saveRecoverySnapshot('before importing backup');
        cancelPendingProjectPersistence();
        projectLoadSequenceRef.current += 1;
        skipNextAutosaveRef.current = true;
        applyProjectData(importedProject);
        newProjectIntentRef.current = true;
        setCloudProjectId(null);
        saveActiveWebsiteProjectId(null);
        setProjectHistory(Array.isArray(importedProject.history) ? importedProject.history.slice(0, 30) : []);
        saveLocalWebsiteProject(importedProject);
        lastSavedSnapshotRef.current = '';
        setAutoSaveStatus('saved');
        setOperationsOpen(false);
      } catch {
        window.alert('This JSON file is not a valid Tayar Website Builder backup.');
      }
    };
    input.click();
  }

  function exportLeadsCsv() {
    const rows: unknown[][] = [[ 'id', 'status', 'stage', 'priority', 'tags', 'notes', 'created_at', 'updated_at', 'name', 'email', 'phone', 'message', 'page_path', 'utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'form_data' ]];
    leads.forEach((lead) => {
      const meta = getWebsiteLeadSource(lead);
      rows.push([lead.id, lead.status, lead.stage || 'new', Number(lead.priority || 0), (lead.tags || []).join('|'), lead.notes || '', lead.created_at, lead.updated_at || '', lead.name, lead.email, getWebsiteLeadPhone(lead), lead.message, lead.page_path || '', meta.source, meta.medium, meta.campaign, meta.referrer, lead.form_data || {}]);
    });
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-leads.csv`, `\uFEFF${buildCsv(rows)}`, 'text/csv;charset=utf-8');
  }

  function exportAnalyticsCsv() {
    const rows: unknown[][] = [[
      'created_at',
      'event_type',
      'page_path',
      'referrer',
      'session_id',
      'event_data',
    ]];

    analyticsEvents.forEach((event) => {
      rows.push([
        event.created_at,
        event.event_type || 'page_view',
        event.page_path,
        event.referrer || '',
        event.session_id,
        event.event_data ? JSON.stringify(event.event_data) : '',
      ]);
    });

    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-analytics.csv`, `\uFEFF${buildCsv(rows)}`,

      'text/csv;charset=utf-8',
    );
  }

  function exportAuditReport() {
    const lines = [
      'Tayar Website Builder — Pre-publish Audit',
      `Site: ${siteName}`,
      `Generated: ${new Date().toISOString()}`,
      `Score: ${siteAudit.score}/100`,
      `Pages: ${pages.length}`,
      `Errors: ${siteAudit.errors.length}`,
      `Warnings: ${siteAudit.warnings.length}`,
      `Online: ${networkOnline ? 'yes' : 'no'}`,
      `Cloud sync: ${cloudSyncFailed ? 'needs retry' : 'healthy'}`,
      `Snapshot: ${qualityDiagnostics.snapshotKb} KB`,
      `Elements: ${qualityDiagnostics.elements}`,
      '',
      'ERRORS',
      ...(siteAudit.errors.length ? siteAudit.errors.map((item) => `- ${item}`) : ['- None']),
      '',
      'WARNINGS',
      ...(siteAudit.warnings.length ? siteAudit.warnings.map((item) => `- ${item}`) : ['- None']),
    ];
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-audit.txt`, lines.join('\n'));
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
    if (!publishedUrl && !window.confirm('This project is not currently published. Mark it delivered anyway?')) return;
    setDeliveryConfig((current) => ({ ...current, status: 'delivered', deliveredAt: new Date().toISOString() }));
    setSaved(false);
  }

  function buildDeliveryReport() {
    const due = deliveryConfig.dueDate || 'Not set';
    const approval = deliveryConfig.approvedAt
      ? `${new Date(deliveryConfig.approvedAt).toLocaleString()}${approvalCurrent ? ' (current build)' : ' (site changed after approval)'}`
      : 'Not approved';
    return [
      deliveryConfig.whiteLabel ? 'Website Delivery Report' : 'Tayar Website Builder — Client Delivery Report',
      '',
      `Project: ${siteName}`,
      `Project code: ${deliveryConfig.projectCode || '—'}`,
      `Client: ${deliveryConfig.clientName || '—'}`,
      `Client email: ${deliveryConfig.clientEmail || '—'}`,
      `Status: ${deliveryConfig.status}`,
      `Due date: ${due}`,
      `Generated: ${new Date().toISOString()}`,
      `Launch readiness: ${launchReadiness.score}/100`,
      `Audit score: ${siteAudit.score}/100`,
      `Approval: ${approval}`,
      `Delivered: ${deliveryConfig.deliveredAt ? new Date(deliveryConfig.deliveredAt).toLocaleString() : 'No'}`,
      `Live URL: ${publishedUrl || 'Not published'}`,
      `Share preview: ${previewUrl || 'Not created'}`,
      '',
      'USAGE',
      `Pages: ${deliveryUsage.pages}`,
      `Sections: ${deliveryUsage.sections}`,
      `Elements: ${deliveryUsage.elements}`,
      `Forms: ${deliveryUsage.forms}`,
      `Releases: ${deliveryUsage.releases}`,
      `Leads loaded: ${deliveryUsage.leads}`,
      `Analytics events loaded: ${deliveryUsage.analyticsEvents}`,
      '',
      'LAUNCH CHECKS',
      ...launchReadiness.checks.map((item) => `- ${item.ok ? '[x]' : '[ ]'} ${l(item.label)}`),
      '',
      'AUDIT ERRORS',
      ...(siteAudit.errors.length ? siteAudit.errors.map((item) => `- ${item}`) : ['- None']),
      '',
      'AUDIT WARNINGS',
      ...(siteAudit.warnings.length ? siteAudit.warnings.map((item) => `- ${item}`) : ['- None']),
      '',
      'HANDOFF NOTES',
      deliveryConfig.handoffNotes || '—',
    ].join('\n');
  }

  function exportDeliveryReport() {
    if (!requireBillingFeature('clientDelivery', 'Client delivery reports')) return;
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-delivery-report.txt`, buildDeliveryReport());
  }

  function downloadClientHandoffZip() {
    if (!requireBillingFeature('clientDelivery', 'Client handoff ZIP')) return;
    const productionUrl = normalizeSiteUrl(siteUrl) || (publishedUrl ? publishedUrl.replace(/\/index\.html(?:[?#].*)?$/i, '') : '');
    if (!productionUrl) {
      window.alert('Add a Production URL or publish the website before creating the client handoff package.');
      return;
    }

    const currentPages = getCurrentPages();
    const files: Array<{ name: string; content: string }> = currentPages.map((page) => ({
      name: `site/${page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`}`,
      content: getHtml(page.sections, page.id, productionUrl, false, true),
    }));
    const sitemapEntries = currentPages.filter((page) => page.noIndex !== true).map((page) => {
      const location = page.id === homePageId ? `${productionUrl}/` : `${productionUrl}/${normalizeSlug(page.slug)}.html`;
      return `  <url><loc>${escapeHtml(location)}</loc></url>`;
    }).join('\n');
    const customRobotsRules = sanitizeRobotsRules(productionConfig.customRobotsRules);
    files.push(
      { name: 'site/404.html', content: get404Html(productionUrl, false, true) },
      { name: 'site/sitemap.xml', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>` },
      { name: 'site/robots.txt', content: `User-agent: *\nAllow: /\n${customRobotsRules ? `\n${customRobotsRules}\n` : '\n'}Sitemap: ${productionUrl}/sitemap.xml\n` },
    );

    const backupPayload = {
      exportedAt: new Date().toISOString(),
      app: deliveryConfig.whiteLabel ? 'Website Builder' : 'Tayar Website Builder',
      project: buildProjectData(),
    };
    files.push({ name: 'project/project-backup.json', content: JSON.stringify(backupPayload, null, 2) });
    files.push({ name: 'reports/delivery-report.txt', content: buildDeliveryReport() });

    const leadRows: unknown[][] = [[ 'id', 'status', 'stage', 'priority', 'tags', 'notes', 'created_at', 'name', 'email', 'phone', 'message', 'page_path', 'utm_source', 'utm_medium', 'utm_campaign', 'referrer' ]];
    leads.forEach((lead) => {
      const meta = getWebsiteLeadSource(lead);
      leadRows.push([lead.id, lead.status, lead.stage || 'new', Number(lead.priority || 0), (lead.tags || []).join('|'), lead.notes || '', lead.created_at, lead.name, lead.email, getWebsiteLeadPhone(lead), lead.message, lead.page_path || '', meta.source, meta.medium, meta.campaign, meta.referrer]);
    });
    files.push({ name: 'reports/leads.csv', content: `\uFEFF${buildCsv(leadRows)}` });

    const analyticsRows: unknown[][] = [[ 'created_at', 'event_type', 'page_path', 'referrer', 'session_id', 'event_data' ]];
    analyticsEvents.forEach((event) => analyticsRows.push([event.created_at, event.event_type || 'page_view', event.page_path, event.referrer || '', event.session_id, event.event_data || {}]));
    files.push({ name: 'reports/analytics.csv', content: `\uFEFF${buildCsv(analyticsRows)}` });
    files.push({ name: 'reports/releases.txt', content: publishVersions.length
      ? publishVersions.map((version, index) => `${index + 1}. ${version.created_at} | ${version.release_note || 'No release note'} | ${version.published_url}`).join('\n')
      : 'No release history loaded.' });

    const handoffTitle = deliveryConfig.whiteLabel ? 'CLIENT WEBSITE HANDOFF' : 'TAYAR WEBSITE BUILDER — CLIENT HANDOFF';
    files.push({ name: 'HANDOFF.txt', content: [
      handoffTitle,
      '',
      `Project: ${siteName}`,
      `Client: ${deliveryConfig.clientName || '—'}`,
      `Project code: ${deliveryConfig.projectCode || '—'}`,
      `Live URL: ${publishedUrl || productionUrl}`,
      `Launch readiness: ${launchReadiness.score}/100`,
      '',
      'Package contents:',
      '- site/ — production HTML, sitemap and robots.txt',
      '- project/project-backup.json — editable project backup',
      '- reports/delivery-report.txt — approval, readiness and audit',
      '- reports/leads.csv — currently loaded lead data',
      '- reports/analytics.csv — currently loaded analytics events',
      '- reports/releases.txt — currently loaded release history',
      '- MANIFEST.txt — file sizes and CRC32 checksums',
      '',
      deliveryConfig.handoffNotes || '',
    ].join('\n') });

    const encoder = new TextEncoder();
    const manifest = files.map((file) => {
      const bytes = encoder.encode(file.content);
      return `${file.name}\t${bytes.length} bytes\tCRC32 ${crc32(bytes).toString(16).padStart(8, '0')}`;
    });
    files.push({ name: 'MANIFEST.txt', content: [`Generated ${new Date().toISOString()}`, ...manifest].join('\n') });

    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizeSlug(siteName || 'website')}-client-handoff.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      window.alert('Add your production URL first, for example https://example.com. It is required for canonical URLs and sitemap.xml.');
      return;
    }

    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const files: Array<{ name: string; content: string }> = currentPages.map((page) => {
      const filename = page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`;
      return { name: filename, content: getHtml(page.sections, page.id, undefined, false, true) };
    });

    const sitemapEntries = currentPages.filter((page) => page.noIndex !== true).map((page) => {
      const location = page.id === homePageId
        ? `${productionUrl}/`
        : `${productionUrl}/${normalizeSlug(page.slug)}.html`;
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

  async function publishWebsite() {
    if (!networkOnline) {
      setPublishError('Publish preflight blocked: you are offline. Reconnect and try again.');
      return;
    }

    if (siteAudit.errors.length) {
      setPublishError(`Publish preflight blocked: fix ${siteAudit.errors.length} critical audit error${siteAudit.errors.length === 1 ? '' : 's'} first.`);
      return;
    }

    if (!user) {
      setPublishError('Sign in before publishing.');
      return;
    }

    if (cloudProjectId && !projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can publish a shared website.');
      return;
    }

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    if (!supabaseUrl) {
      setPublishError('Supabase URL is not configured.');
      return;
    }

    const publishSequence = ++publishOperationSequenceRef.current;
    const publishLoadSequence = projectLoadSequenceRef.current;
    const publishUserId = user.id;
    const publishTitle = siteName.trim() || 'My Website';
    const publishIsCurrent = () =>
      publishOperationSequenceRef.current === publishSequence &&
      projectLoadSequenceRef.current === publishLoadSequence &&
      activeUserIdRef.current === publishUserId;

    setPublishBusy(true);
    setPublishError('');
    setPublishVersionsError('');
    setLiveVerification('checking');

    try {
      let publishProjectId = cloudProjectId;

      if (publishProjectId) {
        const latestSaved = await saveProject({
          automatic: true,
          createHistory: false,
        });

        if (!publishIsCurrent()) return;

        if (!latestSaved) {
          throw new Error('The latest editor changes could not be synchronized before publishing.');
        }
      } else {
        const draftData = buildProjectData();
        const createResult = await createWebsiteProjectInCloud({
          userId: publishUserId,
          title: publishTitle,
          content: draftData,
          published: false,
        });

        if (!publishIsCurrent()) return;

        if (createResult.error || !createResult.data) {
          if (createResult.error && /limit reached/i.test(createResult.error.message || '')) {
            openBillingWithMessage(createResult.error.message || 'Website project limit reached.');
          }

          throw new Error(
            createResult.error?.message ||
            'The project could not be created in Tayar cloud before publishing.'
          );
        }

        publishProjectId = String((createResult.data as { id: string }).id);
        setCloudProjectId(publishProjectId);
        saveActiveWebsiteProjectId(publishProjectId);
        setProjectTeamAccess({
          ...DEFAULT_EDITOR_PROJECT_ACCESS,
          ownerId: publishUserId,
        });
        setCloudSyncFailed(false);
      }

      if (!publishProjectId) {
        throw new Error('A cloud project ID is required to publish.');
      }

      if (!publishIsCurrent()) return;

      const folder = publishUserId + '/' + publishProjectId;
      const publicBaseUrl = buildPublishedSiteBaseUrl(publishUserId, publishProjectId);
      if (!publicBaseUrl) {
        throw new Error('Could not build the public website URL.');
      }

      const currentPages = getCurrentPages();

      if (!currentPages.length) {
        throw new Error('Add at least one page before publishing.');
      }

      const files: Array<{
        name: string;
        content: string;
        contentType: string;
      }> = currentPages.map((page) => ({
        name:
          page.id === homePageId
            ? 'index.html'
            : normalizeSlug(page.slug) + '.html',
        content: getHtml(
          page.sections,
          page.id,
          publicBaseUrl,
          true,
          true,
        ),
        contentType: 'text/html; charset=utf-8',
      }));

      if (!files.some((file) => file.name === 'index.html')) {
        const firstPage = currentPages[0];
        files.unshift({
          name: 'index.html',
          content: getHtml(
            firstPage.sections,
            firstPage.id,
            publicBaseUrl,
            true,
            true,
          ),
          contentType: 'text/html; charset=utf-8',
        });
      }

      const sitemapEntries = currentPages
        .filter((page) => page.noIndex !== true)
        .map((page) => {
          const location =
            page.id === homePageId
              ? publicBaseUrl + '/index.html'
              : publicBaseUrl + '/' + normalizeSlug(page.slug) + '.html';

          return '  <url><loc>' + escapeHtml(location) + '</loc></url>';
        })
        .join('\n');

      const customRobotsRules =
        sanitizeRobotsRules(
          productionConfig.customRobotsRules,
        );

      files.push(
        {
          name: '404.html',
          content: get404Html(
            publicBaseUrl,
            true,
            true,
          ),
          contentType: 'text/html; charset=utf-8',
        },
        {
          name: 'sitemap.xml',
          content:
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            sitemapEntries +
            '\n</urlset>',
          contentType: 'application/xml; charset=utf-8',
        },
        {
          name: 'robots.txt',
          content:
            'User-agent: *\nAllow: /\n' +
            (customRobotsRules
              ? '\n' + customRobotsRules + '\n'
              : '\n') +
            'Sitemap: ' +
            publicBaseUrl +
            '/sitemap.xml\n',
          contentType: 'text/plain; charset=utf-8',
        },
      );

      const publishBaseProjectData = buildProjectData();
      const publishEditableFingerprint = buildEditableFingerprint();
      const publishReleaseNote = releaseNote.trim().slice(0, 500);
      const publishReleaseHistoryEnabled =
        billingEntitlements.features.releaseHistory;

      await replacePublishedWebsiteFiles(folder, files);

      if (!publishIsCurrent()) return;

      const versionId =
        typeof crypto !== 'undefined' &&
        'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
              .replace(
                /[xy]/g,
                (character) => {
                  const random =
                    Math.floor(
                      Math.random() * 16,
                    );

                  const value =
                    character === 'x'
                      ? random
                      : (random & 0x3) |
                        0x8;

                  return value.toString(16);
                },
              );

      const versionPrefix =
        folder +
        '/versions/' +
        versionId;

      let archivedReleaseId:
        string | null = null;

      let archiveWarning = '';

      if (publishReleaseHistoryEnabled) {
        try {
          await archivePublishedWebsiteFiles(versionPrefix, files);

          if (!publishIsCurrent()) return;

          const provisionalData = {
            ...publishBaseProjectData,
            publishedUrl:
              publicBaseUrl +
              '/index.html',
            publishedAt:
              new Date().toISOString(),
            lastPublishedVersionId:
              versionId,
            lastPublishedFingerprint:
              publishEditableFingerprint,
          };

          const manifest =
            files.map((file) => ({
              name: file.name,
              contentType:
                file.contentType,
            }));

          const {
            error: versionError,
          } = await createWebsitePublishVersion({
            id: versionId,
            projectId: publishProjectId,
            ownerId: publishUserId,
            releaseNote: publishReleaseNote,
            publishedUrl: publicBaseUrl + '/index.html',
            storagePrefix: versionPrefix,
            editorFingerprint: publishEditableFingerprint,
            snapshot: provisionalData,
            fileManifest: manifest,
          });

          if (!publishIsCurrent()) return;

          if (versionError) {
            throw versionError;
          }

          archivedReleaseId =
            versionId;
        } catch (error) {
          archiveWarning =
            error instanceof Error
              ? error.message
              : 'Release history could not be archived.';
        }
      }

      const nextPublishedUrl =
        buildPublishedSiteUrl(publishUserId, publishProjectId, 'index.html');

      if (!nextPublishedUrl) {
        throw new Error('Could not build the public website URL.');
      }

      if (!publishIsCurrent()) return;

      const renderedRouteHealthy =
        await verifyPublishedRoute(nextPublishedUrl);

      if (!publishIsCurrent()) return;

      if (!renderedRouteHealthy) {
        throw new Error(
          'The website files were uploaded, but the public renderer did not return a valid HTML page.'
        );
      }

      const nextPublishedAt =
        new Date().toISOString();

      const projectData = {
        ...publishBaseProjectData,
        publishedUrl:
          nextPublishedUrl,
        publishedAt:
          nextPublishedAt,
        lastPublishedVersionId:
          archivedReleaseId,
        lastPublishedFingerprint:
          publishEditableFingerprint,
        updatedAt:
          nextPublishedAt,
      };

      if (!publishIsCurrent()) return;

      const {
        error: projectError,
      } = await updateWebsiteProjectPublicationState({
        projectId: publishProjectId,
        userId: publishUserId,
        content: projectData,
        published: true,
        updatedAt: nextPublishedAt,
      });

      if (!publishIsCurrent()) return;

      if (projectError) {
        throw new Error(
          'The site is uploaded, but the project publish state could not be saved: ' +
          projectError.message
        );
      }

      if (!publishIsCurrent()) return;

      setCloudProjects((current) => {
        const existing = current.find((project) => project.id === publishProjectId);
        const updatedProject: CloudWebsiteProject = {
          ...(existing || {
            id: publishProjectId,
            user_id: publishUserId,
            workspace_id: null,
            title: publishTitle,
            content: projectData,
            status: 'completed',
            updated_at: nextPublishedAt,
          }),
          content: projectData,
          status: 'completed',
          updated_at: nextPublishedAt,
        };

        return [
          updatedProject,
          ...current.filter((project) => project.id !== publishProjectId),
        ];
      });

      setPublishedUrl(
        nextPublishedUrl,
      );

      setPublishedAt(
        nextPublishedAt,
      );

      setLastPublishedVersionId(
        archivedReleaseId,
      );

      setLastPublishedFingerprint(
        publishEditableFingerprint,
      );

      setReleaseNote('');

      saveLocalWebsiteProject(projectData);

      lastSavedSnapshotRef.current = '';

      setAutoSaveStatus(
        'saved',
      );

      setCloudSyncFailed(
        false,
      );

      setLiveVerification(
        'healthy',
      );

      if (archiveWarning) {
        setPublishVersionsError(
          'Website published successfully. Release history was skipped: ' +
          archiveWarning
        );
      }

      if (publishReleaseHistoryEnabled) {
        await refreshPublishVersions(
          publishProjectId,
          publishUserId,
          publishLoadSequence,
        );
      }
    } catch (error) {
      if (!publishIsCurrent()) return;

      setPublishError(
        error instanceof Error
          ? error.message
          : 'Could not publish this website.',
      );

      setLiveVerification(
        'failed',
      );
    } finally {
      if (publishOperationSequenceRef.current === publishSequence) {
        setPublishBusy(false);
      }
    }
  }
  async function unpublishWebsite() {
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can unpublish a shared website.');
      return;
    }
    if (!window.confirm('Remove the public version of this website?')) return;

    const unpublishSequence = ++publishOperationSequenceRef.current;
    const unpublishLoadSequence = projectLoadSequenceRef.current;
    const unpublishProjectId = cloudProjectId;
    const unpublishUserId = user.id;
    const unpublishBaseProjectData = buildProjectData();
    const unpublishIsCurrent = () =>
      publishOperationSequenceRef.current === unpublishSequence &&
      projectLoadSequenceRef.current === unpublishLoadSequence &&
      activeUserIdRef.current === unpublishUserId;

    setPublishBusy(true);
    setPublishError('');

    try {
      const folder = `${unpublishUserId}/${unpublishProjectId}`;
      await removePublishedWebsiteFiles(folder);

      if (!unpublishIsCurrent()) return;

      const nextUpdatedAt = new Date().toISOString();
      const projectData = {
        ...unpublishBaseProjectData,
        publishedUrl: '',
        publishedAt: null,
        lastPublishedVersionId: null,
        lastPublishedFingerprint: '',
        updatedAt: nextUpdatedAt,
      };

      if (!unpublishIsCurrent()) return;

      const { error: projectError } = await updateWebsiteProjectPublicationState({
        projectId: unpublishProjectId,
        userId: unpublishUserId,
        content: projectData,
        published: false,
        updatedAt: nextUpdatedAt,
      });

      if (!unpublishIsCurrent()) return;
      if (projectError) throw projectError;

      setCloudProjects((current) =>
        current.map((project) =>
          project.id === unpublishProjectId
            ? {
                ...project,
                content: projectData,
                status: 'draft',
                updated_at: nextUpdatedAt,
              }
            : project
        )
      );

      setPublishedUrl('');
      setPublishedAt(null);
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setLiveVerification('idle');
      saveLocalWebsiteProject(projectData);
      lastSavedSnapshotRef.current = '';
      setAutoSaveStatus('saved');
    } catch (error) {
      if (!unpublishIsCurrent()) return;
      setPublishError(error instanceof Error ? error.message : 'Could not unpublish this website.');
    } finally {
      if (publishOperationSequenceRef.current === unpublishSequence) {
        setPublishBusy(false);
      }
    }
  }
  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(getHtml());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Could not copy HTML. Please use Download Website instead.');
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

  function exportV1LaunchReport() {
    const manual = [
      ['Stripe test payment + webhook', launchManualChecks.stripe],
      ['Production domain / DNS', launchManualChecks.domain],
      ['Support + legal contact review', launchManualChecks.support],
    ] as const;
    const lines = [
      'Tayar Website Builder V1 — Final Launch Report',
      `Generated: ${new Date().toISOString()}`,
      `Project: ${siteName || 'Untitled website'}`,
      `Cloud project: ${cloudProjectId || 'Not saved'}`,
      `Plan: ${BILLING_PLAN_DETAILS[billingPlan].label}`,
      `Launch status: ${v1LaunchStatus.status}`,
      `Launch score: ${v1LaunchStatus.score}/100`,
      `Audit score: ${siteAudit.score}/100`,
      `Production URL: ${normalizeSiteUrl(siteUrl) || 'Not configured'}`,
      `Published URL: ${publishedUrl || 'Not published'}`,
      `Live verification: ${liveVerification}`,
      `Cloud sync: ${cloudSyncFailed || autoSaveStatus === 'failed' ? 'needs attention' : networkOnline ? 'healthy' : 'offline'}`,
      '',
      'Automated launch checks',
      ...v1LaunchStatus.checks.map((check) => `- ${check.ok ? '[x]' : '[ ]'} ${check.label}: ${check.detail}`),
      '',
      'Manual production checks',
      ...manual.map(([label, ok]) => `- ${ok ? '[x]' : '[ ]'} ${label}`),
      '',
      'Blockers',
      ...(v1LaunchStatus.blockers.length ? v1LaunchStatus.blockers.map((item) => `- ${item}`) : ['- None']),
      '',
      'Audit errors',
      ...(siteAudit.errors.length ? siteAudit.errors.map((item) => `- ${item}`) : ['- None']),
      '',
      'Audit warnings',
      ...(siteAudit.warnings.length ? siteAudit.warnings.map((item) => `- ${item}`) : ['- None']),
    ];
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-v1-launch-report.txt`, lines.join('\n'));
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
      );

    const index =
      sections.findIndex(
        (section) =>
          section.id === sectionId,
      );

    remember(sections);

    setSections((current) => {
      const next =
        [...current];

      next.splice(
        Math.max(0, index + 1),
        0,
        duplicate,
      );

      return next;
    });

    setSelectedId(
      duplicate.id,
    );

    setSelectedElementId(
      duplicate.elements[0]
        ?.id ?? null,
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

    const index =
      targetSection.elements.findIndex(
        (element) =>
          element.id === elementId,
      );

    if (index < 0) return;

    const targetIndex =
      direction === 'up'
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >=
        targetSection.elements.length
    ) {
      return;
    }

    remember(sections);

    setSections((current) =>
      current.map((section) => {
        if (
          section.id !== sectionId
        ) {
          return section;
        }

        const elements =
          [...section.elements];

        [
          elements[index],
          elements[targetIndex],
        ] = [
          elements[targetIndex],
          elements[index],
        ];

        return {
          ...section,
          elements,
        };
      }),
    );

    setSelectedId(sectionId);
    setSelectedElementId(elementId);
    setSaved(false);
  }

  function v2DuplicateElementDirect(
    sectionId: string,
    elementId: string,
  ) {
    const targetSection =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    const source =
      targetSection?.elements.find(
        (element) =>
          element.id === elementId,
      );

    if (
      !targetSection ||
      !source
    ) {
      return;
    }

    const duplicate: WebsiteElement = {
      ...source,

      id:
        `${source.type}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      style: {
        ...source.style,
      },

      responsive:
        source.responsive
          ? JSON.parse(
              JSON.stringify(
                source.responsive,
              ),
            )
          : undefined,

      symbolId:
        undefined,
    };

    const index =
      targetSection.elements.findIndex(
        (element) =>
          element.id === elementId,
      );

    remember(sections);

    setSections((current) =>
      current.map((section) => {
        if (
          section.id !== sectionId
        ) {
          return section;
        }

        const elements =
          [...section.elements];

        elements.splice(
          index + 1,
          0,
          duplicate,
        );

        return {
          ...section,
          elements,
        };
      }),
    );

    setSelectedId(sectionId);

    setSelectedElementId(
      duplicate.id,
    );

    setSaved(false);
  }

  function v2DeleteElementDirect(
    sectionId: string,
    elementId: string,
  ) {
    const targetSection =
      sections.find(
        (section) =>
          section.id === sectionId,
      );

    if (
      !targetSection ||
      targetSection.elements.length <= 1
    ) {
      return;
    }

    const index =
      targetSection.elements.findIndex(
        (element) =>
          element.id === elementId,
      );

    if (index < 0) return;

    const remaining =
      targetSection.elements.filter(
        (element) =>
          element.id !== elementId,
      );

    const nextElement =
      remaining[
        Math.min(
          index,
          remaining.length - 1,
        )
      ];

    remember(sections);

    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              elements:
                remaining,
            }
          : section,
      ),
    );

    setSelectedId(sectionId);

    setSelectedElementId(
      nextElement?.id ?? null,
    );

    setSaved(false);
  }

  function applyV2NativeOperations(
    operations: EditorNativeOperation[],
    nextSelection?: EditorSelection,
  ) {
    if (!operations.length) return;

    const currentPages =
      pages.map((page) =>
        page.id === activePageId
          ? {
              ...page,
              sections,
            }
          : page,
      );

    const initialSelection:
      EditorSelection = {
        pageId: activePageId,

        ...(selectedId
          ? {
              sectionId:
                selectedId,
            }
          : {}),

        ...(selectedElementId
          ? {
              elementId:
                selectedElementId,
            }
          : {}),

        ...(!selectedElementId &&
        selectedContainerId
          ? {
              containerId:
                selectedContainerId,
            }
          : {}),

        ...(!selectedElementId &&
        !selectedContainerId &&
        selectedFormFieldId
          ? {
              formFieldId:
                selectedFormFieldId,
            }
          : {}),
      };

    const store =
      new EditorStore(
        {
          pages:
            currentPages as unknown as EditorPageLike[],

          homePageId,
        },
        {
          selection:
            initialSelection,
        },
      );

    const result =
      store.applyNativePatch(
        operations,
      );

    if (
      result.errors.length
    ) {
      console.error(
        '[WebsiteBuilder V2] Native operation failed:',
        {
          operations,
          errors:
            result.errors,
          warnings:
            result.warnings,
        },
      );

      return;
    }

    if (
      !result.changed
    ) {
      console.warn(
        '[WebsiteBuilder V2] Native operation produced no change:',
        operations,
      );

      return;
    }

    const operationLabel = operations.length === 1
      ? operations[0].action.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
      : `${operations.length} manual changes`;

    remember(sections, operationLabel);

    const nextProject =
      store
        .getSnapshot()
        .session
        .project;

    const nextPages =
      nextProject.pages as unknown as WebsitePage[];

    const requestedPageId =
      nextSelection?.pageId ||
      activePageId;

    const nextActivePage =
      nextPages.find(
        (page) =>
          page.id ===
          requestedPageId,
      ) ||
      nextPages[0];

    if (!nextActivePage) {
      return;
    }

    setPages(nextPages);

    setActivePageId(
      nextActivePage.id,
    );

    setSections(
      nextActivePage.sections,
    );

    const requestedSectionId =
      nextSelection?.sectionId;

    const nextSection =
      requestedSectionId
        ? nextActivePage
            .sections
            .find(
              (section) =>
                section.id ===
                requestedSectionId,
            )
        : undefined;

    const resolvedSection =
      nextSection ||
      nextActivePage
        .sections[0];

    setSelectedId(
      resolvedSection?.id ??
        null,
    );

    const requestedElementId =
      nextSelection?.elementId;

    const hasRequestedElement =
      Boolean(
        requestedElementId &&
        resolvedSection?.elements
          .some(
            (element) =>
              element.id ===
              requestedElementId,
          ),
      );

    setSelectedElementId(
      hasRequestedElement
        ? requestedElementId!
        : null,
    );

    const requestedContainerId =
      nextSelection?.containerId;

    const hasRequestedContainer =
      Boolean(
        !hasRequestedElement &&
        requestedContainerId &&
        resolvedSection?.containers
          ?.some(
            (container) =>
              container.id ===
              requestedContainerId,
          ),
      );

    setSelectedContainerId(
      hasRequestedContainer
        ? requestedContainerId!
        : null,
    );

    const requestedFormFieldId =
      nextSelection?.formFieldId;

    const hasRequestedFormField =
      Boolean(
        !hasRequestedElement &&
        !hasRequestedContainer &&
        requestedFormFieldId &&
        resolvedSection?.formFields
          ?.some(
            (formField) =>
              formField.id ===
              requestedFormFieldId,
          ),
      );

    setSelectedFormFieldId(
      hasRequestedFormField
        ? requestedFormFieldId!
        : null,
    );

    setSaved(false);
  }

  const v2AiPanel = (
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

            <p className="mt-1 text-[9px] leading-relaxed text-gray-500">
              Build or edit your website with natural language.
            </p>
          </div>

          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-violet-300">
            {aiBusy ? aiStage : 'Agent'}
          </span>
        </div>
      </div>

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
                  ? 'You'
                  : 'Tayar AI'}
              </span>

              {message.content}
            </div>
          ))}
        </div>

        {aiBusy && (
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.06] p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Tayar AI is {aiStage}...
            </div>
          </div>
        )}

        {aiPlan && (
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">
              Website plan
            </p>

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
              <strong className="text-[10px] text-emerald-300">
                Quality score
              </strong>

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
          <p className="mb-2 text-[8px] font-black uppercase tracking-wider text-gray-500">
            Quick actions
          </p>

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
                onClick={() => setAiPrompt(prompt)}
                disabled={aiBusy}
                className="rounded-lg border border-white/10 px-2.5 py-2 text-left text-[9px] text-gray-400 transition hover:bg-white/[0.04] hover:text-gray-200 disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-3">
        <textarea
          value={aiPrompt}
          onChange={(event) =>
            setAiPrompt(event.target.value)
          }
          disabled={aiBusy}
          rows={4}
          placeholder={
            aiStage === 'ready'
              ? 'Tell Tayar AI what to change...'
              : 'Describe the website you want to build...'
          }
          className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed text-white outline-none placeholder:text-gray-600 focus:border-violet-500/50 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => {
            if (aiStage === 'ready') {
              void applyAIChange();
            } else {
              void generateWithAI(true);
            }
          }}
          disabled={!aiPrompt.trim() || aiBusy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-[10px] font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />

          {aiBusy
            ? 'Tayar AI is working...'
            : aiStage === 'ready'
              ? 'Apply AI change'
              : 'Build with Tayar AI'}
        </button>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void generateWithAI(true)}
            disabled={!aiPrompt.trim() || aiBusy}
            className="rounded-lg border border-white/10 px-2 py-2 text-[9px] font-bold text-gray-400 hover:bg-white/[0.04] disabled:opacity-40"
          >
            Rebuild
          </button>

          <button
            type="button"
            onClick={() => void runAIQualityCheck()}
            disabled={aiBusy || aiQualityBusy}
            className="rounded-lg border border-white/10 px-2 py-2 text-[9px] font-bold text-gray-400 hover:bg-white/[0.04] disabled:opacity-40"
          >
            {aiQualityBusy
              ? 'Checking...'
              : 'Quality check'}
          </button>
        </div>

        {aiUndoSnapshot && (
          <button
            type="button"
            onClick={undoLastAIChange}
            disabled={aiBusy}
            className="mt-2 w-full rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-2 py-2 text-[9px] font-bold text-amber-300 disabled:opacity-40"
          >
            Undo last AI change
          </button>
        )}
      </div>
    </div>
  );

  const v2SitePanel = (
    <div className="tayar-v2-manual-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Site</strong>
      </div>

      <details open className="tayar-v2-manual-section">
        <summary>Identity</summary>
        <div className="tayar-v2-manual-fields">
          <label>
            <span>Site name</span>
            <input value={siteName} onChange={(e) => { setSiteName(e.target.value); setSaved(false); }} />
          </label>
          <label>
            <span>Production URL</span>
            <input value={siteUrl} placeholder="https://example.com" onChange={(e) => { setSiteUrl(e.target.value); setSaved(false); }} />
          </label>
          <label>
            <span>Favicon URL</span>
            <input value={faviconUrl} placeholder="https://..." onChange={(e) => { setFaviconUrl(e.target.value); setSaved(false); }} />
          </label>
        </div>
      </details>

      <details open className="tayar-v2-manual-section">
        <summary>Global theme</summary>
        <div className="tayar-v2-manual-fields tayar-v2-manual-fields--two">
          <label><span>Primary</span><input type="color" value={theme.primaryColor} onChange={(e) => { setTheme((current) => ({ ...current, primaryColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>Secondary</span><input type="color" value={theme.secondaryColor} onChange={(e) => { setTheme((current) => ({ ...current, secondaryColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>Background</span><input type="color" value={theme.backgroundColor} onChange={(e) => { setTheme((current) => ({ ...current, backgroundColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>Text</span><input type="color" value={theme.textColor} onChange={(e) => { setTheme((current) => ({ ...current, textColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>Muted text</span><input type="color" value={theme.mutedTextColor} onChange={(e) => { setTheme((current) => ({ ...current, mutedTextColor: e.target.value })); setSaved(false); }} /></label>
          <label>
            <span>Font</span>
            <select value={theme.fontFamily} onChange={(e) => { setTheme((current) => ({ ...current, fontFamily: e.target.value })); setSaved(false); }}>
              {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
            </select>
          </label>
          <label><span>Content width</span><input type="number" min="720" max="1440" step="20" value={theme.contentWidth} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, contentWidth: Number(e.target.value) })); setSaved(false); }} /></label>
          <label><span>Section spacing</span><input type="number" min="0" max="240" value={theme.sectionSpacing} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, sectionSpacing: Number(e.target.value) })); setSaved(false); }} /></label>
          <label><span>Button radius</span><input type="number" min="0" max="80" value={theme.buttonRadius} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, buttonRadius: Number(e.target.value) })); setSaved(false); }} /></label>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>Header</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>Enable header</span><input type="checkbox" checked={headerConfig.enabled} onChange={(e) => { setHeaderConfig((current) => ({ ...current, enabled: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>Sticky</span><input type="checkbox" checked={headerConfig.sticky} onChange={(e) => { setHeaderConfig((current) => ({ ...current, sticky: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>Mobile menu</span><input type="checkbox" checked={headerConfig.mobileMenu} onChange={(e) => { setHeaderConfig((current) => ({ ...current, mobileMenu: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>Language switcher</span><input type="checkbox" checked={headerConfig.languageSwitcher} onChange={(e) => { setHeaderConfig((current) => ({ ...current, languageSwitcher: e.target.checked })); setSaved(false); }} /></label>
          <label><span>Brand text</span><input value={headerConfig.brandText} onChange={(e) => { setHeaderConfig((current) => ({ ...current, brandText: e.target.value })); setSaved(false); }} /></label>
          <label><span>Logo URL</span><input value={headerConfig.logoUrl} placeholder="https://..." onChange={(e) => { setHeaderConfig((current) => ({ ...current, logoUrl: e.target.value })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>Show CTA</span><input type="checkbox" checked={headerConfig.showCta} onChange={(e) => { setHeaderConfig((current) => ({ ...current, showCta: e.target.checked })); setSaved(false); }} /></label>
          <label><span>CTA label</span><input value={headerConfig.ctaLabel} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaLabel: e.target.value })); setSaved(false); }} /></label>
          <label><span>CTA link</span><input value={headerConfig.ctaHref} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaHref: e.target.value })); setSaved(false); }} /></label>
          <div className="tayar-v2-manual-fields tayar-v2-manual-fields--two">
            <label><span>Background</span><input type="color" value={headerConfig.backgroundColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, backgroundColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>Text</span><input type="color" value={headerConfig.textColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, textColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>Active</span><input type="color" value={headerConfig.activeColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, activeColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>Hover</span><input type="color" value={headerConfig.hoverColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, hoverColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>CTA background</span><input type="color" value={headerConfig.ctaBackgroundColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaBackgroundColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>CTA text</span><input type="color" value={headerConfig.ctaTextColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaTextColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>Nav gap</span><input type="number" min="0" max="80" value={headerConfig.navGap} onChange={(e) => { setHeaderConfig((current) => ({ ...current, navGap: Number(e.target.value) })); setSaved(false); }} /></label>
            <label><span>Brand size</span><input type="number" min="10" max="60" value={headerConfig.brandSize} onChange={(e) => { setHeaderConfig((current) => ({ ...current, brandSize: Number(e.target.value) })); setSaved(false); }} /></label>
            <label><span>Nav size</span><input type="number" min="8" max="40" value={headerConfig.navSize} onChange={(e) => { setHeaderConfig((current) => ({ ...current, navSize: Number(e.target.value) })); setSaved(false); }} /></label>
          </div>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>Footer</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>Enable footer</span><input type="checkbox" checked={footerConfig.enabled} onChange={(e) => { setFooterConfig((current) => ({ ...current, enabled: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>Show navigation</span><input type="checkbox" checked={footerConfig.showNavigation} onChange={(e) => { setFooterConfig((current) => ({ ...current, showNavigation: e.target.checked })); setSaved(false); }} /></label>
          <label><span>Footer text</span><textarea rows={3} value={footerConfig.text} onChange={(e) => { setFooterConfig((current) => ({ ...current, text: e.target.value })); setSaved(false); }} /></label>
          <label><span>Instagram</span><input value={footerConfig.instagramUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, instagramUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>Facebook</span><input value={footerConfig.facebookUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, facebookUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>LinkedIn</span><input value={footerConfig.linkedinUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, linkedinUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>X</span><input value={footerConfig.xUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, xUrl: e.target.value })); setSaved(false); }} /></label>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>Site features</summary>
        <div className="tayar-v2-manual-fields">
          {([
            ['cookieBanner', 'Cookie banner'],
            ['scrollProgress', 'Scroll progress'],
            ['backToTop', 'Back to top'],
            ['announcementBar', 'Announcement bar'],
            ['popupEnabled', 'Popup'],
            ['siteSearch', 'Site search'],
            ['galleryLightbox', 'Gallery lightbox'],
            ['floatingCta', 'Floating CTA'],
            ['shareButtons', 'Share buttons'],
          ] as const).map(([key, label]) => (
            <label key={key} className="tayar-v2-manual-toggle">
              <span>{label}</span>
              <input type="checkbox" checked={siteEnhancements[key]} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, [key]: e.target.checked })); setSaved(false); }} />
            </label>
          ))}
          {siteEnhancements.announcementBar && <>
            <label><span>Announcement</span><input value={siteEnhancements.announcementText} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementText: e.target.value })); setSaved(false); }} /></label>
            <label><span>Announcement link</span><input value={siteEnhancements.announcementHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementHref: e.target.value })); setSaved(false); }} /></label>
          </>}
          {siteEnhancements.floatingCta && <>
            <label><span>Floating CTA label</span><input value={siteEnhancements.floatingCtaLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCtaLabel: e.target.value })); setSaved(false); }} /></label>
            <label><span>Floating CTA link</span><input value={siteEnhancements.floatingCtaHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCtaHref: e.target.value })); setSaved(false); }} /></label>
          </>}
        </div>
      </details>
    </div>
  );

  const v2SettingsPanel = (
    <div className="tayar-v2-manual-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Settings</strong>
      </div>

      <details open className="tayar-v2-manual-section">
        <summary>Site Check</summary>
        <div className="tayar-v2-manual-fields">
          <div className="tayar-v2-check-score" data-ok={siteAudit.errors.length === 0 ? 'true' : 'false'}>
            <strong>{siteAudit.score}/100</strong>
            <span>
              {siteAudit.errors.length} critical · {siteAudit.warnings.length} warnings
            </span>
          </div>
          {launchLastCheckedAt && (
            <div className="tayar-v2-manual-note">
              Last checked {new Date(launchLastCheckedAt).toLocaleString()}
            </div>
          )}
          {siteAudit.errors.length > 0 && (
            <div className="tayar-v2-check-list is-error">
              {siteAudit.errors.map((item) => <p key={item}>• {item}</p>)}
            </div>
          )}
          {siteAudit.warnings.length > 0 && (
            <div className="tayar-v2-check-list">
              {siteAudit.warnings.slice(0, 12).map((item) => <p key={item}>• {item}</p>)}
            </div>
          )}
          {!siteAudit.errors.length && !siteAudit.warnings.length && (
            <div className="tayar-v2-manual-note">No site issues detected.</div>
          )}
          <button
            type="button"
            className="tayar-v2-manual-action"
            disabled={launchCheckBusy}
            onClick={() => void runV1LaunchChecks()}
          >
            {launchCheckBusy ? 'Checking…' : 'Run check again'}
          </button>
        </div>
      </details>

      <details open className="tayar-v2-manual-section">
        <summary>Publishing</summary>
        <div className="tayar-v2-manual-fields">
          <div
            className="tayar-v2-publish-state"
            data-live={publishedUrl && liveVerification === 'healthy' ? 'true' : 'false'}
          >
            <strong>
              {!publishedUrl
                ? 'DRAFT'
                : liveVerification === 'checking'
                  ? 'VERIFYING'
                  : liveVerification === 'failed'
                    ? 'CHECK FAILED'
                    : liveVerification === 'healthy'
                      ? 'LIVE'
                      : 'PUBLISHED'}
            </strong>
            <span>
              {!publishedUrl
                ? 'Your website is saved but not public.'
                : liveVerification === 'failed'
                  ? 'A published URL is saved, but the live file could not be verified.'
                  : liveVerification === 'checking'
                    ? 'Checking the public website now…'
                    : liveVerification === 'healthy'
                      ? 'Your website is public.'
                      : 'The website is published. Verify the live renderer before treating it as live.'}
            </span>
          </div>
          {publishedUrl && (
            <>
              <label>
                <span>Live URL</span>
                <input value={publishedUrl} readOnly />
              </label>
              {publishedAt && <div className="tayar-v2-manual-note">Published {new Date(publishedAt).toLocaleString()}</div>}
              <div className="tayar-v2-publish-actions">
                <button type="button" className="tayar-v2-manual-action" onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}>Open live site</button>
                <button type="button" className="tayar-v2-manual-action" onClick={() => void navigator.clipboard.writeText(publishedUrl)}>Copy URL</button>
                <button type="button" className="tayar-v2-manual-action" disabled={liveVerification === 'checking'} onClick={() => void verifyLiveDeployment()}>
                  {liveVerification === 'checking' ? 'Verifying…' : 'Verify live'}
                </button>
                <button type="button" className="tayar-v2-manual-action is-danger" disabled={publishBusy} onClick={() => void unpublishWebsite()}>Unpublish</button>
              </div>
            </>
          )}
          {publishError && (
            <div className="tayar-v2-publish-error">{publishError}</div>
          )}
          {cloudError && (
            <div className="tayar-v2-publish-error">{cloudError}</div>
          )}
          {!publishedUrl && (
            <button type="button" className="tayar-v2-manual-action" disabled={publishBusy || !projectTeamAccess.canPublish || siteAudit.errors.length > 0} onClick={() => void publishWebsite()}>
              {publishBusy ? 'Publishing…' : siteAudit.errors.length ? 'Fix critical Check issues first' : 'Publish website'}
            </button>
          )}
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>SEO</summary>
        <div className="tayar-v2-manual-fields">
          <label><span>Site title</span><input value={seo.title} onChange={(e) => { setSeo((current) => ({ ...current, title: e.target.value })); setSaved(false); }} /></label>
          <label><span>Description</span><textarea rows={4} value={seo.description} onChange={(e) => { setSeo((current) => ({ ...current, description: e.target.value })); setSaved(false); }} /></label>
          <label><span>Keywords</span><textarea rows={3} value={seo.keywords.join(', ')} onChange={(e) => { setSeo((current) => ({ ...current, keywords: e.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 40) })); setSaved(false); }} /></label>
          <div className="tayar-v2-manual-note">Audit: {siteAudit.score}/100 · {siteAudit.errors.length} critical · {siteAudit.warnings.length} warnings</div>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>Analytics & verification</summary>
        <div className="tayar-v2-manual-fields">
          <label><span>Google Analytics 4</span><input value={productionConfig.ga4Id} disabled={!billingEntitlements.features.productionIntegrations} placeholder="G-XXXX" onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, ga4Id: e.target.value })); setSaved(false); }} /></label>
          <label><span>Google Tag Manager</span><input value={productionConfig.gtmId} disabled={!billingEntitlements.features.productionIntegrations} placeholder="GTM-XXXX" onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, gtmId: e.target.value })); setSaved(false); }} /></label>
          <label><span>Meta Pixel</span><input value={productionConfig.metaPixelId} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, metaPixelId: e.target.value })); setSaved(false); }} /></label>
          <label><span>Plausible domain</span><input value={productionConfig.plausibleDomain} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, plausibleDomain: e.target.value })); setSaved(false); }} /></label>
          <label><span>Google verification</span><input value={productionConfig.googleVerification} onChange={(e) => { setProductionConfig((current) => ({ ...current, googleVerification: e.target.value })); setSaved(false); }} /></label>
          <label><span>Bing verification</span><input value={productionConfig.bingVerification} onChange={(e) => { setProductionConfig((current) => ({ ...current, bingVerification: e.target.value })); setSaved(false); }} /></label>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>Structured data</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>Organization schema</span><input type="checkbox" checked={productionConfig.organizationSchema} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationSchema: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>Local business schema</span><input type="checkbox" checked={productionConfig.localBusinessSchema} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessSchema: e.target.checked })); setSaved(false); }} /></label>
          <label><span>Organization name</span><input value={productionConfig.organizationName} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationName: e.target.value })); setSaved(false); }} /></label>
          <label><span>Organization URL</span><input value={productionConfig.organizationUrl} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>Organization logo</span><input value={productionConfig.organizationLogo} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationLogo: e.target.value })); setSaved(false); }} /></label>
          {productionConfig.localBusinessSchema && <>
            <label><span>Business type</span><input value={productionConfig.localBusinessType} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessType: e.target.value })); setSaved(false); }} /></label>
            <label><span>Phone</span><input value={productionConfig.localBusinessPhone} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessPhone: e.target.value })); setSaved(false); }} /></label>
            <label><span>Address</span><input value={productionConfig.localBusinessAddress} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessAddress: e.target.value })); setSaved(false); }} /></label>
          </>}
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>Production</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>Maintenance mode</span><input type="checkbox" checked={productionConfig.maintenanceMode} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceMode: e.target.checked })); setSaved(false); }} /></label>
          {productionConfig.maintenanceMode && <>
            <label><span>Maintenance title</span><input value={productionConfig.maintenanceTitle} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceTitle: e.target.value })); setSaved(false); }} /></label>
            <label><span>Maintenance message</span><textarea rows={3} value={productionConfig.maintenanceText} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceText: e.target.value })); setSaved(false); }} /></label>
          </>}
          <label><span>Global custom CSS</span><textarea rows={7} value={productionConfig.customCss} disabled={!billingEntitlements.features.customCss} onChange={(e) => { if (!requireBillingFeature('customCss', 'Global custom CSS')) return; setProductionConfig((current) => ({ ...current, customCss: e.target.value })); setSaved(false); }} /></label>
          <label><span>Extra robots.txt rules</span><textarea rows={5} value={productionConfig.customRobotsRules} onChange={(e) => { setProductionConfig((current) => ({ ...current, customRobotsRules: e.target.value })); setSaved(false); }} /></label>
          <button type="button" className="tayar-v2-manual-action" onClick={() => setReleaseHistoryOpen(true)}>Release history</button>
          <button type="button" className="tayar-v2-manual-action" onClick={() => setDeliveryOpen(true)}>Client delivery</button>
        </div>
      </details>
    </div>
  );

  const v2Canvas = (
        <div data-tayar-v2-canvas="true"
          className={`min-h-[600px] flex-1 overflow-auto p-3 lg:p-5 ${
            darkMode ? 'bg-[#050914]' : 'bg-[#f3f4f6]'
          }`}
        >
          <div
            className={`mx-auto overflow-hidden rounded-xl border shadow-xl transition-all duration-200 ${
              device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : 'w-full max-w-6xl'
            } ${darkMode ? 'border-white/10 bg-[#0f172a]' : 'border-gray-200 bg-white'}`}
            style={{ fontFamily: `${theme.fontFamily}, Arial, sans-serif` }}
          >
            {headerConfig.enabled && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ background: headerConfig.backgroundColor, color: headerConfig.textColor, borderColor: headerConfig.borderColor }}>
                <div className="flex min-w-0 items-center gap-2 font-bold" style={{ fontSize: `${headerConfig.brandSize}px` }}>
                  {headerConfig.logoUrl && <img src={headerConfig.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span className="truncate">{headerConfig.brandText.trim() || siteName}</span>
                </div>
                {device === 'mobile' && headerConfig.mobileMenu ? (
                  <div className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold" style={{ color: headerConfig.textColor, borderColor: headerConfig.borderColor }}>☰ Menu</div>
                ) : (
                  <div className="flex flex-wrap items-center justify-end text-[10px]" style={{ color: headerConfig.textColor, gap: `${headerConfig.navGap}px`, fontSize: `${headerConfig.navSize}px` }}>
                    {pages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id} className={page.id === activePageId ? 'font-bold' : ''} style={{ color: page.id === activePageId ? headerConfig.activeColor : headerConfig.textColor }}>{page.name}</span>)}
                    {headerConfig.showCta && <span className="px-2.5 py-1.5 font-bold" style={{ background: headerConfig.ctaBackgroundColor, color: headerConfig.ctaTextColor, borderRadius: `${theme.buttonRadius}px` }}>{headerConfig.ctaLabel}</span>}
                  </div>
                )}
              </div>
            )}
            {sections.map((section, sectionIndex) => (
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
      onSelect={() => { setSelectedId(section.id); setSelectedElementId(null); }}
      onSelectElement={(elementId) => { setSelectedId(section.id); setSelectedElementId(elementId); }}
      draggedElementId={draggedElementId}
      dragOverElementId={dragOverElementId}
      dragOverElementPosition={dragOverElementPosition}
      onElementDragStart={(elementId, e) => handleElementDragStart(section.id, elementId, e)}
      onElementDragMove={(elementId, e) => handleElementDragMove(section.id, elementId, e)}
      onElementDragOver={(elementId, e) => handleElementDragOver(section.id, elementId, e)}
      onElementDrop={(elementId, e) => handleElementDrop(section.id, elementId, e)}
      onElementDragEnd={handleElementDragEnd}
      onResizeElementStart={(elementId) => beginElementResize(section.id, elementId)}
      onResizeElementWidth={(elementId, width) => resizeElementWidth(section.id, elementId, width)}
      onResetElementPosition={(elementId) => resetElementPosition(section.id, elementId)}
      onQuickUpdateElement={(elementId, changes) => quickUpdateElement(section.id, elementId, changes)}
      onOpenMediaLibrary={() => { setSelectedId(section.id); setMediaOpen(true); }}
      onOpenInspector={() => setInspectorOpen(true)}
      onDuplicateSelectedElement={duplicateSelectedElement}
      onDeleteSelectedElement={deleteSelectedElement}
      onInlineContentChange={(elementId, content) => updateInlineElementContent(section.id, elementId, content)}
      onInlineSourceChange={(elementId, src) => updateInlineElementSource(section.id, elementId, src)}
      onAddElement={(type) => addElementToSection(section.id, type)}
      onMoveSection={(direction) => moveSection(section.id, direction)}
      onDeleteSection={() => deleteSection(section.id)}
      canMoveSectionUp={sectionIndex > 0}
      canMoveSectionDown={sectionIndex < sections.length - 1}
      canDeleteSection={sections.length > 1}
      device={device}
      theme={theme}
    />

  </div>
))}
            {footerConfig.enabled && (
              <div className="border-t border-white/10 px-5 py-5" style={{ background: theme.secondaryColor, color: theme.textColor }}>
                <div className="flex flex-wrap items-start justify-between gap-4 text-[10px]">
                  <div><p className="font-bold">{headerConfig.brandText.trim() || siteName}</p><p className="mt-1" style={{ color: theme.mutedTextColor }}>{footerConfig.text.trim() || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`}</p></div>
                  {footerConfig.showNavigation && <div className="flex flex-wrap gap-3" style={{ color: theme.mutedTextColor }}>{pages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id}>{page.name}</span>)}</div>}
                  <div className="flex flex-wrap gap-3" style={{ color: theme.mutedTextColor }}>{footerConfig.instagramUrl && <span>Instagram</span>}{footerConfig.facebookUrl && <span>Facebook</span>}{footerConfig.linkedinUrl && <span>LinkedIn</span>}{footerConfig.xUrl && <span>X</span>}</div>
                </div>
              </div>
            )}
          </div>
        </div>
  );

  const legacyBuilder = (
    <div data-tayar-v1-root="true"
      className={`-m-4 flex min-h-[calc(100vh-64px)] flex-col lg:-m-8 ${
        darkMode ? 'bg-[#06060f] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <header data-tayar-v1-header="true"
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 ${
          darkMode
            ? 'border-white/10 bg-[#0a0a1a]'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/12">
            <Globe className="h-4 w-4 text-violet-400" />
          </div>

          <div>
            <h1 className="text-sm font-bold">{l('Website Builder')}</h1>
            <p className={`hidden text-[10px] lg:block ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {l('Build, preview and publish')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={siteName}
            onChange={(e) => {
              setSiteName(e.target.value);
              setSaved(false);
            }}
            className={`hidden md:block w-32 xl:w-36 rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-violet-500 ${
              darkMode
                ? 'border-white/10 bg-white/5 text-white'
                : 'border-gray-200 bg-gray-50 text-gray-900'
            }`}
            placeholder={l('Website name')}
          />


          <div
            className={`flex rounded-lg border p-1 ${
              darkMode
                ? 'border-white/10 bg-white/5'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <button
              onClick={() => setDevice('desktop')}
              className={`rounded-md p-2 ${
                device === 'desktop'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title={l('Desktop preview')}
            >
              <Monitor className="h-4 w-4" />
            </button>            <button
              onClick={() => setDevice('tablet')}
              className={`rounded-md p-2 ${
                device === 'tablet'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title={l('Tablet preview')}
            >
              <Monitor className="h-4 w-4" />
            </button>

            <button
              onClick={() => setDevice('mobile')}
              className={`rounded-md p-2 ${
                device === 'mobile'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title={l('Mobile preview')}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const reopenPanels = !leftSidebarOpen && !inspectorOpen;
              setLeftSidebarOpen(reopenPanels);
              setInspectorOpen(reopenPanels);
            }}
            className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-semibold transition ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            title={l(!leftSidebarOpen && !inspectorOpen ? 'Show editing panels' : 'Focus on canvas')}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden 2xl:inline">{l(!leftSidebarOpen && !inspectorOpen ? 'Panels' : 'Focus')}</span>
          </button>

          <button
            onClick={undo}
            disabled={!history.length}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold `}
            title={l('Undo')}
          >
            <RotateCcw className="h-4 w-4" /><span className="sr-only">{l('Undo')}</span></button>

          <button
            onClick={redo}
            disabled={!future.length}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold `}
            title={l('Redo')}
          >
            <RotateCcw className="h-4 w-4 rotate-180" /><span className="sr-only">{l('Redo')}</span></button>


          <details className="relative">
            <summary
              className={'flex cursor-pointer list-none items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden ' + (darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100')}
              title={l('More website tools')}
            >
              {l('More')}
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className={'absolute right-0 top-11 z-[90] w-[min(92vw,430px)] rounded-2xl border p-3 shadow-2xl ' + (darkMode ? 'border-white/10 bg-[#0a0a1a] text-white' : 'border-gray-200 bg-white text-gray-900')}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">{l('Website tools')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{l('Advanced tools stay here until you need them.')}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-gray-500">{BILLING_PLAN_DETAILS[billingPlan].label}</span>
              </div>
              <div className={`mb-3 rounded-xl border p-2.5 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">{l('Project & domain')}</p>
                <input
                  value={siteUrl}
                  onChange={(e) => { setSiteUrl(e.target.value); setSaved(false); }}
                  placeholder="https://your-domain.com"
                  className={`w-full rounded-lg border px-2.5 py-2 text-[11px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                />
                {user && (
                  <select
                    value={cloudProjectId ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) {
                        resetProject();
                        return;
                      }
                      void loadCloudProject(value);
                    }}
                    disabled={cloudBusy}
                    className={`mt-2 w-full rounded-lg border px-2.5 py-2 text-[11px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  >
                    <option value="">{l('Start a new website…')}</option>
                    {cloudProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}{project.user_id !== user.id ? ' · Shared' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMediaOpen((open) => !open)}
            disabled={!user}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              mediaOpen
                ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to use the media library' : 'Open media library'}
          >
            <Images className="h-4 w-4" />
            Media
          </button>

          <button
            onClick={() => setLeadsOpen((open) => !open)}
            disabled={!user || !cloudProjectId}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              leadsOpen
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to view leads' : !cloudProjectId ? 'Save this project to cloud first' : 'Open lead inbox'}
          >
            <Inbox className="h-4 w-4" />
            Leads
            {leads.filter((lead) => lead.status === 'new').length > 0 && (
              <span className="rounded-full bg-cyan-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {leads.filter((lead) => lead.status === 'new').length}
              </span>
            )}
          </button>

          <button
            onClick={() => { if (requireBillingFeature('analytics', 'Site analytics')) setAnalyticsOpen((open) => !open); }}
            disabled={!user || !cloudProjectId}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              analyticsOpen
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to view analytics' : !cloudProjectId ? 'Save this project to cloud first' : 'Open site analytics'}
          >
            <BarChart3 className="h-4 w-4" />{l('Analytics')}</button>

          <button
            onClick={() => { setLaunchCenterOpen((open) => !open); if (!launchCenterOpen) void runV1LaunchChecks(); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              launchCenterOpen
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : v1LaunchStatus.preflightReady
                  ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                  : darkMode
                    ? 'border-white/10 text-gray-300 hover:bg-white/5'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Website Builder V1 launch center')}
          >
            <Check className="h-4 w-4" />
            Launch
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${v1LaunchStatus.status === 'V1 LIVE' ? 'bg-emerald-500 text-white' : v1LaunchStatus.preflightReady ? 'bg-cyan-500 text-white' : 'bg-amber-500/20 text-amber-400'}`}>{v1LaunchStatus.score}</span>
          </button>

          <button
            onClick={() => { setBillingOpen((open) => !open); void refreshBilling(cloudProjectId); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              billingOpen
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Plans, usage and billing')}
          >
            <Sparkles className="h-4 w-4" />
            {BILLING_PLAN_DETAILS[billingPlan].label}
          </button>

          <button
            onClick={() => setOperationsOpen((open) => !open)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              operationsOpen
                ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Operations, backups and exports')}
          >
            Tools
          </button>

          <button
            onClick={() => { if (requireBillingFeature('clientDelivery', 'Client delivery workspace')) setDeliveryOpen((open) => !open); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              deliveryOpen
                ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Client delivery, approval and handoff')}
          >
            Delivery
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${
              deliveryConfig.status === 'delivered' ? 'bg-emerald-500 text-white' : deliveryConfig.status === 'approved' ? 'bg-cyan-500 text-white' : 'bg-fuchsia-500/20 text-fuchsia-400'
            }`}>{deliveryConfig.status}</span>
          </button>

          <button
            onClick={() => setHistoryOpen((open) => !open)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              historyOpen
                ? 'border-violet-500 bg-violet-600/10 text-violet-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Project history')}
          >
            <HistoryIcon className="h-4 w-4" />
            History
          </button>

          <button
            onClick={() => { if (requireBillingFeature('releaseHistory', 'Release history and rollback')) setReleaseHistoryOpen((open) => !open); }}
            disabled={!user || !cloudProjectId}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              releaseHistoryOpen
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to use release history' : !cloudProjectId ? 'Save this project to cloud first' : 'Publish releases, previews and rollback'}
          >
            Releases
            {publishVersions.length > 0 && <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{publishVersions.length}</span>}
          </button>

          <button
            onClick={() => void duplicateProject()}
            disabled={cloudBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
              darkMode
                ? 'border-white/10 text-gray-300 hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Duplicate project')}
          >
            <Copy className="h-4 w-4" />{l('Duplicate')}</button>


              </div>
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">{l('Project actions')}</p>
                <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadProductionZip}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <Download className="h-4 w-4" />
            Export ZIP
          </button>

          <button
            onClick={resetProject}
            className={`rounded-lg border p-2 ${
              darkMode
                ? 'border-white/10 text-gray-400 hover:bg-white/5'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title={l('Reset')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          {publishedUrl && (
            <>
              <button
                onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  darkMode
                    ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                }`}
                title={publishedAt ? `Published ${new Date(publishedAt).toLocaleString()}` : 'Open published website'}
              >
                <ExternalLink className="h-4 w-4" />{l('Live')}</button>
              <button
                onClick={() => void verifyLiveDeployment()}
                disabled={liveVerification === 'checking'}
                className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${
                  liveVerification === 'healthy'
                    ? 'border-emerald-500/30 text-emerald-400'
                    : liveVerification === 'failed'
                      ? 'border-red-500/30 text-red-400'
                      : 'border-white/10 text-gray-400'
                }`}
                title={l('Verify that index.html exists in published storage')}
              >
                {liveVerification === 'checking' ? 'Checking…' : liveVerification === 'healthy' ? 'Live ✓' : liveVerification === 'failed' ? 'Check failed' : 'Verify'}
              </button>
              <button
                onClick={() => void unpublishWebsite()}
                disabled={publishBusy}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                  darkMode
                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border-red-200 text-red-600 hover:bg-red-50'
                }`}
                title={l('Remove public website')}
              >
                Unpublish
              </button>
            </>
          )}

          <span className={`inline-flex text-[11px] ${
            autoSaveStatus === 'saving'
              ? 'text-amber-400'
              : autoSaveStatus === 'saved'
                ? 'text-emerald-400'
                : autoSaveStatus === 'failed'
                  ? 'text-red-400'
                  : darkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {autoSaveStatus === 'saving' ? 'Autosaving…' : autoSaveStatus === 'saved' ? 'Autosaved' : autoSaveStatus === 'failed' ? 'Sync failed' : 'Autosave on'}
          </span>

          <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold ${networkOnline ? (qualityDiagnostics.healthy ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400') : 'border-red-500/30 text-red-400'}`}>
            {networkOnline ? (qualityDiagnostics.healthy ? 'Health ✓' : 'Health warning') : 'Offline'}
          </span>


              </div>
            </div>
          </details>

          <button
            onClick={previewWebsite}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              darkMode
                ? 'border-white/10 text-gray-300 hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ExternalLink className="h-4 w-4" /><span className="hidden 2xl:inline">{l('Preview')}</span></button>

          <button
            onClick={() => void runAIQualityCheck()}
            disabled={aiQualityBusy || aiBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${aiQualityReview && aiQualityReview.score >= 80 ? 'border-emerald-500/30 text-emerald-400' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            title={l('AI quality check before publishing')}
          >
            <Check className="h-4 w-4" />
            <span className="hidden 2xl:inline">{aiQualityBusy ? l('Checking…') : aiQualityReview ? `Check ${aiQualityReview.score}` : l('Check')}</span>
          </button>

          <button
            onClick={() => void saveProject()}
            disabled={cloudBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? 'border-white/10 text-gray-200 hover:bg-white/5' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            title={user ? 'Save locally and to your account' : 'Save locally'}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span className="hidden 2xl:inline">{saved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            onClick={() => void publishWebsite()}
            disabled={!v1LaunchStatus.preflightReady || publishBusy || !projectTeamAccess.canPublish}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={!projectTeamAccess.canPublish ? 'Only the project owner can publish shared projects' : !v1LaunchStatus.preflightReady ? v1LaunchStatus.blockers[0] || 'Complete the Launch Center checks before publishing' : 'Publish website'}
          >
            <Globe className="h-4 w-4" />
            {publishBusy ? 'Publishing…' : publishedUrl ? (hasUnpublishedChanges ? 'Publish Changes' : 'Republish') : 'Publish'}
            {hasUnpublishedChanges && !publishBusy && <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-slate-900">{l('DRAFT')}</span>}
          </button>




        </div>
      </header>

      {publishError && (
        <div className={`border-b px-4 py-2 text-xs ${darkMode ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {publishError}
        </div>
      )}

      {cloudError && (
        <div className={`border-b px-4 py-2 text-xs ${darkMode ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {cloudError}
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
                <p className="mt-1 text-[10px] text-gray-500">{aiQualityReview?.summary || (aiQualityBusy ? l('Reviewing design, content, SEO, accessibility and publish readiness…') : l('Run the final AI review before publishing.'))}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void runAIQualityCheck()} disabled={aiQualityBusy || aiBusy} className="text-xs font-semibold text-emerald-400 disabled:opacity-40">{aiQualityBusy ? l('Checking…') : l('Run again')}</button>
                <button onClick={() => setAiQualityOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {aiQualityReview && (
              <>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {aiQualityReview.findings.map((finding, index) => (
                    <article key={`${finding.title}-${index}`} className={`rounded-xl border p-3 ${darkMode ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-white'}`}>
                      <span className={`text-[8px] font-black uppercase tracking-wider ${finding.severity === 'critical' ? 'text-rose-400' : finding.severity === 'warning' ? 'text-amber-400' : 'text-sky-400'}`}>{finding.severity}</span>
                      <p className="mt-1 text-[10px] font-bold">{finding.title}</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-gray-500">{finding.detail}</p>
                    </article>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {aiQualityReview.fixPrompt && (
                    <button onClick={() => void fixAIQualityIssues()} disabled={aiBusy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{l('Fix safe issues with AI')}</button>
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
        <div className="fixed inset-0 z-[250] flex items-start justify-center bg-black/70 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setCommandOpen(false); }}>
          <div className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${darkMode ? 'border-white/10 bg-[#0b0f18]' : 'border-gray-200 bg-white'}`}>
            <div className="border-b border-white/10 p-3">
              <input autoFocus value={commandQuery} onChange={(e) => setCommandQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setCommandOpen(false); }} placeholder={l('Type a command, page or section…')} className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-sky-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
            </div>
            <div className="max-h-[60vh] overflow-auto p-2">
              {[
                { label: 'Save project', keywords: 'save cloud', run: () => void saveProject() },
                { label: 'Preview website', keywords: 'preview open', run: previewWebsite },
                { label: 'Run AI quality check', keywords: 'check quality seo accessibility publish', run: () => void runAIQualityCheck() },
                { label: 'Duplicate current page', keywords: 'copy page duplicate', run: duplicateActivePage },
                { label: 'Export project backup', keywords: 'backup json export', run: exportProjectBackup },
                { label: 'Import project backup', keywords: 'backup json import restore', run: importProjectBackup },
                ...(recoveryAvailable ? [{ label: 'Restore recovery snapshot', keywords: 'recovery crash restore safety', run: restoreRecoverySnapshot }] : []),
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
              ].filter((item) => !commandQuery.trim() || `${l(item.label)} ${item.keywords}`.toLowerCase().includes(commandQuery.trim().toLowerCase())).slice(0, 24).map((item) => (
                <button key={`${l(item.label)}-${item.keywords}`} onClick={() => { item.run(); setCommandOpen(false); setCommandQuery(''); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${darkMode ? 'text-gray-200 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><span>{l(item.label)}</span><span className="text-[9px] text-gray-500">↵</span></button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-gray-500"><span>Ctrl/Cmd+K</span><button onClick={() => setCommandOpen(false)} className="font-semibold text-violet-400">{l('Close')}</button></div>
          </div>
        </div>
      )}

      {launchCenterOpen && (
        <div className={`border-b px-4 py-4 ${darkMode ? 'border-cyan-500/20 bg-[#06141a]' : 'border-cyan-200 bg-cyan-50/60'}`}>
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400" />
                  <p className="text-sm font-black">{l('Website Builder V1 Launch Center')}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${v1LaunchStatus.status === 'V1 LIVE' ? 'bg-emerald-500 text-white' : v1LaunchStatus.preflightReady ? 'bg-cyan-500 text-white' : 'bg-amber-500/15 text-amber-400'}`}>{v1LaunchStatus.status}</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black text-gray-400">V1.0</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{l('One place to onboard a project, run production checks, publish the release and verify that the live site is healthy.')}</p>
                {launchLastCheckedAt && <p className="mt-1 text-[9px] text-gray-600">Last automated check: {new Date(launchLastCheckedAt).toLocaleString()}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void runV1LaunchChecks()} disabled={launchCheckBusy} className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-black text-white hover:bg-cyan-500 disabled:opacity-50">{launchCheckBusy ? 'Checking…' : 'Run final checks'}</button>
                <button onClick={exportV1LaunchReport} className="rounded-lg border border-cyan-500/25 px-3 py-2 text-[10px] font-bold text-cyan-400">{l('Export launch report')}</button>
                <button onClick={closeLaunchCenter} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[.75fr_1.25fr]">
              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">{l('Final readiness')}</p><p className="mt-1 text-xs text-gray-500">{l('Automated release gate for this project.')}</p></div><span className={`text-4xl font-black ${v1LaunchStatus.score >= 90 ? 'text-emerald-400' : v1LaunchStatus.score >= 70 ? 'text-cyan-400' : 'text-amber-400'}`}>{v1LaunchStatus.score}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${v1LaunchStatus.score >= 90 ? 'bg-emerald-500' : v1LaunchStatus.score >= 70 ? 'bg-cyan-500' : 'bg-amber-500'}`} style={{ width: `${v1LaunchStatus.score}%` }} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Audit')}</p><p className="text-lg font-black">{siteAudit.score}</p></div>
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Health')}</p><p className={`text-lg font-black ${qualityDiagnostics.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>{qualityDiagnostics.healthy ? 'GOOD' : 'CHECK'}</p></div>
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Sync')}</p><p className={`text-lg font-black ${networkOnline && !cloudSyncFailed ? 'text-emerald-400' : 'text-rose-400'}`}>{networkOnline && !cloudSyncFailed ? 'OK' : 'FIX'}</p></div>
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Live')}</p><p className={`text-lg font-black ${liveVerification === 'healthy' ? 'text-emerald-400' : publishedUrl ? 'text-amber-400' : 'text-gray-500'}`}>{liveVerification === 'healthy' ? 'VERIFIED' : publishedUrl ? 'VERIFY' : 'NOT YET'}</p></div>
                </div>
                {v1LaunchStatus.blockers.length > 0 ? <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><p className="text-[10px] font-black uppercase text-rose-400">{l('Launch blockers')}</p><div className="mt-2 space-y-1">{v1LaunchStatus.blockers.map((item) => <p key={item} className="text-[10px] text-rose-300">• {item}</p>)}</div></div> : <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] font-bold text-emerald-400">{l('✓ No critical production blockers detected.')}</div>}
              </div>

              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-violet-400">{l('Automated launch checks')}</p><p className="mt-1 text-[10px] text-gray-500">{l('Publish only after the preflight items are green.')}</p></div><span className="text-[10px] font-bold text-gray-500">{v1LaunchStatus.checks.filter((item) => item.ok).length}/{v1LaunchStatus.checks.length}</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {v1LaunchStatus.checks.map((check) => <div key={check.label} className={`rounded-xl border p-2.5 ${check.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-black/10'}`}><div className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${check.ok ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-500'}`}>{check.ok ? '✓' : '○'}</span><p className={`text-[10px] font-bold ${check.ok ? 'text-emerald-400' : 'text-gray-300'}`}>{check.label}</p></div><p className="mt-1 pl-7 text-[9px] text-gray-500">{check.detail}</p></div>)}
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${darkMode ? 'border-violet-500/15 bg-violet-500/[0.03]' : 'border-violet-100 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black">{l('Quick-start onboarding')}</p><p className="mt-1 text-[10px] text-gray-500">{l('Start from a proven page structure, then complete the production URL and cloud save.')}</p></div><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-black text-violet-400">{l('FIRST PROJECT')}</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                {PAGE_TEMPLATES.slice(0, 6).map((template) => <button key={template.id} onClick={() => applyPageTemplate(template)} className={`rounded-xl border p-2.5 text-left ${darkMode ? 'border-white/10 bg-white/[0.03] hover:border-violet-500/40' : 'border-gray-200 bg-gray-50 hover:border-violet-300'}`}><p className="text-[10px] font-bold">{l(template.name)}</p><p className="mt-1 line-clamp-2 text-[9px] text-gray-500">{l(template.description)}</p></button>)}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <input value={siteName} onChange={(e) => { setSiteName(e.target.value.slice(0, 160)); setSaved(false); }} placeholder={l('Website name')} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} />
                <input value={siteUrl} onChange={(e) => { setSiteUrl(e.target.value.slice(0, 1000)); setSaved(false); }} placeholder="https://example.com" className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} />
                <button onClick={() => void saveProject()} disabled={cloudBusy} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{l('Save project')}</button>
                <button onClick={previewWebsite} className="rounded-lg border border-violet-500/25 px-3 py-2 text-[10px] font-black text-violet-400">{l('Preview')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">{l('Manual production sign-off')}</p>
                <p className="mt-1 text-[10px] text-gray-500">{l('These checks involve external services and must be confirmed by a human before accepting paid customers.')}</p>
                <div className="mt-3 space-y-2">
                  {([
                    ['stripe', 'Stripe test purchase + Customer Portal + webhook verified'],
                    ['domain', 'Production domain / DNS / HTTPS verified'],
                    ['support', 'Support contact + privacy / terms review completed'],
                  ] as const).map(([key, label]) => <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${launchManualChecks[key] ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10'}`}><input type="checkbox" checked={launchManualChecks[key]} onChange={(e) => setLaunchManualCheck(key, e.target.checked)} className="mt-0.5" /><span className={`text-[10px] ${launchManualChecks[key] ? 'font-bold text-emerald-400' : 'text-gray-400'}`}>{label}</span></label>)}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">{l('Release actions')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => { setBillingOpen(true); void refreshBilling(cloudProjectId); }} className="rounded-xl border border-white/10 p-3 text-left text-[10px] font-bold">{l('Billing & limits')}<div className="mt-1 text-[9px] font-normal text-gray-500">{l('Verify plan and Stripe state')}</div></button>
                  <button onClick={() => setOperationsOpen(true)} className="rounded-xl border border-white/10 p-3 text-left text-[10px] font-bold">{l('Audit & backups')}<div className="mt-1 text-[9px] font-normal text-gray-500">{l('Export backup and diagnostics')}</div></button>
                  <button onClick={() => void publishWebsite()} disabled={!v1LaunchStatus.preflightReady || publishBusy || !projectTeamAccess.canPublish} className="rounded-xl bg-sky-600 p-3 text-left text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{publishedUrl ? 'Publish production changes' : 'Publish first release'}<div className="mt-1 text-[9px] font-normal text-sky-100">{l('Blocked until automated preflight is ready')}</div></button>
                  <button onClick={() => void verifyLiveDeployment()} disabled={!publishedUrl || liveVerification === 'checking'} className="rounded-xl border border-emerald-500/20 p-3 text-left text-[10px] font-bold text-emerald-400 disabled:opacity-40">{l('Verify live release')}<div className="mt-1 text-[9px] font-normal text-gray-500">{l('Confirm index.html is deployed')}</div></button>
                </div>
                <div className={`mt-3 rounded-xl border p-3 ${v1LaunchStatus.status === 'V1 LIVE' && Object.values(launchManualChecks).every(Boolean) ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/10'}`}>
                  <p className="text-[10px] font-black">{l('V1 release decision')}</p>
                  <p className={`mt-1 text-xs font-black ${v1LaunchStatus.status === 'V1 LIVE' && Object.values(launchManualChecks).every(Boolean) ? 'text-emerald-400' : 'text-amber-400'}`}>{v1LaunchStatus.status === 'V1 LIVE' && Object.values(launchManualChecks).every(Boolean) ? 'GO — READY FOR FIRST PAYING CUSTOMERS' : v1LaunchStatus.preflightReady ? 'CODE READY — COMPLETE PUBLISH / MANUAL CHECKS' : 'NO-GO — FIX AUTOMATED BLOCKERS'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {billingOpen && (
        <div className={`border-b px-4 py-4 ${darkMode ? 'border-emerald-500/20 bg-[#07140f]' : 'border-emerald-200 bg-emerald-50/60'}`}>
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-bold">{l('Plans & Billing')}</p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">{BILLING_PLAN_DETAILS[billingPlan].badge}</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{l('Secure entitlements, usage limits and Stripe subscription management.')}</p>
                {billingState.subscription?.status && (
                  <p className="mt-1 text-[10px] text-gray-500">
                    Subscription: <span className="font-semibold text-gray-300">{billingState.subscription.status}</span>
                    {billingState.subscription.currentPeriodEnd ? ` · period ends ${new Date(billingState.subscription.currentPeriodEnd).toLocaleDateString()}` : ''}
                    {billingState.subscription.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {billingState.subscription?.stripeCustomerId && (
                  <button onClick={() => void openBillingPortal()} disabled={billingBusy} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-[10px] font-bold text-emerald-400 disabled:opacity-50">{l('Manage subscription')}</button>
                )}
                <button onClick={() => void refreshBilling(cloudProjectId)} disabled={billingLoading} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-400 disabled:opacity-50">{billingLoading ? 'Refreshing…' : 'Refresh'}</button>
                <button onClick={() => setBillingOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {billingError && (
              <div className={`rounded-xl border px-3 py-2 text-[11px] ${darkMode ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{billingError}</div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              {(['free', 'pro', 'business'] as BillingPlan[]).map((plan) => {
                const details = BILLING_PLAN_DETAILS[plan];
                const current = billingPlan === plan;
                const isPaid = plan !== 'free';
                return (
                  <div key={plan} className={`rounded-2xl border p-4 ${current ? 'border-emerald-500/50 bg-emerald-500/10' : darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black">{details.label}</p>
                        <p className="mt-1 text-[10px] text-gray-500">{details.description}</p>
                      </div>
                      {current && <span className="rounded-full bg-emerald-500 px-2 py-1 text-[8px] font-black text-white">{l('CURRENT')}</span>}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {details.bullets.map((bullet) => <p key={bullet} className="text-[10px] text-gray-400">✓ {bullet}</p>)}
                    </div>
                    <div className="mt-4">
                      {current ? (
                        <div className="rounded-lg border border-emerald-500/20 px-3 py-2 text-center text-[10px] font-bold text-emerald-400">{l('Active plan')}</div>
                      ) : isPaid ? (
                        <button onClick={() => void startBillingCheckout(plan)} disabled={billingBusy} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-violet-500 disabled:opacity-50">{billingBusy ? 'Opening Stripe…' : `Choose ${details.label}`}</button>
                      ) : billingState.subscription?.stripeCustomerId ? (
                        <button onClick={() => void openBillingPortal()} disabled={billingBusy} className="w-full rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-400 disabled:opacity-50">{l('Manage downgrade in Stripe')}</button>
                      ) : (
                        <div className="rounded-lg border border-white/10 px-3 py-2 text-center text-[10px] text-gray-500">{l('Default plan')}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold">{l('Website Builder Usage')}</p>
                <p className="text-[9px] text-gray-500">{l('Limits are also enforced by Supabase for project/page growth.')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ['Projects', billingState.usage.websiteProjects, billingEntitlements.maxWebsiteProjects],
                  ['Pages', pages.length, billingEntitlements.maxPages],
                  ['Releases', billingState.usage.releases, billingEntitlements.maxReleaseHistory],
                  ['Leads', Math.max(billingState.usage.leads, leads.length), billingEntitlements.maxLeads],
                  ['Analytics', Math.max(billingState.usage.analyticsEvents, analyticsEvents.length), billingEntitlements.maxAnalyticsEvents],
                ].map(([label, rawValue, rawLimit]) => {
                  const value = Number(rawValue) || 0;
                  const limit = Number(rawLimit) || 1;
                  const percent = Math.min(100, Math.round((value / limit) * 100));
                  return <div key={String(label)} className="rounded-xl border border-white/10 p-3"><div className="flex items-center justify-between text-[10px]"><span className="font-semibold">{label}</span><span className="text-gray-500">{value}/{limit.toLocaleString()}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div></div>;
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-gray-500">
              <span>Paid prices are controlled by STRIPE_PRO_PRICE_ID and STRIPE_BUSINESS_PRICE_ID, so the app never trusts a browser-supplied amount.</span>
              <span>Webhook is the source of truth for upgrades, renewals, cancellation and payment status.</span>
            </div>
          </div>
        </div>
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
                  <label className="flex items-end gap-2 rounded-lg border border-fuchsia-500/15 px-3 py-2 text-[10px] text-gray-400"><input type="checkbox" checked={deliveryConfig.whiteLabel} disabled={!billingEntitlements.features.whiteLabel} onChange={(e) => { if (!requireBillingFeature('whiteLabel', 'White-label client delivery')) return; setDeliveryConfig((current) => ({ ...current, whiteLabel: e.target.checked })); }} /> White-label client handoff files {!billingEntitlements.features.whiteLabel && <span className="font-bold text-amber-400">BUSINESS</span>}</label>
                </div>
                <label className="mt-2 block text-[10px] text-gray-500">{l('Handoff notes')}<textarea value={deliveryConfig.handoffNotes} onChange={(e) => setDeliveryConfig((current) => ({ ...current, handoffNotes: e.target.value.slice(0, 4000) }))} rows={4} placeholder="Hosting notes, DNS details, next steps, support terms…" className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">{l('Launch readiness')}</p><span className={`text-2xl font-black ${launchReadiness.score >= 85 ? 'text-emerald-400' : launchReadiness.score >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>{launchReadiness.score}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${launchReadiness.score}%` }} /></div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
                  {launchReadiness.checks.map((item) => <div key={l(item.label)} className={`rounded-lg border px-2 py-1.5 ${item.ok ? 'border-emerald-500/20 text-emerald-400' : 'border-white/10 text-gray-500'}`}>{item.ok ? '✓' : '○'} {l(item.label)}</div>)}
                </div>
                <p className="mt-2 text-[9px] text-gray-500">Audit contributes {launchReadiness.auditPoints}/40 points · current audit {siteAudit.score}/100.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {[
                ['Pages', deliveryUsage.pages], ['Sections', deliveryUsage.sections], ['Elements', deliveryUsage.elements], ['Forms', deliveryUsage.forms], ['Symbols', deliveryUsage.symbols], ['Releases', deliveryUsage.releases], ['Leads', deliveryUsage.leads], ['Events', deliveryUsage.analyticsEvents], ['Media*', deliveryUsage.mediaLoaded],
              ].map(([label, value]) => <div key={String(label)} className={`rounded-xl border p-2 text-center ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}><p className="text-[9px] uppercase text-gray-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}
            </div>
            <p className="-mt-2 text-[9px] text-gray-500">*Media count reflects assets currently loaded into the Media Library panel.</p>

            <div className={`rounded-xl border p-3 ${approvalCurrent ? 'border-emerald-500/25 bg-emerald-500/5' : deliveryConfig.approvedAt ? 'border-amber-500/25 bg-amber-500/5' : darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">{l('Client approval fingerprint')}</p>
                  <p className={`mt-1 text-[10px] ${approvalCurrent ? 'text-emerald-400' : deliveryConfig.approvedAt ? 'text-amber-400' : 'text-gray-500'}`}>{deliveryConfig.approvedAt ? (approvalCurrent ? `Approved ${new Date(deliveryConfig.approvedAt).toLocaleString()} — current build still matches` : `Approved ${new Date(deliveryConfig.approvedAt).toLocaleString()} — website changed after approval`) : 'No approval snapshot recorded yet.'}</p>
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
              <button onClick={() => setReleaseHistoryOpen(true)} disabled={!user || !cloudProjectId} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{l('Open releases')}<div className="mt-1 text-[10px] font-normal text-gray-500">{publishVersions.length} loaded releases</div></button>
              <button onClick={() => previewUrl ? window.open(previewUrl, '_blank', 'noopener,noreferrer') : setReleaseHistoryOpen(true)} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{previewUrl ? 'Open client preview' : 'Create client preview'}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Unlisted review link')}</div></button>
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
              <button onClick={exportAuditReport} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export audit report')}<div className="mt-1 text-[10px] font-normal text-gray-500">Score {siteAudit.score}/100</div></button>
              <button onClick={() => void copyProjectSummary()} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{copied ? 'Summary copied' : 'Copy project summary'}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Pages, elements and health')}</div></button>
              <button onClick={exportLeadsCsv} disabled={!leads.length} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export leads CSV')}<div className="mt-1 text-[10px] font-normal text-gray-500">{leads.length} loaded leads</div></button>
              <button onClick={exportAnalyticsCsv} disabled={!analyticsEvents.length} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export analytics CSV')}<div className="mt-1 text-[10px] font-normal text-gray-500">{analyticsEvents.length} loaded events</div></button>
              <button onClick={() => void markAllLeadsRead()} disabled={!leads.some((lead) => lead.status === 'new')} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Mark all leads read')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Bulk inbox cleanup')}</div></button>
              <button onClick={() => void archiveReadLeads()} disabled={!leads.some((lead) => lead.status === 'read')} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Archive read leads')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Keep inbox focused')}</div></button>
            </div>
            <p className="text-[10px] text-gray-500">Shortcuts: Ctrl/Cmd+K commands · Ctrl/Cmd+S save · Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo · Ctrl/Cmd+Shift+P preview.</p>
          </div>
        </div>
      )}

      {analyticsOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-amber-500/20 bg-[#181208]' : 'border-amber-200 bg-amber-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Site Analytics')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Last 30 days. Anonymous session IDs only; no IP addresses are stored.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportAnalyticsCsv} disabled={!analyticsEvents.length} className="text-xs font-semibold text-sky-400 disabled:opacity-40">CSV</button>
                <button onClick={() => void refreshAnalytics()} disabled={analyticsLoading} className="text-xs font-semibold text-amber-400 disabled:opacity-50">
                  {analyticsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={() => setAnalyticsOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {analyticsError && <p className="text-xs text-amber-400">{analyticsError}</p>}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {[
                ['Views · 30d', analyticsSummary.views],
                ['Visitors · 30d', analyticsSummary.sessions],
                ['Views · 7d', analyticsSummary.last7Days],
                ['Views · Today', analyticsSummary.todayViews],
                ['CTA clicks', analyticsSummary.ctaClicks],
                ['Form submits', analyticsSummary.formSubmits],
                ['Form CVR', `${analyticsSummary.conversionRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                  <p className="mt-1 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>

            {!analyticsLoading && !analyticsEvents.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>
                No page views yet. Publish or export the site with Sprint 15 tracking enabled, then visits will appear here.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <p className="mb-2 text-xs font-bold">{l('Top pages')}</p>
                  <div className="space-y-2">
                    {analyticsSummary.topPages.map(([page, count]) => (
                      <div key={page} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate" title={page}>{page}</span>
                        <span className="font-bold text-amber-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <p className="mb-2 text-xs font-bold">{l('Traffic sources')}</p>
                  <div className="space-y-2">
                    {analyticsSummary.topReferrers.map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate" title={source}>{source}</span>
                        <span className="font-bold text-amber-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mediaOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-fuchsia-500/20 bg-[#170b18]' : 'border-fuchsia-200 bg-fuchsia-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Media Library')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Upload reusable images to your account and place them into any image element.
                </p>
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

            {mediaError && <p className="text-xs text-amber-400">{mediaError}</p>}

            {!mediaLoading && !mediaAssets.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>
                No images yet. Upload JPG, PNG, WebP or GIF files up to 5 MB.
              </div>
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
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-cyan-500/20 bg-[#08131a]' : 'border-cyan-200 bg-cyan-50/50'}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Lead CRM')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('Search, qualify, prioritize and follow up with website leads.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={exportLeadsCsv} disabled={!leads.length} className="text-xs font-semibold text-sky-400 disabled:opacity-40">CSV</button>
                <button onClick={() => void markAllLeadsRead()} disabled={!leads.some((lead) => lead.status === 'new')} className="text-xs font-semibold text-emerald-400 disabled:opacity-40">{l('Read all')}</button>
                <button onClick={() => void archiveReadLeads()} disabled={!leads.some((lead) => lead.status === 'read')} className="text-xs font-semibold text-gray-400 disabled:opacity-40">{l('Archive read')}</button>
                <button onClick={() => void refreshLeads()} disabled={leadsLoading} className="text-xs font-semibold text-cyan-400 disabled:opacity-50">{leadsLoading ? 'Refreshing…' : 'Refresh'}</button>
                <button onClick={() => setLeadsOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {[
                ['Total', leadCrmSummary.total],
                ['New', leadCrmSummary.newCount],
                ['Qualified', leadCrmSummary.qualified],
                ['Contacted', leadCrmSummary.contacted],
                ['Won', leadCrmSummary.won],
                ['Lost', leadCrmSummary.lost],
                ['High priority', leadCrmSummary.highPriority],
                ['Win rate', `${leadCrmSummary.winRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className={`rounded-xl border p-2 ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-100 bg-white'}`}>
                  <p className="text-[9px] uppercase tracking-wide text-gray-500">{label}</p>
                  <p className="mt-1 text-sm font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search name, email, message, tags…" className={`min-w-56 flex-1 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
              <select value={leadStatusFilter} onChange={(e) => setLeadStatusFilter(e.target.value as 'all' | WebsiteLead['status'])} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                <option value="all">{l('All inbox statuses')}</option><option value="new">{l('New')}</option><option value="read">{l('Read')}</option><option value="archived">{l('Archived')}</option>
              </select>
              <select value={leadStageFilter} onChange={(e) => setLeadStageFilter(e.target.value as 'all' | LeadStage)} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                <option value="all">{l('All CRM stages')}</option><option value="new">{l('New')}</option><option value="qualified">{l('Qualified')}</option><option value="contacted">{l('Contacted')}</option><option value="won">{l('Won')}</option><option value="lost">{l('Lost')}</option>
              </select>
              <button type="button" onClick={() => setSelectedLeadIds(filteredLeads.map((lead) => lead.id))} disabled={!filteredLeads.length} className="rounded-lg border border-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-400 disabled:opacity-40">{l('Select shown')}</button>
              {!!selectedLeadIds.length && <button type="button" onClick={() => setSelectedLeadIds([])} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400">Clear ({selectedLeadIds.length})</button>}
            </div>

            {!!selectedLeadIds.length && (
              <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
                <span className="text-[10px] font-bold text-violet-400">{l('Bulk stage:')}</span>
                {(['qualified', 'contacted', 'won', 'lost'] as LeadStage[]).map((stage) => <button key={stage} type="button" onClick={() => void bulkUpdateLeadStage(stage)} className="rounded border border-violet-500/20 px-2 py-1 text-[10px] font-semibold capitalize text-violet-400">{stage}</button>)}
              </div>
            )}

            {leadsError && <p className="text-xs text-amber-400">{leadsError}</p>}

            {!leadsLoading && !leads.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l('No leads yet. Publish a website with a Contact section, then submissions will appear here.')}</div>
            ) : !leadsLoading && !filteredLeads.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l('No leads match the current search and filters.')}</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredLeads.map((lead) => {
                  const meta = getWebsiteLeadSource(lead);
                  const phone = getWebsiteLeadPhone(lead);
                  const stage = lead.stage || 'new';
                  const visibleFormData = Object.entries(lead.form_data || {}).filter(([key]) => !key.startsWith('_'));
                  return (
                  <article key={lead.id} className={`rounded-xl border p-3 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={(e) => setSelectedLeadIds((current) => e.target.checked ? [...new Set([...current, lead.id])] : current.filter((id) => id !== lead.id))} />
                        <div className="min-w-0">
                          <p className="truncate font-bold">{lead.name}</p>
                          {lead.email && <a href={`mailto:${lead.email}`} className="block truncate text-cyan-400">{lead.email}</a>}
                          {phone && <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="block truncate text-emerald-400">{phone}</a>}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${lead.status === 'new' ? 'bg-cyan-500/15 text-cyan-400' : lead.status === 'archived' ? 'bg-gray-500/15 text-gray-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{lead.status}</span>
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <select value={stage} onChange={(e) => void updateLeadCrm(lead.id, { stage: e.target.value as LeadStage })} className={`rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                        <option value="new">{l('New')}</option><option value="qualified">{l('Qualified')}</option><option value="contacted">{l('Contacted')}</option><option value="won">{l('Won')}</option><option value="lost">{l('Lost')}</option>
                      </select>
                      <select value={Number(lead.priority || 0)} onChange={(e) => void updateLeadCrm(lead.id, { priority: Number(e.target.value) })} className={`rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                        <option value={0}>{l('Normal priority')}</option><option value={1}>{l('★ Priority')}</option><option value={2}>{l('★★ High priority')}</option>
                      </select>
                    </div>

                    {(meta.source || meta.campaign || meta.referrer) && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {meta.source && <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[9px] text-fuchsia-400">Source: {meta.source}{meta.medium ? ` / ${meta.medium}` : ''}</span>}
                        {meta.campaign && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-400">Campaign: {meta.campaign}</span>}
                        {!meta.source && meta.referrer && <span className="max-w-full truncate rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] text-sky-400">Referrer: {meta.referrer}</span>}
                      </div>
                    )}

                    {!!lead.tags?.length && <div className="mb-2 flex flex-wrap gap-1">{lead.tags.map((tag) => <span key={tag} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400">#{tag}</span>)}</div>}
                    <p className={`mb-3 whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{lead.message}</p>
                    {!!visibleFormData.length && (
                      <div className={`mb-3 grid gap-1 rounded-lg border p-2 ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-100 bg-gray-50'}`}>
                        {visibleFormData.map(([key, value]) => <div key={key} className="grid grid-cols-[90px_1fr] gap-2 text-[10px]"><span className="truncate font-semibold text-gray-500">{key}</span><span className={`break-words ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '')}</span></div>)}
                      </div>
                    )}
                    {lead.notes && <div className={`mb-2 rounded-lg border p-2 text-[10px] ${darkMode ? 'border-amber-500/20 bg-amber-500/5 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><strong>{l('Notes:')}</strong> {lead.notes}</div>}
                    {lead.page_path && <p className="mb-1 text-[10px] text-gray-500">Page: {lead.page_path}</p>}
                    <p className="mb-3 text-[10px] text-gray-500">{new Date(lead.created_at).toLocaleString()}</p>
                    <div className="flex flex-wrap gap-2">
                      {lead.status === 'new' && <button onClick={() => void updateLeadStatus(lead.id, 'read')} className="font-semibold text-emerald-400">{l('Mark read')}</button>}
                      {lead.status !== 'archived' && <button onClick={() => void updateLeadStatus(lead.id, 'archived')} className="font-semibold text-gray-400">{l('Archive')}</button>}
                      <button onClick={() => { const value = window.prompt('Comma-separated tags', (lead.tags || []).join(', ')); if (value !== null) void updateLeadCrm(lead.id, { tags: value.split(',').map((tag) => tag.trim()).filter(Boolean) }); }} className="font-semibold text-amber-400">{l('Tags')}</button>
                      <button onClick={() => { const value = window.prompt('Lead notes', lead.notes || ''); if (value !== null) void updateLeadCrm(lead.id, { notes: value }); }} className="font-semibold text-violet-400">{l('Notes')}</button>
                      <button onClick={() => void copyLeadSummary(lead)} className="font-semibold text-sky-400">Copy</button>
                      <button onClick={() => void deleteLead(lead.id)} className="font-semibold text-rose-400">{l('Delete')}</button>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {releaseHistoryOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-indigo-500/20 bg-[#0b0d1d]' : 'border-indigo-200 bg-indigo-50/40'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Release Management')}</p>
                <p className="text-[10px] text-gray-500">{l('Immutable publish archives, live rollback and unlisted draft previews.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void refreshPublishVersions()} disabled={publishVersionsLoading} className="text-xs font-semibold text-indigo-400">{publishVersionsLoading ? 'Refreshing…' : 'Refresh'}</button>
                <button onClick={() => setReleaseHistoryOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-400">{l('Next release')}</p>
                <textarea value={releaseNote} onChange={(e) => setReleaseNote(e.target.value.slice(0, 500))} rows={2} placeholder={l('Release note (optional): what changed?')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className={`rounded-full px-2 py-1 ${hasUnpublishedChanges ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{publishedUrl ? (hasUnpublishedChanges ? 'Unpublished changes' : 'Editor matches live release') : 'Not published yet'}</span>
                  {lastPublishedVersionId && <span className="text-gray-500">Release: {lastPublishedVersionId.slice(0, 8)}</span>}
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-cyan-400">{l('Unlisted share preview')}</p>
                {previewUrl ? (
                  <>
                    <p className="truncate text-[10px] text-cyan-400">{previewUrl}</p>
                    <p className="mt-1 text-[9px] text-gray-500">{l('Anyone with this URL can open it. Tracking integrations are disabled in preview.')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')} className="text-xs font-semibold text-cyan-400">{l('Open')}</button>
                      <button onClick={() => void navigator.clipboard.writeText(previewUrl)} className="text-xs font-semibold text-sky-400">Copy</button>
                      <button onClick={() => void createSharePreview()} disabled={previewBusy} className="text-xs font-semibold text-indigo-400">{l('Regenerate')}</button>
                      <button onClick={() => void revokeSharePreview()} disabled={previewBusy} className="text-xs font-semibold text-rose-400">{l('Revoke')}</button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => void createSharePreview()} disabled={previewBusy || !user || !cloudProjectId} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{previewBusy ? 'Creating…' : 'Create share preview'}</button>
                )}
                {previewCreatedAt && <p className="mt-2 text-[9px] text-gray-500">Created {new Date(previewCreatedAt).toLocaleString()}</p>}
                {previewError && <p className="mt-2 text-[10px] text-rose-400">{previewError}</p>}
              </div>
            </div>

            {publishVersionsError && <p className="text-xs text-rose-400">{publishVersionsError}</p>}
            {!publishVersionsLoading && !publishVersions.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l('No releases yet. Add an optional release note and click Publish.')}</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {publishVersions.map((version, index) => (
                  <article key={version.id} className={`rounded-xl border p-3 text-xs ${darkMode ? 'border-white/10 bg-white/[0.04]' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">Release {publishVersions.length - index}</p>
                        <p className="text-[9px] text-gray-500">{new Date(version.created_at).toLocaleString()}</p>
                      </div>
                      {version.id === lastPublishedVersionId && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-400">{l('LIVE REF')}</span>}
                    </div>
                    <p className={`mt-2 min-h-8 text-[10px] ${version.release_note ? (darkMode ? 'text-gray-300' : 'text-gray-700') : 'text-gray-500'}`}>{version.release_note || 'No release note.'}</p>
                    <p className="mt-2 text-[9px] text-indigo-400">Current vs release: {releaseDiffSummary(version)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => void rollbackPublishVersion(version)} disabled={publishBusy} className="font-semibold text-amber-400">{l('Rollback live')}</button>
                      <button onClick={() => restorePublishVersionToEditor(version)} className="font-semibold text-violet-400">{l('Restore editor')}</button>
                      <button onClick={() => void deletePublishVersion(version)} disabled={publishVersionsLoading || version.id === lastPublishedVersionId} className="font-semibold text-rose-400 disabled:opacity-30">{l('Delete archive')}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
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
                    <input type="checkbox" checked={activePage.showInNavigation !== false} onChange={(e) => updateActivePageMeta({ showInNavigation: e.target.checked })} />
                    Show in navigation
                  </label>
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
                      <input type="checkbox" checked={activePage.noIndex === true} onChange={(e) => updateActivePageMeta({ noIndex: e.target.checked })} />
                      Hide from search
                    </label>
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
                {siteEnhancements.popupEnabled && <div className="mt-2 grid gap-2"><input value={siteEnhancements.popupTitle} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupTitle: e.target.value })); setSaved(false); }} placeholder={l('Popup title')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><textarea rows={2} value={siteEnhancements.popupText} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupText: e.target.value })); setSaved(false); }} placeholder={l('Popup message')} className={`resize-none rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><div className="grid grid-cols-3 gap-2"><input value={siteEnhancements.popupButtonLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupButtonLabel: e.target.value })); setSaved(false); }} placeholder={l('Button')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><input value={siteEnhancements.popupButtonHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupButtonHref: e.target.value })); setSaved(false); }} placeholder={l('Button link')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /><input type="number" min="0" max="60" value={siteEnhancements.popupDelaySeconds} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, popupDelaySeconds: Number(e.target.value) })); setSaved(false); }} title="Delay in seconds" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`} /></div></div>}
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
                <input value={productionConfig.metaPixelId} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, metaPixelId: e.target.value })); setSaved(false); }} placeholder="Meta Pixel ID" className={`rounded border px-2 py-1.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} />
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
                  {productionConfig.localBusinessSchema && <><div className="grid grid-cols-2 gap-2"><input value={productionConfig.localBusinessType} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessType: e.target.value })); setSaved(false); }} placeholder="Schema type · LocalBusiness" className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /><input value={productionConfig.localBusinessPhone} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessPhone: e.target.value })); setSaved(false); }} placeholder={l('Phone')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /></div><input value={productionConfig.localBusinessAddress} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessAddress: e.target.value })); setSaved(false); }} placeholder={l('Business address')} className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-blue-200 bg-white'}`} /></>}
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
              <p className="text-[9px] leading-4 text-gray-500">Tracking integrations are generated from validated IDs. Custom CSS is included in Preview, Export and Publish; raw script injection is intentionally not allowed here.</p>
            </div>
          </div>

          <div className={`mb-5 rounded-xl border p-3 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60'}`}>
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">{l('Global Theme')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['Primary', 'primaryColor'],
                ['Secondary', 'secondaryColor'],
                ['Background', 'backgroundColor'],
                ['Text', 'textColor'],
                ['Muted', 'mutedTextColor'],
              ] as const).map(([label, key]) => (
                <label key={key} className="text-[10px] text-gray-500">{label}
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
            <p className="mt-2 text-[9px] leading-4 text-gray-500">Font, width and spacing apply globally. “Apply” also recolors existing sections and buttons.</p>
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
              <p className="text-[9px] leading-4 text-gray-500">Page SEO overrides these defaults. Production export and Publish also include a no-index 404.html page.</p>
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
            <p className="mb-2 text-[9px] leading-4 text-gray-500">Reusable section templates are saved to your account when signed in, or this browser when signed out.</p>
            {reusableError && <p className="mb-2 text-[10px] text-amber-400">{reusableError}</p>}
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
              <span className="mt-0.5 rounded-full border border-violet-500/15 bg-violet-500/[0.06] px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-violet-400">Agent</span>
            </div>

            <div className="space-y-3.5 p-3.5">
              <div className="max-h-36 space-y-2 overflow-auto pr-1">
                {aiMessages.slice(-4).map((message) => (
                  <div key={message.id} className={`rounded-xl border px-3 py-2.5 text-[10px] leading-relaxed ${message.role === 'user' ? (darkMode ? 'ml-7 border-violet-500/10 bg-violet-500/[0.09] text-violet-50' : 'ml-7 border-violet-100 bg-violet-50 text-violet-900') : (darkMode ? 'mr-2 border-white/[0.06] bg-white/[0.025] text-gray-300' : 'mr-2 border-gray-100 bg-gray-50/80 text-gray-700')}`}>
                    <span className={`mb-1.5 block text-[7px] font-black uppercase tracking-[0.14em] ${message.role === 'user' ? 'text-violet-400' : 'text-gray-500'}`}>{message.role === 'user' ? 'You' : 'Tayar AI'}</span>
                    {message.content}
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
                        {complete ? '✓ ' : ''}{stage}
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
                    disabled={!aiPrompt.trim() || aiBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-xs font-black text-white shadow-sm shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {aiBusy ? 'Applying AI change...' : l('Apply AI change')}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void generateWithAI(false)}
                      disabled={!aiPrompt.trim() || aiBusy}
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
                      disabled={aiBusy || !selectedSection}
                      className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold transition ${darkMode ? 'border-cyan-500/15 bg-cyan-500/[0.03] text-cyan-300 hover:bg-cyan-500/[0.07]' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'} disabled:opacity-40`}
                    >
                      {l('Generate selected image')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAIQualityCheck()}
                      disabled={aiQualityBusy || aiBusy}
                      className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold transition ${darkMode ? 'border-emerald-500/15 bg-emerald-500/[0.03] text-emerald-300 hover:bg-emerald-500/[0.07]' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-40`}
                    >
                      {aiQualityBusy ? l('Checking…') : l('Quality check')}
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
                    {aiBusy ? `${aiStage === 'planning' ? 'Planning' : aiStage === 'building' ? 'Building' : 'Finishing'}...` : l('Build with Tayar Agent')}
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

              {aiError && <p className={`rounded-lg border px-2.5 py-2 text-[9px] leading-relaxed ${darkMode ? 'border-red-500/15 bg-red-500/[0.04] text-red-300' : 'border-red-100 bg-red-50 text-red-600'}`}>{aiError}</p>}
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
          <div
            className={`mx-auto overflow-hidden rounded-xl border shadow-xl transition-all duration-200 ${
              device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : 'w-full max-w-6xl'
            } ${darkMode ? 'border-white/10 bg-[#0f172a]' : 'border-gray-200 bg-white'}`}
            style={{ fontFamily: `${theme.fontFamily}, Arial, sans-serif` }}
          >
            {headerConfig.enabled && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ background: headerConfig.backgroundColor, color: headerConfig.textColor, borderColor: headerConfig.borderColor }}>
                <div className="flex min-w-0 items-center gap-2 font-bold" style={{ fontSize: `${headerConfig.brandSize}px` }}>
                  {headerConfig.logoUrl && <img src={headerConfig.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span className="truncate">{headerConfig.brandText.trim() || siteName}</span>
                </div>
                {device === 'mobile' && headerConfig.mobileMenu ? (
                  <div className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold" style={{ color: headerConfig.textColor, borderColor: headerConfig.borderColor }}>☰ Menu</div>
                ) : (
                  <div className="flex flex-wrap items-center justify-end text-[10px]" style={{ color: headerConfig.textColor, gap: `${headerConfig.navGap}px`, fontSize: `${headerConfig.navSize}px` }}>
                    {pages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id} className={page.id === activePageId ? 'font-bold' : ''} style={{ color: page.id === activePageId ? headerConfig.activeColor : headerConfig.textColor }}>{page.name}</span>)}
                    {headerConfig.showCta && <span className="px-2.5 py-1.5 font-bold" style={{ background: headerConfig.ctaBackgroundColor, color: headerConfig.ctaTextColor, borderRadius: `${theme.buttonRadius}px` }}>{headerConfig.ctaLabel}</span>}
                  </div>
                )}
              </div>
            )}
            {sections.map((section, sectionIndex) => (
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
      onSelect={() => { setSelectedId(section.id); setSelectedElementId(null); }}
      onSelectElement={(elementId) => { setSelectedId(section.id); setSelectedElementId(elementId); }}
      draggedElementId={draggedElementId}
      dragOverElementId={dragOverElementId}
      dragOverElementPosition={dragOverElementPosition}
      onElementDragStart={(elementId, e) => handleElementDragStart(section.id, elementId, e)}
      onElementDragMove={(elementId, e) => handleElementDragMove(section.id, elementId, e)}
      onElementDragOver={(elementId, e) => handleElementDragOver(section.id, elementId, e)}
      onElementDrop={(elementId, e) => handleElementDrop(section.id, elementId, e)}
      onElementDragEnd={handleElementDragEnd}
      onResizeElementStart={(elementId) => beginElementResize(section.id, elementId)}
      onResizeElementWidth={(elementId, width) => resizeElementWidth(section.id, elementId, width)}
      onResetElementPosition={(elementId) => resetElementPosition(section.id, elementId)}
      onQuickUpdateElement={(elementId, changes) => quickUpdateElement(section.id, elementId, changes)}
      onOpenMediaLibrary={() => { setSelectedId(section.id); setMediaOpen(true); }}
      onOpenInspector={() => setInspectorOpen(true)}
      onDuplicateSelectedElement={duplicateSelectedElement}
      onDeleteSelectedElement={deleteSelectedElement}
      onInlineContentChange={(elementId, content) => updateInlineElementContent(section.id, elementId, content)}
      onInlineSourceChange={(elementId, src) => updateInlineElementSource(section.id, elementId, src)}
      onAddElement={(type) => addElementToSection(section.id, type)}
      onMoveSection={(direction) => moveSection(section.id, direction)}
      onDeleteSection={() => deleteSection(section.id)}
      canMoveSectionUp={sectionIndex > 0}
      canMoveSectionDown={sectionIndex < sections.length - 1}
      canDeleteSection={sections.length > 1}
      device={device}
      theme={theme}
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
              <div className="border-t border-white/10 px-5 py-5" style={{ background: theme.secondaryColor, color: theme.textColor }}>
                <div className="flex flex-wrap items-start justify-between gap-4 text-[10px]">
                  <div><p className="font-bold">{headerConfig.brandText.trim() || siteName}</p><p className="mt-1" style={{ color: theme.mutedTextColor }}>{footerConfig.text.trim() || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`}</p></div>
                  {footerConfig.showNavigation && <div className="flex flex-wrap gap-3" style={{ color: theme.mutedTextColor }}>{pages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id}>{page.name}</span>)}</div>}
                  <div className="flex flex-wrap gap-3" style={{ color: theme.mutedTextColor }}>{footerConfig.instagramUrl && <span>Instagram</span>}{footerConfig.facebookUrl && <span>Facebook</span>}{footerConfig.linkedinUrl && <span>LinkedIn</span>}{footerConfig.xUrl && <span>X</span>}</div>
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
              <p className="text-[10px] text-gray-500">Drag this element on the canvas to reorder it.</p>
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
                {selectedElement.symbolId && <p className="text-[9px] text-amber-300">Linked symbol — edits sync across all pages automatically.</p>}
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
                  <input value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder="YouTube, Vimeo or direct video URL" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} placeholder="Video title / accessibility label" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              ) : selectedElement.type === 'embed' ? (
                <div className="space-y-2">
                  <input value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder="https://... map or embed URL" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} placeholder="Accessibility title" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              ) : selectedElement.type === 'gallery' ? (
                <textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={7} placeholder="One image URL per line" className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              ) : selectedElement.type === 'accordion' || selectedElement.type === 'tabs' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={8} placeholder="Title | Content — one item per line" className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">Use one line per item: Title | Content</p></div>
              ) : selectedElement.type === 'countdown' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={3} placeholder="2026-12-31T23:59:59 | Launching soon" className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">Format: ISO date/time | label</p></div>
              ) : selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={7} placeholder={selectedElement.type === 'stats' ? '120 | Projects completed\n98 | Satisfaction %' : 'Alex | Amazing experience\nSarah | Great service'} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">One item per line: {selectedElement.type === 'stats' ? 'value | label' : 'name | quote'}</p></div>
              ) : selectedElement.type === 'code' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={10} placeholder="Custom HTML (scripts and inline event handlers are stripped)" className={`w-full resize-none rounded-lg border px-3 py-2 font-mono text-[10px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-emerald-500">Safe HTML mode: script/object/embed tags and on* handlers are removed before preview/publish.</p></div>
              ) : selectedElement.type === 'divider' || selectedElement.type === 'spacer' ? (
                <p className="text-[10px] text-gray-500">Use the styling controls below to adjust {selectedElement.type === 'divider' ? 'width, color and opacity' : 'height (Padding × 2)'}.</p>
              ) : (
                <textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={selectedElement.type === 'text' || selectedElement.type === 'list' ? 4 : 2} placeholder={selectedElement.type === 'list' ? 'One list item per line' : undefined} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
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
                    <option value="">Link to internal page…</option>
                    {pages.map((page) => <option key={page.id} value={`page:${page.slug}`}>{page.name} (/{page.slug})</option>)}
                  </select>
                </div>
              )}
              <div className={`space-y-2 rounded-lg border p-2.5 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">{l('Quick style')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{device}</span>
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
                  <label className="block text-[10px] font-semibold text-indigo-400">Column
                    <select value={Math.min(sectionColumnCount(selectedSection.layout), Math.max(1, Number(selectedElement.layoutColumn) || 1))} onChange={(e) => updateSelectedElement({ layoutColumn: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-indigo-200 bg-white'}`}>
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
                  <button onClick={resetSelectedElementResponsive} className={`w-full rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {l('Reset')} {device} {l('styles')}
                  </button>
<div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">{l('Responsive layout')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{device}</span>
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
                  <span className="text-[9px] uppercase text-gray-500">{device}</span>
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
                    <input type="checkbox" checked={selectedElement.animationOnce !== false} onChange={(e) => updateSelectedElement({ animationOnce: e.target.checked })} />
                    Play once per page view
                  </label>
                  <p className="mt-1 text-[9px] text-gray-500">Turn this off to replay when the element leaves and re-enters the viewport.</p>
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
            <div className="py-10 text-center text-xs text-gray-500">
              Select a section to edit it.
            </div>
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
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Section
                </label>
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
                  <Type className="h-3.5 w-3.5" />
                  Title
                </label>
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
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Description
                </label>
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

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/60'}`}>
                <div>
                  <p className="text-xs font-bold text-indigo-400">{l('Section Layout')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">Choose columns for this section. Mobile automatically collapses to one column.</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['stack', 'Stack'], ['two-column', '2 Columns'], ['three-column', '3 Columns']] as const).map(([layout, label]) => (
                    <button key={layout} type="button" onClick={() => setSelectedSectionLayout(layout)} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${(selectedSection.layout || 'stack') === layout ? 'border-indigo-400 bg-indigo-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100'}`}>{label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Gap')}<input type="number" min="0" max="80" value={sectionLayoutGap(selectedSection)} onChange={(e) => updateSelected({ layoutGap: Math.min(80, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-indigo-200 bg-white'}`} />
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
                  <p className="mt-0.5 text-[10px] text-gray-500">Control background, spacing, height and content width for this section.</p>
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
                      <button type="button" onClick={() => updateSelected({ backgroundImage: selectedElement.src, backgroundMode: 'image' })} className="w-full rounded-lg border border-fuchsia-500/30 px-2 py-1.5 text-[10px] font-semibold text-fuchsia-400">
                        Use selected image as background
                      </button>
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
                  <label className="text-[10px] text-gray-500">{l('Min height')}<input type="number" min="0" max="1200" value={sectionVisualNumber(selectedSection.minHeight, 0, 0, 1200)} onChange={(e) => updateSelected({ minHeight: Math.min(1200, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Corner radius')}<input type="number" min="0" max="80" value={sectionVisualNumber(selectedSection.sectionRadius, 0, 0, 80)} onChange={(e) => updateSelected({ sectionRadius: Math.min(80, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Vertical padding')}<input type="number" min="0" max="240" value={sectionVisualNumber(selectedSection.sectionPaddingY, theme.sectionSpacing, 0, 240)} onChange={(e) => updateSelected({ sectionPaddingY: Math.min(240, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Horizontal padding')}<input type="number" min="0" max="160" value={sectionVisualNumber(selectedSection.sectionPaddingX, 24, 0, 160)} onChange={(e) => updateSelected({ sectionPaddingX: Math.min(160, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
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
                      <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Add, edit and reorder the fields visitors must fill in.</p>
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
                          <input type="checkbox" checked={field.required} onChange={(e) => updateFormField(field.id, { required: e.target.checked })} />
                          Required field
                        </label>
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
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Button Text
                    </label>
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
                      <Link className="h-3.5 w-3.5" />
                      Button Link
                    </label>
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
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Accent
                </label>

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
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-300">
                    AI Image
                  </label>

                  <textarea
                    value={selectedSection.imagePrompt || ''}
                    onChange={(e) =>
                      updateSelected({ imagePrompt: e.target.value })
                    }
                    rows={3}
                    placeholder="Describe the image you want for this section..."
                    className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>

                <button
                  onClick={generateImagePrompt}
                  disabled={aiBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiBusy ? 'Generating...' : '✨ Generate AI Prompt'}
                </button>

                <button
                  onClick={generateRealImage}
                  disabled={aiBusy}
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
                  <ChevronDown className="h-3.5 w-3.5" />
                  Down
                </button>
              </div>

              <button
                onClick={() => deleteSection(selectedSection.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Section
              </button>
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
      aiPanel={v2AiPanel}
      topbarTrailingSlot={
        publishedUrl ? (
          <button
            type="button"
            className="tayar-v2-live-button"
            onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}
            title={publishedUrl}
          >
            {liveVerification === 'healthy' ? 'LIVE ↗' : 'Open ↗'}
          </button>
        ) : null
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
      onSetDevice={(nextDevice) =>
        setDevice(nextDevice as Device)
      }
      onSelect={(selection) => {
        if (
          selection.pageId &&
          selection.pageId !== activePageId
        ) {
          switchPage(selection.pageId);
        }

        if (selection.sectionId) {
          setSelectedId(selection.sectionId);

          setSelectedElementId(
            selection.elementId ?? null
          );

          setSelectedContainerId(
            selection.elementId
              ? null
              : selection.containerId ?? null
          );

          setSelectedFormFieldId(
            selection.elementId ||
            selection.containerId
              ? null
              : selection.formFieldId ?? null
          );

          setInspectorOpen(true);
        }
      }}
    />
  );
}
