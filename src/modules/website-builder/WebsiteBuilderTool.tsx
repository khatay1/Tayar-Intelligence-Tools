import { useLocalizer } from '@/lib/ui-localization';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAIService } from '@/lib/ai/service';
import { usePreferences, type Language } from '@/context/PreferencesContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
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
}

import type { Device, ElementAnimation, ElementShadow, SectionBackgroundMode, SectionBackgroundPosition, SectionBackgroundSize, SectionContentWidth, SectionLayout, SectionLayoutAlign, SectionType, WebsiteBrand, WebsiteElement, WebsiteElementContainer, WebsiteElementType, WebsiteFormField, WebsiteFormFieldType, WebsiteSEO, WebsiteSection } from './core/types';
import { ELEMENT_LABELS, SECTION_LABELS, createDefaultContactFormFields, createElement, createSection, defaultBrand, defaultSEO, defaultSections, normalizeSection } from './core/defaults';

const STORAGE_KEY = 'tayar.website-builder.project.v5';
const RECOVERY_STORAGE_KEY = 'tayar.website-builder.recovery.v1';
const LAUNCH_CENTER_SEEN_KEY = 'tayar.website-builder.launch-center-seen.v1';
const LAUNCH_MANUAL_CHECKS_KEY = 'tayar.website-builder.launch-manual-checks.v1';
const PREVIOUS_STORAGE_KEY = 'tayar.website-builder.project.v4';
const V3_STORAGE_KEY = 'tayar.website-builder.project.v3';
const V2_STORAGE_KEY = 'tayar.website-builder.project.v2';
const LEGACY_STORAGE_KEY = 'tayar.website-builder.project';

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
}

interface AIWebsitePatchOperation {
  action: 'update_section' | 'add_section' | 'remove_section' | 'update_page' | 'restyle_site' | 'update_site' | 'generate_image';
  pageId?: string;
  pageSlug?: string;
  sectionId?: string;
  sectionType?: SectionType;
  afterSectionId?: string;
  prompt?: string;
  placement?: 'section_background' | 'section_image' | 'image_element';
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

interface AIWebsitePatch {
  summary?: string;
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
}

interface CloudWebsiteProject {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  content: Record<string, unknown>;
  updated_at: string;
}

interface ProjectTeamAccess {
  ownerId: string | null;
  workspaceId: string | null;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | null;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  canPublish: boolean;
}

const DEFAULT_PROJECT_TEAM_ACCESS: ProjectTeamAccess = {
  ownerId: null,
  workspaceId: null,
  role: 'owner',
  canView: true,
  canEdit: true,
  canManage: true,
  canPublish: true,
};

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
type DeliveryStatus = 'building' | 'review' | 'approved' | 'delivered';

interface WebsiteDeliveryConfig {
  clientName: string;
  clientEmail: string;
  projectCode: string;
  status: DeliveryStatus;
  dueDate: string;
  handoffNotes: string;
  whiteLabel: boolean;
  approvedAt: string | null;
  approvedFingerprint: string;
  deliveredAt: string | null;
}

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

const DEFAULT_DELIVERY_CONFIG: WebsiteDeliveryConfig = {
  clientName: '',
  clientEmail: '',
  projectCode: '',
  status: 'building',
  dueDate: '',
  handoffNotes: '',
  whiteLabel: true,
  approvedAt: null,
  approvedFingerprint: '',
  deliveredAt: null,
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

function normalizeDeliveryConfig(value: Partial<WebsiteDeliveryConfig> | null | undefined): WebsiteDeliveryConfig {
  const status: DeliveryStatus = value?.status === 'review' || value?.status === 'approved' || value?.status === 'delivered'
    ? value.status
    : 'building';
  return {
    clientName: typeof value?.clientName === 'string' ? value.clientName.slice(0, 160) : '',
    clientEmail: typeof value?.clientEmail === 'string' ? value.clientEmail.slice(0, 200) : '',
    projectCode: typeof value?.projectCode === 'string' ? value.projectCode.slice(0, 80) : '',
    status,
    dueDate: typeof value?.dueDate === 'string' ? value.dueDate.slice(0, 20) : '',
    handoffNotes: typeof value?.handoffNotes === 'string' ? value.handoffNotes.slice(0, 4000) : '',
    whiteLabel: value?.whiteLabel !== false,
    approvedAt: typeof value?.approvedAt === 'string' ? value.approvedAt : null,
    approvedFingerprint: typeof value?.approvedFingerprint === 'string' ? value.approvedFingerprint.slice(0, 200000) : '',
    deliveredAt: typeof value?.deliveredAt === 'string' ? value.deliveredAt : null,
  };
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

const PAGE_LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  sv: 'Svenska',
  ar: 'العربية',
};

function normalizePageLanguage(value: unknown, fallback: Language = 'en'): Language {
  return value === 'ar' || value === 'sv' || value === 'en' ? value : fallback;
}

function languageCodeLabel(language: Language): string {
  return language.toUpperCase();
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

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
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
    const setupMessage = enabled ? '' : 'Save this project to Tayar cloud before publishing to activate lead capture.';
    const submitButton = submitElement
      ? (() => {
          const submitStyle = effectiveStyle(submitElement, 'desktop');
          return `<div class="layout-item" data-tayar-element="${escapeHtml(submitElement.id)}" data-tayar-animated data-tayar-animation-once="${submitElement.animationOnce === false ? 'false' : 'true'}" data-column="1" style="${elementSlotCss(submitStyle, 1, 1)}"><button class="btn tayar-element" type="submit" style="${elementVisualCss(submitStyle)}"${enabled ? '' : ' disabled'}>${submitLabel}</button></div>`;
        })()
      : `<button class="btn" type="submit"${enabled ? '' : ' disabled'}>${submitLabel}</button>`;

    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
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
<footer id="${sectionId}" class="section footer" style="${sectionInlineCss(section)}">
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
  const configuredColumns = sectionColumnCount(section.layout);
  const previewColumns = compact ? 1 : device === 'tablet' && configuredColumns === 3 ? 2 : configuredColumns;
  const layoutGap = sectionLayoutGap(section);
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
  const sectionMinHeight = sectionVisualNumber(section.minHeight, 0, 0, 1200);
  const sectionPaddingY = sectionVisualNumber(section.sectionPaddingY, theme.sectionSpacing, 0, 240);
  const sectionPaddingX = sectionVisualNumber(section.sectionPaddingX, compact ? 20 : 40, 0, 160);
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
}: WebsiteBuilderToolProps) {
  const l = useLocalizer();
  const { prefs } = usePreferences();
  const { user } = useAuth();
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
  const [history, setHistory] = useState<WebsiteSection[][]>([]);
  const [future, setFuture] = useState<WebsiteSection[][]>([]);
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
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [projectTeamAccess, setProjectTeamAccess] = useState<ProjectTeamAccess>(DEFAULT_PROJECT_TEAM_ACCESS);
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
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => {
    try { return Boolean(localStorage.getItem(RECOVERY_STORAGE_KEY)); } catch { return false; }
  });
  const lastSavedSnapshotRef = useRef('');
  const autosaveTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const saveProjectRef = useRef<(options?: { automatic?: boolean; createHistory?: boolean }) => Promise<boolean>>(async () => false);

  const getCurrentPages = useCallback(() => {
    return pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
  }, [pages, activePageId, sections]);

