// Lightweight analytics: page views, tool usage, custom events, error logging.
// Stores events in localStorage for batching and sends to Supabase activity_log.

import { supabase } from './supabase';

export interface AnalyticsEvent {
  event: string;
  category: 'page_view' | 'tool_usage' | 'user_action' | 'error' | 'auth';
  properties?: Record<string, unknown>;
}

const QUEUE_KEY = 'tayar-analytics-queue';
const SESSION_KEY = 'tayar-analytics-session';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 30_000;
export const COOKIE_CONSENT_KEY = 'tayar-cookie-consent';
export const COOKIE_CONSENT_EVENT = 'tayar-cookie-consent-changed';

export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { analytics?: unknown };
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getQueue(): AnalyticsEvent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setQueue(queue: AnalyticsEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch {
    // ignore
  }
}

export function track(event: string, category: AnalyticsEvent['category'] = 'user_action', properties?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  const e: AnalyticsEvent = { event, category, properties };
  const queue = getQueue();
  queue.push(e);
  setQueue(queue);

  if (queue.length >= BATCH_SIZE) {
    flush();
  }
}

export function trackPageView(path: string) {
  track(path, 'page_view', { referrer: document.referrer || undefined });
}

export function trackToolUsage(toolId: string, action?: string) {
  track(toolId, 'tool_usage', { action });
}

export function trackError(message: string, stack?: string) {
  track('error', 'error', { message, stack: stack?.slice(0, 500) });
}

let flushTimer: ReturnType<typeof setInterval> | null = null;
let consentListenerRegistered = false;

export function startAnalytics() {
  if (!consentListenerRegistered) {
    consentListenerRegistered = true;
    window.addEventListener(COOKIE_CONSENT_EVENT, () => {
      if (hasAnalyticsConsent()) startAnalytics();
      else {
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
        setQueue([]);
      }
    });
  }

  if (!hasAnalyticsConsent()) {
    setQueue([]);
    return;
  }

  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL);
  window.addEventListener('beforeunload', flush);
}

export async function flush() {
  if (!hasAnalyticsConsent()) {
    setQueue([]);
    return;
  }

  const queue = getQueue();
  if (queue.length === 0) return;

  setQueue([]);
  const sessionId = getSessionId();

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;

    // Log to activity_log table (best-effort, don't block on failure)
    const rows = queue.slice(0, BATCH_SIZE).map(e => ({
  user_id: userId,
  action: e.event,
  tool: e.category,
  metadata: { ...e.properties, session_id: sessionId },
}));

    await supabase.from('activity_log').insert(rows).then(() => undefined);
  } catch {
    // Re-queue on failure
    const current = getQueue();
    setQueue([...queue, ...current].slice(-100));
  }
}
