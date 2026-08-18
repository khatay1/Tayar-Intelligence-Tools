// Monitoring integrations: PostHog, Google Analytics 4, Sentry Error Tracking
// All integrations are opt-in via environment variables and load lazily.

import { env } from './env';
import { track as trackLocal } from './analytics';

// --- PostHog ---
let posthogLoaded = false;
function loadPostHog() {
  if (posthogLoaded || !env.posthogKey || typeof window === 'undefined') return;
  posthogLoaded = true;
  const script = document.createElement('script');
  script.innerHTML = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function n(t){e[t]=function(){e._i.push([t].concat(Array.prototype.slice.call(arguments,0)))}}var r=["addDec","addFeatureFlag","addFeatureFlagHandler","addFeatureFlags","addFeatureFlagsHandler","capture","captureException","captureMessage","clearFlags","distinctId","getFeatureFlag","getFeatureFlagKey","getFeatureFlagPayload","getProperty","getPersonProperties","getReplay","getReplayUrl","getSurvey","getSurveyFeedback","identify","init","on","onFeatureFlags","onSessionId","people","register","registerForSession","reset","sanitizeProperties","screen","setPersonProperties","startSessionRecording","stopSessionRecording","survey","timeEvent","unregister","unregisterForSession"],i=r.length;i--;)n(r[i]);e._i.push([i,s,a])};e.__SV=1;var l=t.createElement("script");l.type="text/javascript",l.async=!0,l.crossOrigin="anonymous",l.src="${env.posthogHost}/array.js";var u=t.getElementsByTagName("script")[0];u.parentNode.insertBefore(l,u)}(document,window.posthog||[]);
    posthog.init("${env.posthogKey}", { api_host: "${env.posthogHost}", session_recording: { recordCanvas: true } });
  `;
  document.head.appendChild(script);
}

// --- Google Analytics 4 ---
let gaLoaded = false;
function loadGA() {
  if (gaLoaded || !env.gaMeasurementId || typeof window === 'undefined') return;
  gaLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${env.gaMeasurementId}`;
  document.head.appendChild(script);
  const inline = document.createElement('script');
  inline.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${env.gaMeasurementId}', { send_page_view: false });
  `;
  document.head.appendChild(inline);
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
        tracesSampleRate: 0.1,
        environment: env.env,
      });
    }
  };
  document.head.appendChild(script);
}

// --- Initialize all ---
export function initMonitoring() {
  loadPostHog();
  loadGA();
  loadSentry();
}

// --- Unified tracking ---
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  trackLocal(name, 'user_action', properties);

  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(name, properties);
  }

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, properties);
  }
}

export function trackPageViewMonitored(path: string) {
  trackLocal(path, 'page_view', { referrer: document.referrer || undefined });

  if (typeof window !== 'undefined') {
    if (window.posthog) window.posthog.capture('$pageview', { $current_url: path });

    if (typeof window.gtag === 'function' && env.gaMeasurementId) {
      window.gtag('config', env.gaMeasurementId, { page_path: path });
    }
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  trackLocal('error', 'error', { message: error.message, stack: error.stack?.slice(0, 500) });

  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error, { extra: context });
  }
}
