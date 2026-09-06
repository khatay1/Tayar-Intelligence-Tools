// Monitoring integrations: PostHog, Google Analytics 4, Sentry Error Tracking
// All integrations are opt-in via environment variables and load lazily.

import { env } from './env';
import { COOKIE_CONSENT_EVENT, hasAnalyticsConsent, track as trackLocal } from './analytics';

// --- PostHog ---
let posthogLoaded = false;
function loadPostHog() {
  if (posthogLoaded || !env.posthogKey || typeof window === 'undefined') return;
  posthogLoaded = true;
  const posthogKey = JSON.stringify(env.posthogKey);
  const posthogHost = JSON.stringify(env.posthogHost);
  const posthogScriptUrl = JSON.stringify(`${env.posthogHost.replace(/\/$/, '')}/array.js`);
  const script = document.createElement('script');
  script.textContent = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function n(t){e[t]=function(){e._i.push([t].concat(Array.prototype.slice.call(arguments,0)))}}var r=["addDec","addFeatureFlag","addFeatureFlagHandler","addFeatureFlags","addFeatureFlagsHandler","capture","captureException","captureMessage","clearFlags","distinctId","getFeatureFlag","getFeatureFlagKey","getFeatureFlagPayload","getProperty","getPersonProperties","getReplay","getReplayUrl","getSurvey","getSurveyFeedback","identify","init","on","onFeatureFlags","onSessionId","opt_in_capturing","opt_out_capturing","people","register","registerForSession","reset","sanitizeProperties","screen","setPersonProperties","startSessionRecording","stopSessionRecording","survey","timeEvent","unregister","unregisterForSession"],i=r.length;i--;)n(r[i]);e._i.push([i,s,a])};e.__SV=1;var l=t.createElement("script");l.type="text/javascript",l.async=!0,l.crossOrigin="anonymous",l.src=${posthogScriptUrl};var u=t.getElementsByTagName("script")[0];u.parentNode.insertBefore(l,u)}(document,window.posthog||[]);
    posthog.init(${posthogKey}, {
      api_host: ${posthogHost},
      autocapture: false,
      capture_exceptions: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      disable_session_recording: true,
      enable_heatmaps: false,
      mask_all_element_attributes: true,
      mask_all_text: true,
      persistence: "localStorage",
      person_profiles: "never",
      respect_dnt: true
    });
  `;
  document.head.appendChild(script);
}

// --- Google Analytics 4 ---
let gaLoaded = false;
function loadGA() {
  if (gaLoaded || !env.gaMeasurementId || typeof window === 'undefined') return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => { window.dataLayer?.push(args); });
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
  window.gtag('consent', 'update', { analytics_storage: 'granted' });
  window.gtag('js', new Date());
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${env.gaMeasurementId}`;
  document.head.appendChild(script);
  window.gtag('config', env.gaMeasurementId, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    send_page_view: false,
  });
}

// --- Sentry ---
let sentryLoaded = false;
function loadSentry() {
  if (sentryLoaded || !env.sentryDsn || typeof window === 'undefined') return;
  sentryLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/8.0.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    if (window.Sentry) {
      window.Sentry.init({
        dsn: env.sentryDsn,
        enabled: hasAnalyticsConsent(),
        sendDefaultPii: false,
        tracesSampleRate: 0.1,
        environment: env.env,
        beforeSend: (event: unknown) => hasAnalyticsConsent() ? event : null,
        beforeBreadcrumb: (breadcrumb: unknown) => hasAnalyticsConsent() ? breadcrumb : null,
      });
    }
  };
  document.head.appendChild(script);
}

function setConsentedMonitoringEnabled(enabled: boolean) {
  if (enabled) {
    loadPostHog();
    loadGA();
    loadSentry();
    window.posthog?.opt_in_capturing?.();
  } else {
    window.posthog?.stopSessionRecording?.();
    window.posthog?.opt_out_capturing?.();
  }

  if (env.gaMeasurementId && typeof window.gtag === 'function') {
    (window as unknown as Record<string, unknown>)[`ga-disable-${env.gaMeasurementId}`] = !enabled;
    window.gtag('consent', 'update', { analytics_storage: enabled ? 'granted' : 'denied' });
  }

  const sentryOptions = window.Sentry?.getClient?.()?.getOptions?.();
  if (sentryOptions) sentryOptions.enabled = enabled;
}

// --- Initialize all ---
export function initMonitoring() {
  const applyConsent = () => setConsentedMonitoringEnabled(hasAnalyticsConsent());

  applyConsent();
  window.addEventListener(COOKIE_CONSENT_EVENT, applyConsent);
}

// --- Unified tracking ---
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  trackLocal(name, 'user_action', properties);

  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(name, properties);
  }

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, properties);
  }
}

export function trackPageViewMonitored(path: string) {
  if (!hasAnalyticsConsent()) return;
  trackLocal(path, 'page_view', { referrer: document.referrer || undefined });

  if (typeof window !== 'undefined') {
    if (window.posthog) window.posthog.capture('$pageview', { $current_url: path });

    if (typeof window.gtag === 'function' && env.gaMeasurementId) {
      window.gtag('config', env.gaMeasurementId, { page_path: path });
    }
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  trackLocal('error', 'error', { message: error.message, stack: error.stack?.slice(0, 500) });

  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error, { extra: context });
  }
}