  const buildProjectSnapshot = useCallback(() => {
    return {
      version: 5,
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
  }, [siteName, siteUrl, faviconUrl, publishedUrl, publishedAt, previewUrl, previewToken, previewCreatedAt, lastPublishedVersionId, lastPublishedFingerprint, activePageId, homePageId, getCurrentPages, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, deliveryConfig, symbols, seo, prefs.language]);

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
      activePageId,
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
  }, [siteName, siteUrl, faviconUrl, activePageId, homePageId, getCurrentPages, brand, theme, headerConfig, footerConfig, siteEnhancements, productionConfig, symbols, seo, prefs.language]);

  function buildDeliveryFingerprint() {
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
  }

  const buildProjectData = useCallback((historyEntries: ProjectHistoryEntry[] = projectHistory) => {
    return {
      ...buildProjectSnapshot(),
      history: historyEntries,
    };
  }, [buildProjectSnapshot, projectHistory]);

  function saveRecoverySnapshot(reason: string) {
    try {
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        reason: reason.slice(0, 120),
        project: buildProjectData(),
      }));
      setRecoveryAvailable(true);
    } catch {
      // Recovery is best-effort; cloud save remains the primary durable copy.
    }
  }

  function restoreRecoverySnapshot() {
    try {
      const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!raw) { setRecoveryAvailable(false); return; }
      const parsed = JSON.parse(raw);
      if (!parsed?.project || (!Array.isArray(parsed.project.pages) && !Array.isArray(parsed.project.sections))) throw new Error('Invalid recovery snapshot');
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

  function applyProjectData(input: unknown, loadHistory = true) {
    if (Array.isArray(input) && input.length) {
      const normalized = input.map(normalizeSection);
      setSections(normalized);
      setPages([{ id: 'page-home', name: 'Home', slug: 'home', sections: normalized, showInNavigation: true, language: 'en', translationKey: 'home' }]);
      setActivePageId('page-home');
      setHomePageId('page-home');
      setSelectedId(normalized[0].id);
      setSelectedElementId(normalized[0].elements[0]?.id ?? null);
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
      setHistory([]);
      setFuture([]);
      if (loadHistory) setProjectHistory([]);
      setSaved(false);
      return;
    }

    if (!input || typeof input !== 'object') return;
    const parsed = input as PersistedWebsiteProject;

    if (Array.isArray(parsed.pages) && parsed.pages.length) {
      const normalizedPages: WebsitePage[] = parsed.pages.map((page: Partial<WebsitePage>, index: number) => ({
        id: page.id || `page-${index}-${Date.now()}`,
        name: page.name || `Page ${index + 1}`,
        slug: normalizeSlug(page.slug || page.name || `page-${index + 1}`),
        sections: Array.isArray(page.sections) && page.sections.length
          ? page.sections.map(normalizeSection)
          : [createSection('hero')],
        showInNavigation: page.showInNavigation !== false,
        seoTitle: typeof page.seoTitle === 'string' ? page.seoTitle : '',
        seoDescription: typeof page.seoDescription === 'string' ? page.seoDescription : '',
        socialImage: typeof page.socialImage === 'string' ? page.socialImage : '',
        canonicalUrl: typeof page.canonicalUrl === 'string' ? page.canonicalUrl : '',
        language: normalizePageLanguage(page.language, normalizePageLanguage(parsed.language, 'en')),
        translationKey: typeof page.translationKey === 'string' ? page.translationKey.slice(0, 120) : '',
        noIndex: page.noIndex === true,
      }));
      const requestedPage = normalizedPages.find((page) => page.id === parsed.activePageId) || normalizedPages[0];
      setPages(normalizedPages);
      setActivePageId(requestedPage.id);
      setHomePageId(parsed.homePageId && normalizedPages.some((page) => page.id === parsed.homePageId) ? parsed.homePageId : normalizedPages[0].id);
      setSections(requestedPage.sections);
      setSelectedId(requestedPage.sections[0]?.id ?? null);
      setSelectedElementId(requestedPage.sections[0]?.elements[0]?.id ?? null);
      setSiteName(parsed.siteName || 'My Website');
      setSiteUrl(parsed.siteUrl || '');
      setFaviconUrl(typeof parsed.faviconUrl === 'string' ? parsed.faviconUrl : '');
      setPublishedUrl(typeof parsed.publishedUrl === 'string' ? parsed.publishedUrl : '');
      setPublishedAt(typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null);
      setPreviewUrl(typeof parsed.previewUrl === 'string' ? parsed.previewUrl : '');
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
      setHistory([]);
      setFuture([]);
      if (loadHistory) setProjectHistory(Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : []);
      setSaved(false);
      return;
    }

    if (Array.isArray(parsed.sections) && parsed.sections.length) {
      const normalized = parsed.sections.map(normalizeSection);
      setSections(normalized);
      setPages([{ id: 'page-home', name: 'Home', slug: 'home', sections: normalized, showInNavigation: true, language: 'en', translationKey: 'home' }]);
      setActivePageId('page-home');
      setHomePageId('page-home');
      setSelectedId(normalized[0].id);
      setSelectedElementId(normalized[0].elements[0]?.id ?? null);
      setSiteName(parsed.siteName || 'My Website');
      setSiteUrl(parsed.siteUrl || '');
      setFaviconUrl(typeof parsed.faviconUrl === 'string' ? parsed.faviconUrl : '');
      setPublishedUrl(typeof parsed.publishedUrl === 'string' ? parsed.publishedUrl : '');
      setPublishedAt(typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null);
      setPreviewUrl(typeof parsed.previewUrl === 'string' ? parsed.previewUrl : '');
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
      setHistory([]);
      setFuture([]);
      if (loadHistory) setProjectHistory(Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : []);
      setSaved(false);
    }
  }

  async function refreshProjectTeamAccess(projectId: string | null) {
    if (!user || !projectId) {
      setProjectTeamAccess(DEFAULT_PROJECT_TEAM_ACCESS);
      return DEFAULT_PROJECT_TEAM_ACCESS;
    }

    const project = cloudProjects.find((item) => item.id === projectId);
    const fallback: ProjectTeamAccess = project
      ? {
          ownerId: project.user_id,
          workspaceId: project.workspace_id,
          role: project.user_id === user.id ? 'owner' : null,
          canView: project.user_id === user.id,
          canEdit: project.user_id === user.id,
          canManage: project.user_id === user.id,
          canPublish: project.user_id === user.id,
        }
      : DEFAULT_PROJECT_TEAM_ACCESS;

    const { data, error } = await supabase.rpc('get_project_team_access', { p_project_id: projectId });
    if (error || !data) {
      setProjectTeamAccess(fallback);
      return fallback;
    }

    const raw = data as Record<string, unknown>;
    const next: ProjectTeamAccess = {
      ownerId: typeof raw.ownerId === 'string' ? raw.ownerId : fallback.ownerId,
      workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : null,
      role: raw.role === 'owner' || raw.role === 'admin' || raw.role === 'editor' || raw.role === 'viewer' ? raw.role : fallback.role,
      canView: raw.canView !== false,
      canEdit: raw.canEdit === true,
      canManage: raw.canManage === true,
      canPublish: raw.canPublish === true,
    };
    setProjectTeamAccess(next);
    return next;
  }

  const refreshCloudProjects = useCallback(async () => {
    if (!user) {
      setCloudProjects([]);
      setCloudProjectId(null);
      return;
    }

    setCloudBusy(true);
    setCloudError('');
    const { data, error } = await supabase
      .from('projects')
      .select('id, user_id, workspace_id, title, content, updated_at')
      .eq('type', 'website-builder')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      setCloudError('Could not load cloud projects.');
      setCloudBusy(false);
      return;
    }

    setCloudProjects((data || []) as CloudWebsiteProject[]);
    setCloudBusy(false);
  }, [user]);

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
    setReusableError('');
    if (!user) {
      setReusableSections(loadLocalReusableSections());
      setReusableBusy(false);
      return;
    }

    setReusableBusy(true);
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, content, updated_at')
      .eq('user_id', user.id)
      .eq('type', 'website-section-template')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(30);

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
  }, [user, loadLocalReusableSections]);

  async function saveSelectedSectionAsReusable() {
    if (!selectedSection) return;
    const title = window.prompt('Template name', selectedSection.title || SECTION_LABELS[selectedSection.type])?.trim();
    if (!title) return;

    setReusableBusy(true);
    setReusableError('');
    const savedSection = JSON.parse(JSON.stringify(selectedSection)) as WebsiteSection;

    if (!user) {
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

    const { error } = await supabase.from('projects').insert({
      user_id: user.id,
      title,
      type: 'website-section-template',
      content: { version: 1, section: savedSection },
      status: 'completed',
    });

    if (error) {
      setReusableError('Could not save this reusable section.');
      setReusableBusy(false);
      return;
    }

    await refreshReusableSections();
    setReusableBusy(false);
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

    if (!user || !template.cloudId) {
      const next = reusableSections.filter((item) => item.id !== template.id);
      setReusableSections(next);
      localStorage.setItem(REUSABLE_SECTIONS_KEY, JSON.stringify(next));
      return;
    }

    setReusableBusy(true);
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', template.cloudId)
      .eq('user_id', user.id)
      .eq('type', 'website-section-template');

    if (error) {
      setReusableError('Could not delete this reusable section.');
      setReusableBusy(false);
      return;
    }

    await refreshReusableSections();
    setReusableBusy(false);
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
    setHistory([]);
    setFuture([]);
    setSaved(false);
  }

  async function loadCloudProject(projectId: string) {
    const project = cloudProjects.find((item) => item.id === projectId);
    if (!project) return;
    setCloudProjectId(project.id);
    await refreshProjectTeamAccess(project.id);
    setLeads([]);
    setLeadsOpen(false);
    setAnalyticsEvents([]);
    setAnalyticsOpen(false);
    setPublishVersions([]);
    setReleaseHistoryOpen(false);
    setLiveVerification('idle');
    skipNextAutosaveRef.current = true;
    applyProjectData(project.content);
    setSiteName(project.title || 'My Website');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project.content));
  }

  const refreshLeads = useCallback(async () => {
    if (!user || !cloudProjectId) {
      setLeads([]);
      setLeadsError('');
      return;
    }

    setLeadsLoading(true);
    setLeadsError('');
    const { data, error } = await supabase
      .from('website_leads')
      .select('id, project_id, user_id, name, email, message, form_data, page_path, status, stage, priority, tags, notes, updated_at, created_at')
      .eq('project_id', cloudProjectId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setLeadsError('Lead inbox is unavailable. Make sure the Sprint 11 database migration is applied.');
      setLeadsLoading(false);
      return;
    }

    const nextLeads = (data || []) as WebsiteLead[];
    setLeads(nextLeads);
    setSelectedLeadIds((current) => current.filter((id) => nextLeads.some((lead) => lead.id === id)));
    setLeadsLoading(false);
  }, [user, cloudProjectId]);

  async function updateLeadStatus(leadId: string, status: WebsiteLead['status']) {
    if (!user || !cloudProjectId) return;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('website_leads')
      .update({ status, updated_at: updatedAt })
      .eq('id', leadId)
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id);

    if (error) {
      setLeadsError('Could not update this lead.');
      return;
    }

    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, status, updated_at: updatedAt } : lead));
  }

  async function updateLeadCrm(leadId: string, updates: Partial<Pick<WebsiteLead, 'stage' | 'priority' | 'tags' | 'notes'>>) {
    if (!user || !cloudProjectId) return;
    const sanitized = {
      ...updates,
      ...(updates.tags ? { tags: updates.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12) } : {}),
      ...(typeof updates.notes === 'string' ? { notes: updates.notes.slice(0, 4000) } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('website_leads')
      .update(sanitized)
      .eq('id', leadId)
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id);

    if (error) {
      setLeadsError('Could not update CRM details for this lead.');
      return;
    }

    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, ...sanitized } : lead));
  }

  async function bulkUpdateLeadStage(stage: LeadStage) {
    if (!user || !cloudProjectId || !selectedLeadIds.length) return;
    const ids = [...selectedLeadIds];
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('website_leads')
      .update({ stage, updated_at: updatedAt })
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id)
      .in('id', ids);

    if (error) {
      setLeadsError('Could not update the selected leads.');
      return;
    }

    setLeads((current) => current.map((lead) => ids.includes(lead.id) ? { ...lead, stage, updated_at: updatedAt } : lead));
  }

  function leadPhone(lead: WebsiteLead) {
    const entry = Object.entries(lead.form_data || {}).find(([key, value]) =>
      (key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel')) && String(value || '').trim()
    );
    return entry ? String(entry[1] || '').trim() : '';
  }

  function leadSource(lead: WebsiteLead) {
    const data = lead.form_data || {};
    const source = String(data._utm_source || '').trim();
    const medium = String(data._utm_medium || '').trim();
    const campaign = String(data._utm_campaign || '').trim();
    const referrer = String(data._referrer || '').trim();
    return { source, medium, campaign, referrer };
  }

  async function copyLeadSummary(lead: WebsiteLead) {
    const meta = leadSource(lead);
    const phone = leadPhone(lead);
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
    if (!user || !cloudProjectId) return;
    const confirmed = window.confirm('Delete this lead permanently?');
    if (!confirmed) return;

    const { error } = await supabase
      .from('website_leads')
      .delete()
      .eq('id', leadId)
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id);

    if (error) {
      setLeadsError('Could not delete this lead.');
      return;
    }

    setLeads((current) => current.filter((lead) => lead.id !== leadId));
    setSelectedLeadIds((current) => current.filter((id) => id !== leadId));
  }

  const refreshAnalytics = useCallback(async () => {
    if (!user || !cloudProjectId) {
      setAnalyticsEvents([]);
      setAnalyticsError('');
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError('');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('website_analytics_events')
      .select('id, project_id, user_id, page_path, referrer, session_id, event_type, event_data, created_at')
      .eq('project_id', cloudProjectId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      setAnalyticsError('Analytics is unavailable. Make sure the Sprint 15 database migration is applied.');
      setAnalyticsLoading(false);
      return;
    }

    setAnalyticsEvents((data || []) as WebsiteAnalyticsEvent[]);
    setAnalyticsLoading(false);
  }, [user, cloudProjectId]);

  const refreshMedia = useCallback(async () => {
    if (!user) {
      setMediaAssets([]);
      setMediaError('');
      return;
    }

    setMediaLoading(true);
    setMediaError('');
    const { data, error } = await supabase.storage
      .from('website-media')
      .list(user.id, { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) {
      setMediaError('Media library is unavailable. Make sure the Sprint 12 storage migration is applied.');
      setMediaLoading(false);
      return;
    }

    const assets: WebsiteMediaAsset[] = (data || [])
      .filter((item) => Boolean(item.name) && item.name !== '.emptyFolderPlaceholder')
      .map((item) => {
        const path = `${user.id}/${item.name}`;
        const { data: publicData } = supabase.storage.from('website-media').getPublicUrl(path);
        return {
          name: item.name,
          path,
          url: publicData.publicUrl,
          createdAt: item.created_at,
        };
      });

    setMediaAssets(assets);
    setMediaLoading(false);
  }, [user]);

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
    if (!user) {
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

    setMediaUploading(true);
    setMediaError('');
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    const path = `${user.id}/${Date.now()}-${base}.${extension}`;
    const { error } = await supabase.storage
      .from('website-media')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (error) {
      setMediaError('Could not upload this image.');
      setMediaUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from('website-media').getPublicUrl(path);
    await refreshMedia();
    setMediaUploading(false);

    if (selectedElement?.type === 'image') {
      updateSelectedElement({ src: publicData.publicUrl, content: file.name });
    }
  }

  async function deleteMediaAsset(asset: WebsiteMediaAsset) {
    if (!user) return;
    if (!window.confirm(`Delete ${asset.name} from your media library?`)) return;

    setMediaError('');
    const { error } = await supabase.storage.from('website-media').remove([asset.path]);
    if (error) {
      setMediaError('Could not delete this image.');
      return;
    }

    setMediaAssets((current) => current.filter((item) => item.path !== asset.path));
    if (selectedElement?.type === 'image' && selectedElement.src === asset.url) {
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

  useEffect(() => {
    if (!selectedSection || !selectedElement) return;

    const handleCanvasKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return;

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelectedElement();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        deleteSelectedElement();
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
      if (event.key === 'ArrowLeft') nudgeSelectedElement(-step, 0);
      if (event.key === 'ArrowRight') nudgeSelectedElement(step, 0);
      if (event.key === 'ArrowUp') nudgeSelectedElement(0, -step);
      if (event.key === 'ArrowDown') nudgeSelectedElement(0, step);
    };

    window.addEventListener('keydown', handleCanvasKeyDown);
    return () => window.removeEventListener('keydown', handleCanvasKeyDown);
  }, [selectedSection, selectedElement, device, sections, deleteSelectedElement, duplicateSelectedElement, nudgeSelectedElement]);

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

  const refreshBilling = useCallback(async (projectId: string | null = cloudProjectId) => {
    if (!user) {
      setBillingState({
        plan: 'free',
        entitlements: FREE_BILLING_ENTITLEMENTS,
        subscription: null,
        usage: { websiteProjects: 0, pages: pages.length, releases: 0, leads: 0, analyticsEvents: 0 },
      });
      return;
    }

    setBillingLoading(true);
    setBillingError('');
    const { data, error } = await supabase.rpc('get_website_builder_billing_state', {
      p_project_id: projectId,
    });

    if (error || !data || typeof data !== 'object') {
      // Fail closed: never grant paid features from browser-editable profile data when billing cannot be verified.
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
  }, [user, pages.length, cloudProjectId]);

  async function startBillingCheckout(plan: 'pro' | 'business') {
    if (!user) {
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
    setBillingBusy(true);
    setBillingError('');
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { plan } });
      if (error) throw error;
      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error(data?.error || 'Stripe Checkout is not configured yet.');
      window.location.assign(url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Could not open Stripe Checkout.');
      setBillingBusy(false);
    }
  }

  async function openBillingPortal() {
    if (!user) return;
    setBillingBusy(true);
    setBillingError('');
    try {
      const { data, error } = await supabase.functions.invoke('billing-portal', { body: {} });
      if (error) throw error;
      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error(data?.error || 'Billing portal is not available yet.');
      window.location.assign(url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Could not open the billing portal.');
      setBillingBusy(false);
    }
  }

  useEffect(() => {
    try {
      const savedProject = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || localStorage.getItem(V3_STORAGE_KEY) || localStorage.getItem(V2_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (savedProject) {
        skipNextAutosaveRef.current = true;
        applyProjectData(JSON.parse(savedProject));
      }
    } catch {
      // Ignore invalid project data.
    }
  }, []);

  useEffect(() => {
    void refreshCloudProjects();
    void refreshReusableSections();
  }, [refreshCloudProjects, refreshReusableSections]);

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

    if (!lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = fingerprint;
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      lastSavedSnapshotRef.current = fingerprint;
      setAutoSaveStatus('saved');
      return;
    }

    if (fingerprint === lastSavedSnapshotRef.current) return;

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    setAutoSaveStatus('saving');
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveProjectRef.current({ automatic: true, createHistory: false });
    }, 1800);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [buildProjectFingerprint]);

  const analyticsSummary = useMemo(() => {
    const pageViews = analyticsEvents.filter((event) => !event.event_type || event.event_type === 'page_view');
    const conversions = analyticsEvents.filter((event) => event.event_type === 'cta_click' || event.event_type === 'form_submit');
    const formSubmits = analyticsEvents.filter((event) => event.event_type === 'form_submit').length;
    const ctaClicks = analyticsEvents.filter((event) => event.event_type === 'cta_click').length;
    const sessions = new Set(pageViews.map((event) => event.session_id)).size;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const last7Days = pageViews.filter((event) => new Date(event.created_at).getTime() >= sevenDaysAgo).length;
    const todayViews = pageViews.filter((event) => {
      const date = new Date(event.created_at);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === todayKey;
    }).length;

    const pageCounts = new Map<string, number>();
    const referrerCounts = new Map<string, number>();
    pageViews.forEach((event) => {
      const page = event.page_path || '/';
      pageCounts.set(page, (pageCounts.get(page) || 0) + 1);

      let source = 'Direct';
      if (event.referrer) {
        try {
          source = new URL(event.referrer).hostname.replace(/^www\./, '') || 'Direct';
        } catch {
          source = event.referrer.slice(0, 80);
        }
      }
      referrerCounts.set(source, (referrerCounts.get(source) || 0) + 1);
    });

    const topPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topReferrers = [...referrerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      views: pageViews.length,
      sessions,
      last7Days,
      todayViews,
      conversions: conversions.length,
      ctaClicks,
      formSubmits,
      conversionRate: sessions ? Math.round((formSubmits / sessions) * 1000) / 10 : 0,
      topPages,
      topReferrers,
    };
  }, [analyticsEvents]);

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
    setHistory([]);
    setFuture([]);
    setSaved(false);
  }

  function addPage() {
    if (!requirePageCapacity(1)) return;
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
    setHistory([]);
    setFuture([]);
    setSaved(false);
  }

  function duplicateActivePage() {
    if (!activePage) return;
    if (!requirePageCapacity(1)) return;
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
    setHistory([]);
    setFuture([]);
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
    setHistory([]);
    setFuture([]);
    setSaved(false);
  }

  function updateActivePageMeta(changes: Partial<Pick<WebsitePage, 'name' | 'slug' | 'showInNavigation' | 'seoTitle' | 'seoDescription' | 'socialImage' | 'canonicalUrl' | 'language' | 'translationKey' | 'noIndex'>>) {
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
    setHomePageId(activePage.id);
    setSaved(false);
  }

  function deleteActivePage() {
    if (pages.length <= 1) return;
    const remaining = pages.filter((page) => page.id !== activePageId);
    const next = remaining[0];
    setPages(remaining);
    if (activePageId === homePageId) setHomePageId(next.id);
    setActivePageId(next.id);
    setSections(next.sections);
    setSelectedId(next.sections[0]?.id ?? null);
    setSelectedElementId(next.sections[0]?.elements[0]?.id ?? null);
    setHistory([]);
    setFuture([]);
    setSaved(false);
  }

  function remember(current: WebsiteSection[]) {
    setHistory((h) => [...h.slice(-19), current]);
    setFuture([]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((f) => [sections, ...f].slice(0, 20));
    setSections(previous);
    setHistory((h) => h.slice(0, -1));
    setSelectedId(previous[0]?.id ?? null);
    setSelectedElementId(previous[0]?.elements[0]?.id ?? null);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, sections].slice(-20));
    setSections(next);
    setFuture((f) => f.slice(1));
    setSelectedId(next[0]?.id ?? null);
    setSelectedElementId(next[0]?.elements[0]?.id ?? null);
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
    if (!selectedElement || !selectedSection) return;
    remember(sections);
    if (selectedElement.symbolId) return;
    const name = window.prompt('Symbol name', selectedElement.content?.slice(0, 40) || ELEMENT_LABELS[selectedElement.type])?.trim();
    if (!name) return;
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
    remember(sections);
    const columnCount = sectionColumnCount(selectedSection.layout);
    const instance: WebsiteElement = {
      ...JSON.parse(JSON.stringify(symbol.element)) as WebsiteElement,
      id: `${symbol.element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbolId: symbol.id,
      layoutColumn: columnCount > 1 ? 1 : undefined,
      containerId: undefined,
    };
    setSections((current) => current.map((section) => section.id === selectedSection.id ? { ...section, elements: [...section.elements, instance] } : section));
    setSelectedElementId(instance.id);
    setSaved(false);
  }

  function detachSelectedSymbol() {
    if (!selectedSection || !selectedElement?.symbolId) return;
    remember(sections);
    setSections((current) => current.map((section) => section.id === selectedSection.id ? {
      ...section,
      elements: section.elements.map((element) => element.id === selectedElement.id ? { ...element, symbolId: undefined } : element),
    } : section));
    setSaved(false);
  }

  function deleteSymbol(symbolId: string) {
    if (!window.confirm('Delete this symbol? Existing instances will become normal elements.')) return;
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
    const response = await ai.completeJSON<{ url: string; assetPath?: string; persisted?: boolean }>(
      { action: 'generate-image', prompt: cleanPrompt },
      [],
      { temperature: 0.8, maxTokens: 1000 },
    );
    if (!response.json?.url) throw new Error('Image generation did not return an image.');
    if (user) void refreshMedia();
    return response.json;
  }

  async function generateWithAI(agentMode = false) {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;

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
            // Agent image generation is best-effort; the site remains fully editable if the image provider is unavailable.
          }
        }
      }

      const firstPage = nextPages[0];
      const totalSections = nextPages.reduce((sum, page) => sum + page.sections.length, 0);
      const summary = generated.summary?.trim() || `${nextPages.length} page website with ${totalSections} structured sections.`;

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
      const message = error instanceof Error ? error.message : 'AI generation failed.';
      setAiError(message);
      setAiStage('error');
      setAiMessages((current) => [
        ...current,
        { id: `ai-error-${Date.now()}`, role: 'assistant' as const, content: message },
      ].slice(-12));
    } finally {
      setAiBusy(false);
    }
  }

  function buildAIEditableSnapshot() {
    return {
      siteName,
      activePageId,
      theme: {
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
      },
      pages: getCurrentPages().map((page) => ({
        id: page.id,
        name: page.name,
        slug: page.slug,
        showInNavigation: page.showInNavigation,
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
    setAiUndoSnapshot(null);
    setAiStage('ready');
    setSaved(false);
    setAiMessages((current) => [
      ...current,
      { id: `ai-undo-${Date.now()}`, role: 'assistant' as const, content: 'Reverted the last AI change.' },
    ].slice(-12));
  }

  async function applyAIChange() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;

    const requestId = `ai-edit-${Date.now()}`;
    const currentPages = getCurrentPages();
    const snapshot: AIWebsiteUndoSnapshot = {
      pages: JSON.parse(JSON.stringify(currentPages)) as WebsitePage[],
      activePageId,
      homePageId,
      siteName,
      brand: JSON.parse(JSON.stringify(brand)) as WebsiteBrand,
      seo: JSON.parse(JSON.stringify(seo)) as WebsiteSEO,
      theme: JSON.parse(JSON.stringify(theme)) as WebsiteTheme,
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
      const response = await ai.completeJSON<AIWebsitePatch>(
        {
          action: 'edit',
          prompt,
          currentSite: buildAIEditableSnapshot(),
        },
        aiMessages.slice(-6).map((message) => ({ role: message.role, content: message.content })),
        { temperature: 0.35, maxTokens: 9000 },
      );

      let patch = response.json;
      if (!patch && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        patch = JSON.parse(cleaned) as AIWebsitePatch;
      }

      const operations = Array.isArray(patch?.operations) ? patch.operations.slice(0, 40) : [];
      if (!patch || operations.length === 0) {
        throw new Error('AI did not return any safe website changes. Try a more specific request.');
      }

      setAiStage('building');

      const allowedTypes = new Set<SectionType>([
        'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
      ]);
      const validHex = (value?: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');
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

      let nextPages = JSON.parse(JSON.stringify(currentPages)) as WebsitePage[];
      let nextSiteName = siteName;
      let nextTheme = { ...theme };
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

      for (const operation of operations) {
        if (!operation || typeof operation.action !== 'string') continue;

        if (operation.action === 'update_site') {
          const changes = operation.changes || {};
          if (typeof changes.name === 'string' && changes.name.trim()) {
            nextSiteName = changes.name.trim().slice(0, 100);
            applied += 1;
          }
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
          };
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
          sectionList[sectionIndex] = updateSectionContent(sectionList[sectionIndex], changes);
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

      const finalActive = nextPages.find((page) => page.id === activeAfterPatch?.id) || nextPages[0];
      setAiUndoSnapshot(snapshot);
      setPages(nextPages);
      setSections(finalActive?.sections || []);
      setActivePageId(finalActive?.id || activePageId);
      setSiteName(nextSiteName);
      setTheme(nextTheme);
      setSelectedId(finalActive?.sections[0]?.id ?? null);
      setSelectedElementId(finalActive?.sections[0]?.elements[0]?.id ?? null);
      setHistory([]);
      setFuture([]);
      setSaved(false);
      setAiPrompt('');
      setAiStage('ready');

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
          content: `${summary} Applied ${applied} safe operation${applied === 1 ? '' : 's'} without rebuilding unrelated content.`,
        },
      ].slice(-12));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI edit failed.';
      setAiError(message);
      setAiStage('error');
      setAiMessages((current) => [
        ...current,
        { id: `ai-patch-error-${Date.now()}`, role: 'assistant' as const, content: message },
      ].slice(-12));
    } finally {
      setAiBusy(false);
    }
  }

  async function generateRealImage() {
    if (!selectedSection || aiBusy) return;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');

      const response = await ai.completeJSON<{
        url: string;
      }>(
        {
          action: 'generate-image',
          prompt: selectedSection.imagePrompt || selectedSection.image || selectedSection.title,
          section: selectedSection,
          brand,
        },
        [],
        { temperature: 0.8, maxTokens: 1000 },
      );

      if (!response.json?.url) {
        throw new Error('Image generation did not return an image.');
      }

      remember(sections);

      updateSelected({
        image: response.json.url,
      });

    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : 'Image generation failed.'
      );
    } finally {
      setAiBusy(false);
    }
  }
  async function generateImagePrompt() {
    if (!selectedSection || aiBusy) return;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');

      const response = await ai.completeJSON<{
        prompt: string;
      }>(
        {
          action: 'image-prompt',
          section: selectedSection,
          brand,
        },
        [],
        { temperature: 0.8, maxTokens: 800 },
      );

      if (!response.json?.prompt) {
        throw new Error('AI could not create image prompt.');
      }

      updateSelected({
        imagePrompt: response.json.prompt,
      });

    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : 'Image prompt generation failed.'
      );
    } finally {
      setAiBusy(false);
    }
  }
  const refreshPublishVersions = useCallback(async () => {
    if (!user || !cloudProjectId) {
      setPublishVersions([]);
      setPublishVersionsError('');
      return;
    }
    setPublishVersionsLoading(true);
    setPublishVersionsError('');
    const { data, error } = await supabase
      .from('website_publish_versions')
      .select('id, project_id, user_id, release_note, published_url, storage_prefix, editor_fingerprint, snapshot, file_manifest, created_at')
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      setPublishVersionsError('Release history is unavailable. Apply the Sprint 97-108 database migration.');
      setPublishVersionsLoading(false);
      return;
    }
    setPublishVersions((data || []) as WebsitePublishVersion[]);
    setPublishVersionsLoading(false);
  }, [user, cloudProjectId]);

  useEffect(() => {
    if (releaseHistoryOpen) void refreshPublishVersions();
  }, [releaseHistoryOpen, refreshPublishVersions]);

  function projectSnapshotCounts(snapshot: Record<string, unknown>) {
    const snapshotPages = Array.isArray(snapshot.pages) ? snapshot.pages : [];
    const pageCount = snapshotPages.length;
    const sectionCount = snapshotPages.reduce((sum: number, page: unknown) => {
      if (!page || typeof page !== 'object') return sum;
      const pageSections = (page as { sections?: unknown }).sections;
      return sum + (Array.isArray(pageSections) ? pageSections.length : 0);
    }, 0);
    const elementCount = snapshotPages.reduce((sum: number, page: unknown) => {
      if (!page || typeof page !== 'object') return sum;
      const pageSections = (page as { sections?: unknown }).sections;
      if (!Array.isArray(pageSections)) return sum;
      return sum + pageSections.reduce((sectionSum: number, section: unknown) => {
        if (!section || typeof section !== 'object') return sectionSum;
        const elements = (section as { elements?: unknown }).elements;
        return sectionSum + (Array.isArray(elements) ? elements.length : 0);
      }, 0);
    }, 0);
    return { pageCount, sectionCount, elementCount };
  }

  function releaseDiffSummary(version: WebsitePublishVersion) {
    const currentSnapshot = buildProjectSnapshot();
    const current = projectSnapshotCounts(currentSnapshot as unknown as Record<string, unknown>);
    const previous = projectSnapshotCounts(version.snapshot || {});
    const delta = (value: number) => value === 0 ? '0' : value > 0 ? `+${value}` : String(value);
    return `${delta(current.pageCount - previous.pageCount)} pages · ${delta(current.sectionCount - previous.sectionCount)} sections · ${delta(current.elementCount - previous.elementCount)} elements`;
  }

  async function verifyLiveDeployment() {
    if (!user || !cloudProjectId) {
      setLiveVerification('idle');
      return;
    }
    setLiveVerification('checking');
    const path = `${user.id}/${cloudProjectId}/index.html`;
    const { data, error } = await supabase.storage.from('published-sites').download(path);
    setLiveVerification(!error && data && data.size > 0 ? 'healthy' : 'failed');
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
    const latestSaved = await saveProject({ automatic: true, createHistory: false });
    if (!latestSaved) {
      setPublishError('Publish preflight blocked: the latest changes could not be synchronized to cloud.');
      return;
    }

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    if (!supabaseUrl) {
      setPreviewError('Supabase URL is not configured.');
      return;
    }
    setPreviewBusy(true);
    setPreviewError('');
    try {
      if (previewToken) await revokeSharePreview(false);
      const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const folder = `${user.id}/${cloudProjectId}/previews/${token}`;
      const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/published-sites/${folder}`;
      const currentPages = getCurrentPages();
      const files: Array<{ name: string; content: string; contentType: string }> = currentPages.map((page) => ({
        name: page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`,
        content: getHtml(page.sections, page.id, publicBaseUrl, true, false),
        contentType: 'text/html; charset=utf-8',
      }));
      files.push({ name: '404.html', content: get404Html(publicBaseUrl, true, false), contentType: 'text/html; charset=utf-8' });
      for (const file of files) {
        const { error } = await supabase.storage.from('published-sites').upload(
          `${folder}/${file.name}`,
          new Blob([file.content], { type: file.contentType }),
          { upsert: true, contentType: file.contentType, cacheControl: '60' },
        );
        if (error) throw error;
      }
      const nextUrl = `${publicBaseUrl}/index.html`;
      const createdAt = new Date().toISOString();
      setPreviewToken(token);
      setPreviewUrl(nextUrl);
      setPreviewCreatedAt(createdAt);
      setSaved(false);
      try { await navigator.clipboard.writeText(nextUrl); } catch { /* Clipboard access is optional. */ }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not create share preview.');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function revokeSharePreview(updateBusy = true) {
    if (!user || !cloudProjectId || !previewToken) return;
    if (updateBusy) setPreviewBusy(true);
    setPreviewError('');
    try {
      const folder = `${user.id}/${cloudProjectId}/previews/${previewToken}`;
      const { data, error } = await supabase.storage.from('published-sites').list(folder, { limit: 100 });
      if (error) throw error;
      const paths = (data || []).filter((item) => item.name && item.id).map((item) => `${folder}/${item.name}`);
      if (paths.length) {
        const { error: removeError } = await supabase.storage.from('published-sites').remove(paths);
        if (removeError) throw removeError;
      }
      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setSaved(false);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not revoke share preview.');
    } finally {
      if (updateBusy) setPreviewBusy(false);
    }
  }

  async function rollbackPublishVersion(version: WebsitePublishVersion) {
    if (!user || !cloudProjectId) return;
    if (!window.confirm(`Rollback the live website to the release from ${new Date(version.created_at).toLocaleString()}? Your editor draft will stay unchanged.`)) return;
    setPublishBusy(true);
    setPublishError('');
    try {
      const folder = `${user.id}/${cloudProjectId}`;
      const manifest = Array.isArray(version.file_manifest) ? version.file_manifest : [];
      if (!manifest.length) throw new Error('This release has no stored files.');
      const liveNames = new Set(manifest.map((item) => item.name));
      const { data: existing, error: listError } = await supabase.storage.from('published-sites').list(folder, { limit: 100 });
      if (listError) throw listError;
      const stalePaths = (existing || [])
        .filter((item) => item.id && item.name && !liveNames.has(item.name))
        .map((item) => `${folder}/${item.name}`);
      if (stalePaths.length) {
        const { error: removeError } = await supabase.storage.from('published-sites').remove(stalePaths);
        if (removeError) throw removeError;
      }
      for (const file of manifest) {
        const { data: blob, error: downloadError } = await supabase.storage.from('published-sites').download(`${version.storage_prefix}/${file.name}`);
        if (downloadError || !blob) throw downloadError || new Error(`Could not restore ${file.name}`);
        const { error: uploadError } = await supabase.storage.from('published-sites').upload(`${folder}/${file.name}`, blob, {
          upsert: true,
          contentType: file.contentType || blob.type || 'application/octet-stream',
          cacheControl: '60',
        });
        if (uploadError) throw uploadError;
      }
      const nextPublishedAt = new Date().toISOString();
      const projectData = {
        ...buildProjectData(),
        publishedUrl: version.published_url || publishedUrl,
        publishedAt: nextPublishedAt,
        lastPublishedVersionId: version.id,
        lastPublishedFingerprint: version.editor_fingerprint,
        updatedAt: nextPublishedAt,
      };
      const { error: projectError } = await supabase.from('projects').update({
        content: projectData,
        status: 'completed',
        updated_at: nextPublishedAt,
      }).eq('id', cloudProjectId).eq('user_id', user.id);
      if (projectError) throw projectError;
      setPublishedUrl(version.published_url || publishedUrl);
      setPublishedAt(nextPublishedAt);
      setLastPublishedVersionId(version.id);
      setLastPublishedFingerprint(version.editor_fingerprint);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
      lastSavedSnapshotRef.current = buildProjectFingerprint();
      setAutoSaveStatus('saved');
      await verifyLiveDeployment();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not rollback this release.');
    } finally {
      setPublishBusy(false);
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
    if (version.id === lastPublishedVersionId) {
      setPublishVersionsError('You cannot delete the release currently serving as the live rollback reference.');
      return;
    }
    if (!window.confirm('Delete this stored release archive? This cannot be undone.')) return;
    setPublishVersionsLoading(true);
    setPublishVersionsError('');
    try {
      const manifest = Array.isArray(version.file_manifest) ? version.file_manifest : [];
      const paths = manifest.map((item) => `${version.storage_prefix}/${item.name}`);
      if (paths.length) {
        const { error: removeError } = await supabase.storage.from('published-sites').remove(paths);
        if (removeError) throw removeError;
      }
      const { error } = await supabase.from('website_publish_versions').delete().eq('id', version.id).eq('project_id', cloudProjectId).eq('user_id', user.id);
      if (error) throw error;
      setPublishVersions((current) => current.filter((item) => item.id !== version.id));
    } catch (error) {
      setPublishVersionsError(error instanceof Error ? error.message : 'Could not delete this release.');
    } finally {
      setPublishVersionsLoading(false);
    }
  }

  function cloudErrorIsRetryable(message: string) {
    return !/permission|policy|not authorized|forbidden|limit reached|invalid|duplicate|violates|read-only/i.test(message || '');
  }

  async function retryCloudOperation<T extends { error: { message?: string } | null; data?: unknown }>(operation: () => PromiseLike<T>, attempts = 3): Promise<T> {
    let result = await operation();
    for (let attempt = 1; result.error && attempt < attempts; attempt += 1) {
      if (!cloudErrorIsRetryable(result.error.message || '') || (typeof navigator !== 'undefined' && !navigator.onLine)) break;
      await new Promise((resolve) => window.setTimeout(resolve, 350 * Math.pow(2, attempt - 1)));
      result = await operation();
    }
    return result;
  }

  async function saveProject(options: { automatic?: boolean; createHistory?: boolean } = {}): Promise<boolean> {
    const automatic = options.automatic === true;
    const createHistory = options.createHistory ?? !automatic;
    const fingerprint = buildProjectFingerprint();

    if (user && cloudProjectId && !projectTeamAccess.canEdit) {
      setCloudError('This shared project is read-only for your Viewer role.');
      setAutoSaveStatus('failed');
      return false;
    }

    let historyEntries = projectHistory;
    if (createHistory) {
      const snapshot = buildProjectSnapshot();
      const entry: ProjectHistoryEntry = {
        id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        savedAt: snapshot.updatedAt,
        label: `Saved ${new Date(snapshot.updatedAt).toLocaleString()}`,
        snapshot,
      };
      historyEntries = [entry, ...projectHistory].slice(0, 30);
      setProjectHistory(historyEntries);
    }

    const projectData = buildProjectData(historyEntries);
    let localSaved = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
    } catch {
      localSaved = false;
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
        const result = await retryCloudOperation(() => supabase
          .from('projects')
          .update({
            title: siteName.trim() || 'My Website',
            content: projectData,
            status: publishedUrl ? 'completed' : 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cloudProjectId));

        if (result.error) {
          if (/limit reached/i.test(result.error.message || '')) openBillingWithMessage(result.error.message);
          setCloudError(result.error.message || (automatic ? 'Autosaved locally, but cloud autosave failed.' : 'Saved locally, but cloud save failed.'));
          setCloudSyncFailed(true);
        } else {
          cloudSaved = true;
          setCloudSyncFailed(false);
        }
      } else {
        const result = await retryCloudOperation(() => supabase
          .from('projects')
          .insert({
            user_id: user.id,
            title: siteName.trim() || 'My Website',
            type: 'website-builder',
            content: projectData,
            status: publishedUrl ? 'completed' : 'draft',
          })
          .select('id, title, content, updated_at')
          .single());

        if (result.error || !result.data) {
          if (result.error && /limit reached/i.test(result.error.message || '')) openBillingWithMessage(result.error.message);
          setCloudError(result.error?.message || (automatic ? 'Autosaved locally, but cloud autosave failed.' : 'Saved locally, but cloud save failed.'));
          setCloudSyncFailed(true);
        } else {
          setCloudProjectId(result.data.id);
          setProjectTeamAccess({ ...DEFAULT_PROJECT_TEAM_ACCESS, ownerId: user.id });
          cloudSaved = true;
          setCloudSyncFailed(false);
        }
      }

      if (cloudSaved) await refreshCloudProjects();
      setCloudBusy(false);
    }

    const durableSaved = user ? cloudSaved : localSaved;
    if (durableSaved) lastSavedSnapshotRef.current = fingerprint;
    setAutoSaveStatus(durableSaved ? 'saved' : 'failed');

    if (!automatic) {
      setSaved(durableSaved);
      if (durableSaved) window.setTimeout(() => setSaved(false), 2000);
    }
    return durableSaved;
  }

  saveProjectRef.current = saveProject;

  async function duplicateProject() {
    if (user && billingState.usage.websiteProjects >= billingEntitlements.maxWebsiteProjects) {
      openBillingWithMessage(`Your ${BILLING_PLAN_DETAILS[billingPlan].label} plan supports ${billingEntitlements.maxWebsiteProjects} Website Builder project${billingEntitlements.maxWebsiteProjects === 1 ? '' : 's'}. Upgrade before duplicating another project.`);
      return;
    }
    const duplicateTitle = `${siteName.trim() || 'My Website'} Copy`;
    const duplicateContent = {
      ...buildProjectSnapshot(),
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
      setProjectHistory([]);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(duplicateContent));
      lastSavedSnapshotRef.current = '';
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      return;
    }

    setCloudBusy(true);
    setCloudError('');
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title: duplicateTitle,
        type: 'website-builder',
        content: duplicateContent,
        status: 'draft',
      })
      .select('id, title, content, updated_at')
      .single();

    if (error || !data) {
      if (error && /limit reached/i.test(error.message || '')) openBillingWithMessage(error.message);
      setCloudError(error?.message || 'Could not duplicate this project.');
      setCloudBusy(false);
      return;
    }

    setCloudProjectId(data.id);
    setProjectHistory([]);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(duplicateContent));
    lastSavedSnapshotRef.current = '';
    await refreshCloudProjects();
    setCloudBusy(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function restoreHistoryEntry(entry: ProjectHistoryEntry) {
    const confirmed = window.confirm(`Restore "${entry.label}"? Your current unsaved changes will be replaced.`);
    if (!confirmed) return;
    saveRecoverySnapshot('before restoring history entry');
    applyProjectData(entry.snapshot, false);
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREVIOUS_STORAGE_KEY);
    localStorage.removeItem(V3_STORAGE_KEY);
    localStorage.removeItem(V2_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setCloudProjectId(null);
    setCloudError('');
    setProjectHistory([]);
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
      leadProjectId: cloudProjectId,
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
        const importedProject = { ...project, publishedUrl: '', publishedAt: null, updatedAt: new Date().toISOString() };
        saveRecoverySnapshot('before importing backup');
        skipNextAutosaveRef.current = true;
        applyProjectData(importedProject);
        setCloudProjectId(null);
        setProjectHistory(Array.isArray(importedProject.history) ? importedProject.history.slice(0, 30) : []);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(importedProject));
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
      const meta = leadSource(lead);
      rows.push([lead.id, lead.status, lead.stage || 'new', Number(lead.priority || 0), (lead.tags || []).join('|'), lead.notes || '', lead.created_at, lead.updated_at || '', lead.name, lead.email, leadPhone(lead), lead.message, lead.page_path || '', meta.source, meta.medium, meta.campaign, meta.referrer, lead.form_data || {}]);
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
      const meta = leadSource(lead);
      leadRows.push([lead.id, lead.status, lead.stage || 'new', Number(lead.priority || 0), (lead.tags || []).join('|'), lead.notes || '', lead.created_at, lead.name, lead.email, leadPhone(lead), lead.message, lead.page_path || '', meta.source, meta.medium, meta.campaign, meta.referrer]);
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
    if (!user || !cloudProjectId) return;
    const newIds = leads.filter((lead) => lead.status === 'new').map((lead) => lead.id);
    if (!newIds.length) return;
    const { error } = await supabase
      .from('website_leads')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id)
      .eq('status', 'new');
    if (error) { setLeadsError('Could not mark all leads as read.'); return; }
    setLeads((current) => current.map((lead) => lead.status === 'new' ? { ...lead, status: 'read' } : lead));
  }

  async function archiveReadLeads() {
    if (!user || !cloudProjectId) return;
    const readCount = leads.filter((lead) => lead.status === 'read').length;
    if (!readCount) return;
    const { error } = await supabase
      .from('website_leads')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('project_id', cloudProjectId)
      .eq('user_id', user.id)
      .eq('status', 'read');
    if (error) { setLeadsError('Could not archive read leads.'); return; }
    setLeads((current) => current.map((lead) => lead.status === 'read' ? { ...lead, status: 'archived' } : lead));
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
    if (cloudSyncFailed || autoSaveStatus === 'failed') {
      setPublishError('Publish preflight blocked: cloud sync is not healthy. Save successfully before publishing.');
      return;
    }
    if (cloudProjectId && !projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can publish a shared website. Editors can save content changes for the owner to publish.');
      return;
    }
    if (!user) {
      setPublishError('Sign in before publishing.');
      return;
    }
    if (!cloudProjectId) {
      setPublishError('Save this project to the cloud before publishing.');
      return;
    }
    if (!v1LaunchStatus.preflightReady) {
      setPublishError(`Publish preflight blocked: ${v1LaunchStatus.blockers[0] || 'complete the Launch Center checks first.'}`);
      return;
    }

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    if (!supabaseUrl) {
      setPublishError('Supabase URL is not configured.');
      return;
    }

    setPublishBusy(true);
    setPublishError('');
    setLiveVerification('checking');

    try {
      const folder = `${user.id}/${cloudProjectId}`;
      const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/published-sites/${folder}`;
      const currentPages = getCurrentPages();
      const files: Array<{ name: string; content: string; contentType: string }> = currentPages.map((page) => ({
        name: page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`,
        content: getHtml(page.sections, page.id, publicBaseUrl, true, true),
        contentType: 'text/html; charset=utf-8',
      }));

      const sitemapEntries = currentPages.filter((page) => page.noIndex !== true).map((page) => {
        const location = page.id === homePageId
          ? `${publicBaseUrl}/index.html`
          : `${publicBaseUrl}/${normalizeSlug(page.slug)}.html`;
        return `  <url><loc>${escapeHtml(location)}</loc></url>`;
      }).join('\n');
      const customRobotsRules = sanitizeRobotsRules(productionConfig.customRobotsRules);
      files.push(
        { name: '404.html', content: get404Html(publicBaseUrl, true, true), contentType: 'text/html; charset=utf-8' },
        { name: 'sitemap.xml', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>`, contentType: 'application/xml; charset=utf-8' },
        { name: 'robots.txt', content: `User-agent: *\nAllow: /\n${customRobotsRules ? `\n${customRobotsRules}\n` : '\n'}Sitemap: ${publicBaseUrl}/sitemap.xml\n`, contentType: 'text/plain; charset=utf-8' },
      );

      const liveNames = new Set(files.map((file) => file.name));
      const { data: existing, error: listError } = await supabase.storage.from('published-sites').list(folder, { limit: 100 });
      if (listError) throw listError;
      const stalePaths = (existing || [])
        .filter((item) => item.id && item.name && !liveNames.has(item.name))
        .map((item) => `${folder}/${item.name}`);
      if (stalePaths.length) {
        const { error: removeError } = await supabase.storage.from('published-sites').remove(stalePaths);
        if (removeError) throw removeError;
      }

      const versionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
            const random = Math.floor(Math.random() * 16);
            const value = character === 'x' ? random : (random & 0x3) | 0x8;
            return value.toString(16);
          });
      const versionPrefix = `${folder}/versions/${versionId}`;

      for (const file of files) {
        const blob = new Blob([file.content], { type: file.contentType });
        const { error: liveError } = await supabase.storage.from('published-sites').upload(`${folder}/${file.name}`, blob, {
          upsert: true,
          contentType: file.contentType,
          cacheControl: '60',
        });
        if (liveError) throw liveError;
        const { error: archiveError } = await supabase.storage.from('published-sites').upload(`${versionPrefix}/${file.name}`, blob, {
          upsert: false,
          contentType: file.contentType,
          cacheControl: '31536000',
        });
        if (archiveError) throw archiveError;
      }

      const nextPublishedUrl = `${publicBaseUrl}/index.html`;
      const nextPublishedAt = new Date().toISOString();
      const editableFingerprint = buildEditableFingerprint();
      const projectData = {
        ...buildProjectData(),
        publishedUrl: nextPublishedUrl,
        publishedAt: nextPublishedAt,
        lastPublishedVersionId: versionId,
        lastPublishedFingerprint: editableFingerprint,
        updatedAt: nextPublishedAt,
      };
      const manifest = files.map((file) => ({ name: file.name, contentType: file.contentType }));
      const { error: versionError } = await supabase.from('website_publish_versions').insert({
        id: versionId,
        project_id: cloudProjectId,
        user_id: user.id,
        release_note: releaseNote.trim().slice(0, 500),
        published_url: nextPublishedUrl,
        storage_prefix: versionPrefix,
        editor_fingerprint: editableFingerprint,
        snapshot: projectData,
        file_manifest: manifest,
      });
      if (versionError) throw versionError;

      const { error: projectError } = await supabase.from('projects').update({
        content: projectData,
        status: 'completed',
        updated_at: nextPublishedAt,
      }).eq('id', cloudProjectId).eq('user_id', user.id);
      if (projectError) throw projectError;

      setPublishedUrl(nextPublishedUrl);
      setPublishedAt(nextPublishedAt);
      setLastPublishedVersionId(versionId);
      setLastPublishedFingerprint(editableFingerprint);
      setReleaseNote('');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
      lastSavedSnapshotRef.current = buildProjectFingerprint();
      setAutoSaveStatus('saved');
      setLiveVerification('healthy');
      await Promise.all([refreshCloudProjects(), refreshPublishVersions()]);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not publish this website.');
      setLiveVerification('failed');
    } finally {
      setPublishBusy(false);
    }
  }

  async function unpublishWebsite() {
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can unpublish a shared website.');
      return;
    }
    if (!window.confirm('Remove the public version of this website?')) return;

    setPublishBusy(true);
    setPublishError('');

    try {
      const folder = `${user.id}/${cloudProjectId}`;
      const { data: existing, error: listError } = await supabase.storage
        .from('published-sites')
        .list(folder, { limit: 100 });
      if (listError) throw listError;

      const paths = (existing || []).filter((item) => item.name && item.id).map((item) => `${folder}/${item.name}`);
      if (paths.length) {
        const { error: removeError } = await supabase.storage.from('published-sites').remove(paths);
        if (removeError) throw removeError;
      }

      const nextUpdatedAt = new Date().toISOString();
      const projectData = {
        ...buildProjectData(),
        publishedUrl: '',
        publishedAt: null,
        lastPublishedVersionId: null,
        lastPublishedFingerprint: '',
        updatedAt: nextUpdatedAt,
      };

      const { error: projectError } = await supabase
        .from('projects')
        .update({
          content: projectData,
          status: 'draft',
          updated_at: nextUpdatedAt,
        })
        .eq('id', cloudProjectId)
        .eq('user_id', user.id);
      if (projectError) throw projectError;

      setPublishedUrl('');
      setPublishedAt(null);
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setLiveVerification('idle');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
      lastSavedSnapshotRef.current = buildProjectFingerprint();
      setAutoSaveStatus('saved');
      await refreshCloudProjects();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not unpublish this website.');
    } finally {
      setPublishBusy(false);
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
    setLaunchCheckBusy(true);
    try {
      if (user) await refreshBilling(cloudProjectId);
      if (user && cloudProjectId) await refreshProjectTeamAccess(cloudProjectId);
      if (publishedUrl) await verifyLiveDeployment();
      setLaunchLastCheckedAt(new Date().toISOString());
    } finally {
      setLaunchCheckBusy(false);
    }
  }

  const launchReadiness = useMemo(() => {
    const auditPoints = Math.round(siteAudit.score * 0.4);
    const checks = [
      { label: 'Production URL', ok: Boolean(normalizeSiteUrl(siteUrl)), points: 10 },
      { label: 'Cloud project', ok: Boolean(cloudProjectId), points: 10 },
      { label: 'Share preview', ok: Boolean(previewUrl), points: 8 },
      { label: 'Client approval', ok: approvalCurrent, points: 12 },
      { label: 'Published release', ok: Boolean(publishedUrl && lastPublishedVersionId), points: 15 },
      { label: 'Favicon', ok: Boolean(faviconUrl.trim()), points: 5 },
    ];
    const score = Math.min(100, auditPoints + checks.reduce((total, item) => total + (item.ok ? item.points : 0), 0));
    return { score, checks, auditPoints };
  }, [siteAudit.score, siteUrl, cloudProjectId, previewUrl, approvalCurrent, publishedUrl, lastPublishedVersionId, faviconUrl]);

  const v1LaunchStatus = useMemo(() => {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const contentReady = currentPages.length > 0 && currentPages.some((page) => page.sections.some((section) => (section.elements || []).length > 0));
    const syncHealthy = networkOnline && !cloudSyncFailed && autoSaveStatus !== 'failed';
    const billingVerified = Boolean(user) && !billingLoading && !billingError;
    const productionUrlReady = Boolean(normalizeSiteUrl(siteUrl));
    const seoReady = Boolean(seo.title.trim() && faviconUrl.trim());
    const auditReady = siteAudit.errors.length === 0 && siteAudit.score >= 80;
    const publishPermission = Boolean(user && cloudProjectId && projectTeamAccess.canPublish);
    const publishedRelease = Boolean(publishedUrl && lastPublishedVersionId);
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
      { label: 'Published release', detail: publishedRelease ? `Release ${lastPublishedVersionId?.slice(0, 8) || 'saved'}` : 'Publish the first release', ok: publishedRelease, points: 15 },
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

  const hasUnpublishedChanges = Boolean(
    publishedUrl && lastPublishedFingerprint && buildEditableFingerprint() !== lastPublishedFingerprint
  );

  return (
    <div
      className={`-m-4 flex min-h-[calc(100vh-64px)] flex-col lg:-m-8 ${
        darkMode ? 'bg-[#06060f] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 ${
          darkMode
            ? 'border-white/10 bg-[#0a0a1a]'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/12">
            <Globe className="h-5 w-5 text-violet-400" />
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
            className={`hidden sm:block w-36 rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
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
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            title={l(!leftSidebarOpen && !inspectorOpen ? 'Show editing panels' : 'Focus on canvas')}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden xl:inline">{l(!leftSidebarOpen && !inspectorOpen ? 'Panels' : 'Focus')}</span>
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
              className={'flex cursor-pointer list-none items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden ' + (darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100')}
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
                        setCloudProjectId(null);
                        setProjectTeamAccess(DEFAULT_PROJECT_TEAM_ACCESS);
                        return;
                      }
                      void loadCloudProject(value);
                    }}
                    disabled={cloudBusy}
                    className={`mt-2 w-full rounded-lg border px-2.5 py-2 text-[11px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  >
                    <option value="">{l('New cloud project')}</option>
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
            <ExternalLink className="h-4 w-4" />{l('Preview')}</button>

          <button
            onClick={() => void saveProject()}
            disabled={cloudBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? 'border-white/10 text-gray-200 hover:bg-white/5' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            title={user ? 'Save locally and to your account' : 'Save locally'}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save'}
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
                  const meta = leadSource(lead);
                  const phone = leadPhone(lead);
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
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('Last 10 manual saves. Autosave does not create history entries.')}</p>
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
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('No manual save history yet. Click Save to create the first restore point.')}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={`w-full shrink-0 border-b p-3 transition-[width,padding] duration-200 lg:border-b-0 lg:border-r ${leftSidebarOpen ? 'lg:w-60 lg:p-3' : 'lg:w-12 lg:p-2'} ${
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
                    <option value="en">{l('English')}</option><option value="sv">Svenska</option><option value="ar">العربية</option>
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
              <span className="mt-0.5 rounded-full border border-violet-500/15 bg-violet-500/[0.06] px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-violet-400">V2</span>
            </div>

            <div className="space-y-3.5 p-3.5">
              <div className="max-h-44 space-y-2.5 overflow-auto pr-1">
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
                    onClick={applyAIChange}
                    disabled={!aiPrompt.trim() || aiBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-xs font-black text-white shadow-sm shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {aiBusy ? 'Applying AI change...' : l('Apply AI change')}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={generateWithAI}
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
                <button
                  onClick={generateWithAI}
                  disabled={!aiPrompt.trim() || aiBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-xs font-black text-white shadow-sm shadow-violet-950/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiBusy ? `${aiStage === 'planning' ? 'Planning' : aiStage === 'building' ? 'Building' : 'Styling'}...` : l('Build website with AI')}
                </button>
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

        <main
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
    <div
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

        <aside
          className={`w-full shrink-0 border-t p-3 transition-[width,padding] duration-200 lg:border-l lg:border-t-0 ${inspectorOpen ? 'lg:w-80 lg:p-3' : 'lg:w-12 lg:p-2'} ${
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
          <div className="mb-5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            <div>
              <h2 className="text-xs font-bold">{selectedElement ? `${l('Edit')} ${ELEMENT_LABELS[selectedElement.type]}` : l('Inspector')}</h2>
              <p className="mt-0.5 text-[9px] text-gray-500">{selectedElement ? (selectedElement.type === 'heading' || selectedElement.type === 'text' ? l('Double-click the text on the page for quick editing, or use the controls here.') : l('Change the basics here. Open Advanced only when you need it.')) : l('Select something on the page to start editing.')}</p>
            </div>
          </div>

          {selectedElement && (
            <div className={`mb-5 space-y-3 rounded-xl border p-3 ${darkMode ? 'border-violet-500/25 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
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
                  <span>{l('Structure & reusable components')}</span>
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
              {selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
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
                  <span>{l('Advanced design & responsive')}</span>
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
}
