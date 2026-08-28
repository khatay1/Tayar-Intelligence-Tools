Warning: truncated output (original token count: 130588)
Total output lines: 8798

import { useLocalizer } from '@/lib/ui-localization';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createAIService } from '@/lib/ai/service';
import { usePreferences, type Language } from '@/context/PreferencesContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
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

interface AIWebsiteGeneration {
  siteName?: string;
  brand?: WebsiteBrand;
  seo?: WebsiteSEO;
  sections: Array<Partial<WebsiteSection> & Pick<WebsiteSection, 'type'>>;
}

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
    `transform:rotate(${rotate}deg)${suffix}`,
    `width:${width ? `${width}%` : 'auto'}${suffix}`,
  ].join(';');
}

function elementHoverCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const scale = clampElementNumber(style.hoverScale, 1, 0.5, 1.6);
  const hoverOpacity = clampElementNumber(style.hoverOpacity, style.opacity ?? 1, 0, 1);
  const rules = [
    `transform:rotate(${rotate}deg) scale(${scale})${suffix}`,
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
      const selector = `[data-tayar-element=\"${cssAttributeValue(element.id)}\"]`;
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
            Authorization: 'Bearer ' + …90588 tokens truncated…      className={`mt-3 w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                darkMode
                  ? 'border-white/10 bg-white/5 text-white placeholder:text-gray-600'
                  : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
              }`}
            />
            <button
              onClick={generateWithAI}
              disabled={!aiPrompt.trim() || aiBusy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiBusy ? 'Generating...' : 'Generate Website'}
            </button>
            {aiError && (
              <p className="mt-2 text-[11px] leading-relaxed text-red-400">{aiError}</p>
            )}
          </div>

          <div
            className={`mt-4 rounded-xl border p-3 ${
              darkMode
                ? 'border-white/10 bg-white/[0.03]'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">{l('Export')}</span>
            </div>

            <button
              onClick={copyHtml}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied HTML' : 'Copy HTML'}
            </button>
          </div>
        </aside>

        <main
          className={`min-h-[600px] flex-1 overflow-auto p-4 lg:p-6 ${
            darkMode ? 'bg-[#030712]' : 'bg-gray-100'
          }`}
        >
          <div
            className={`mx-auto overflow-hidden rounded-2xl shadow-2xl transition-all ${
              device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : 'w-full max-w-6xl'
            } ${darkMode ? 'bg-[#0f172a]' : 'bg-white'}`}
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
            {sections.map((section) => (
  <div
    key={section.id}
    onDragStart={(e) => handleDragStart(section.id, e)}
    onDragOver={(e) => handleDragOver(e, section.id)}
    onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, section.id)}
              draggable={true}
    className={`relative transition-opacity ${
      draggedId === section.id ? 'opacity-40' : 'opacity-100'
      } 
    }`}
  >
    <SectionPreview
      section={section}
      selected={selectedId === section.id}
      selectedElementId={selectedId === section.id ? selectedElementId : null}
      onSelect={() => { setSelectedId(section.id); setSelectedElementId(null); }}
      onSelectElement={(elementId) => { setSelectedId(section.id); setSelectedElementId(elementId); }}
      draggedElementId={selectedId === section.id ? draggedElementId : null}
      dragOverElementId={selectedId === section.id ? dragOverElementId : null}
      onElementDragStart={(elementId, e) => { setSelectedId(section.id); setSelectedElementId(elementId); handleElementDragStart(elementId, e); }}
      onElementDragOver={(elementId, e) => handleElementDragOver(elementId, e)}
      onElementDrop={(elementId, e) => handleElementDrop(elementId, e)}
      onElementDragEnd={handleElementDragEnd}
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
        </main>

        <aside
          className={`w-full shrink-0 border-t p-4 lg:w-72 lg:border-l lg:border-t-0 ${
            darkMode
              ? 'border-white/10 bg-[#0a0a1a]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Inspector
            </h2>
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
                <button onClick={resetSelectedElementResponsive} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}>
                  Reset {device}
                </button>
              </div>
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
              {selectedSection && !selectedContainer && sectionColumnCount(selectedSection.layout) > 1 && (
                <div className={`rounded-lg border p-2 ${darkMode ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/60'}`}>
                  <label className="block text-[10px] font-semibold text-indigo-400">Column
                    <select value={Math.min(sectionColumnCount(selectedSection.layout), Math.max(1, Number(selectedElement.layoutColumn) || 1))} onChange={(e) => updateSelectedElement({ layoutColumn: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-indigo-200 bg-white'}`}>
                      {Array.from({ length: sectionColumnCount(selectedSection.layout) }, (_, index) => <option key={index + 1} value={index + 1}>Column {index + 1}</option>)}
                    </select>
                  </label>
                </div>
              )}

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
              <button onClick={deleteSelectedElement} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" />{l('Delete Element')}</button>
            </div>
          )}

          {!selectedSection ? (
            <div className="py-10 text-center text-xs text-gray-500">
              Select a section to edit it.
            </div>
          ) : (
            <div className="space-y-5">
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
          )}
        </aside>
      </div>
    </div>
  );
}
