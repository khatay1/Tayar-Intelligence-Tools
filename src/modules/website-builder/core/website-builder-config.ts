import type {
  BillingEntitlements, BillingFeature, BillingPlan, BillingState, BillingSubscriptionSnapshot, WebsiteFooterConfig, WebsiteHeaderConfig,
  WebsiteProductionConfig, WebsiteSiteEnhancements, WebsiteTheme,
} from './website-builder-model';
import type { WebsiteSection } from './types';

export const REUSABLE_SECTIONS_KEY = 'tayar.website-builder.reusable-sections.v1';
export const FONT_OPTIONS = ['Inter', 'Arial', 'Georgia', 'Trebuchet MS', 'Courier New', 'system-ui'];
export const DEFAULT_THEME: WebsiteTheme = {
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

export const DEFAULT_HEADER_CONFIG: WebsiteHeaderConfig = {
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

export const DEFAULT_FOOTER_CONFIG: WebsiteFooterConfig = {
  enabled: false,
  text: '',
  showNavigation: true,
  instagramUrl: '',
  facebookUrl: '',
  linkedinUrl: '',
  xUrl: '',
};

export const DEFAULT_SITE_ENHANCEMENTS: WebsiteSiteEnhancements = {
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

export const DEFAULT_PRODUCTION_CONFIG: WebsiteProductionConfig = {
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

export const FREE_BILLING_ENTITLEMENTS: BillingEntitlements = {
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

export const PRO_BILLING_ENTITLEMENTS: BillingEntitlements = {
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

export const BUSINESS_BILLING_ENTITLEMENTS: BillingEntitlements = {
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

export const LOCAL_BILLING_ENTITLEMENTS: Record<BillingPlan, BillingEntitlements> = {
  free: FREE_BILLING_ENTITLEMENTS,
  pro: PRO_BILLING_ENTITLEMENTS,
  business: BUSINESS_BILLING_ENTITLEMENTS,
};

export const BILLING_PLAN_DETAILS: Record<BillingPlan, { label: string; badge: string; description: string; bullets: string[] }> = {
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

export function sanitizeCustomCss(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, 30000).replace(/<\/?style\b[^>]*>/gi, '').replace(/<\//g, '<\\/');
}

export function sanitizeRobotsRules(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[<>]/g, '').trimEnd())
    .slice(0, 100)
    .join('\n')
    .slice(0, 5000)
    .trim();
}

export function normalizeProductionConfig(value: Partial<WebsiteProductionConfig> | null | undefined): WebsiteProductionConfig {
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

export function normalizeHeaderConfig(value: Partial<WebsiteHeaderConfig> | null | undefined): WebsiteHeaderConfig {
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

export function normalizeFooterConfig(value: Partial<WebsiteFooterConfig> | null | undefined): WebsiteFooterConfig {
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

export function normalizeSiteEnhancements(value: Partial<WebsiteSiteEnhancements> | null | undefined): WebsiteSiteEnhancements {
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

export function safeSocialUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '#';
}

export function normalizeTheme(value: Partial<WebsiteTheme> | null | undefined): WebsiteTheme {
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

export function applyThemeToSection(section: WebsiteSection, index: number, theme: WebsiteTheme): WebsiteSection {
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

export function resolveEffectiveProductionConfig(
  productionConfig: WebsiteProductionConfig,
  billingEntitlements: BillingEntitlements,
): WebsiteProductionConfig {
  return {
    ...productionConfig,
    customCss: billingEntitlements.features.customCss ? productionConfig.customCss : '',
    ga4Id: billingEntitlements.features.productionIntegrations ? productionConfig.ga4Id : '',
    gtmId: billingEntitlements.features.productionIntegrations ? productionConfig.gtmId : '',
    metaPixelId: billingEntitlements.features.productionIntegrations ? productionConfig.metaPixelId : '',
    plausibleDomain: billingEntitlements.features.productionIntegrations ? productionConfig.plausibleDomain : '',
  };
}

export function normalizeBillingStatePayload(
  data: Record<string, unknown>,
  pageCount: number,
): BillingState {
  const rawPlan = data.plan === 'business' ? 'business' : data.plan === 'pro' ? 'pro' : 'free';
  const rawEntitlements = data.entitlements && typeof data.entitlements === 'object'
    ? data.entitlements as Record<string, unknown>
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
  const rawUsage = data.usage && typeof data.usage === 'object' ? data.usage as Record<string, unknown> : {};

  return {
    plan: rawPlan,
    entitlements,
    subscription: data.subscription && typeof data.subscription === 'object'
      ? data.subscription as BillingSubscriptionSnapshot
      : null,
    usage: {
      websiteProjects: Number(rawUsage.websiteProjects) || 0,
      pages: pageCount,
      releases: Number(rawUsage.releases) || 0,
      leads: Number(rawUsage.leads) || 0,
      analyticsEvents: Number(rawUsage.analyticsEvents) || 0,
    },
  };
}
