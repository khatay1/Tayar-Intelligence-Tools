import type { Language } from '@/context/PreferencesContext';
import type { WebsiteBrand, WebsiteElement, WebsiteSEO, WebsiteSection } from './types';
import type { WebsiteDeliveryConfig } from './delivery-config';
import type { AIWebsitePatchReview } from './editor-ai-patch-review';
import type { AIWebsiteAgentReview } from './editor-ai-scope';

export interface WebsitePage {
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

export interface WebsiteClipboardContext {
  projectId: string | null;
  ownerId: string | null;
  loadSequence: number;
}

export type WebsiteClipboard = WebsiteClipboardContext & (
  | { kind: 'element'; element: WebsiteElement }
  | { kind: 'elements'; elements: WebsiteElement[] }
  | { kind: 'section'; section: WebsiteSection }
);

export interface AIWebsiteUndoSnapshot {
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

export interface CloudWebsiteProject {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  content: Record<string, unknown>;
  status: string;
  updated_at: string;
}

export interface ProjectHistoryEntry {
  id: string;
  savedAt: string;
  label: string;
  snapshot: Record<string, unknown>;
}

export type LeadStage = 'new' | 'qualified' | 'contacted' | 'won' | 'lost';

export interface WebsiteLead {
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

export interface LeadCaptureConfig {
  projectId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface WebsiteAnalyticsEvent {
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

export interface WebsiteMediaAsset {
  name: string;
  path: string;
  url: string;
  createdAt?: string | null;
}

export interface WebsiteTheme {
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

export interface WebsiteHeaderConfig {
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

export interface WebsiteFooterConfig {
  enabled: boolean;
  text: string;
  showNavigation: boolean;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  xUrl: string;
}

export interface WebsiteSiteEnhancements {
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

export interface WebsiteProductionConfig {
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

export interface WebsiteSymbol {
  id: string;
  name: string;
  element: WebsiteElement;
  updatedAt: string;
}

export interface AIWebsiteCandidatePreview {
  review: AIWebsitePatchReview;
  summary: string;
  viewMode: 'before' | 'after';
  pages: WebsitePage[];
  baselinePages: WebsitePage[];
  activePageId: string;
  homePageId: string;
  siteName: string;
  theme: WebsiteTheme;
  seo: WebsiteSEO;
  headerConfig: WebsiteHeaderConfig;
  symbols: WebsiteSymbol[];
  baselineSiteName: string;
  baselineTheme: WebsiteTheme;
  baselineHeaderConfig: WebsiteHeaderConfig;
  changedPageIds: string[];
  addedPageIds: string[];
  removedPageIds: string[];
  reviewedPageIds: string[];
  reviewedOperationIds: string[];
  focusedOperationId: string | null;
  applied: number;
  skipped: number;
  warnings: string[];
  confidence: number | null;
  agentReview: AIWebsiteAgentReview | null;
}

export interface PersistedWebsiteProject {
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

export function isWebsiteSymbol(value: unknown): value is WebsiteSymbol {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WebsiteSymbol>;
  return typeof item.id === 'string' && typeof item.name === 'string' && Boolean(item.element) && typeof item.updatedAt === 'string';
}

export interface WebsitePublishVersion {
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

export type LiveVerification = 'idle' | 'checking' | 'healthy' | 'failed';
export type BillingPlan = 'free' | 'pro' | 'business';
export type BillingFeature = 'publish' | 'exportZip' | 'multilingual' | 'analytics' | 'productionIntegrations' | 'customCss' | 'releaseHistory' | 'clientDelivery' | 'whiteLabel';

export interface BillingEntitlements {
  plan: BillingPlan;
  maxPages: number;
  maxWebsiteProjects: number;
  maxReleaseHistory: number;
  maxLeads: number;
  maxAnalyticsEvents: number;
  features: Record<BillingFeature, boolean>;
}

export interface BillingSubscriptionSnapshot {
  status: string;
  renewalDate?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

export interface BillingUsage {
  websiteProjects: number;
  pages: number;
  releases: number;
  leads: number;
  analyticsEvents: number;
}

export interface BillingState {
  plan: BillingPlan;
  entitlements: BillingEntitlements;
  subscription: BillingSubscriptionSnapshot | null;
  usage: BillingUsage;
}

export interface ReusableSectionTemplate {
  id: string;
  title: string;
  section: WebsiteSection;
  updatedAt?: string | null;
  cloudId?: string;
}
