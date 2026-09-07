import { supabase } from './supabase';
import { closeNativeBrowser, isTayarNativeApp } from './mobile-files';

type PendingUrlWindow = Window & {
  __TayarPendingAppUrl?: string;
};

interface ParsedMobileAuthUrl {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  recovery: boolean;
  error: string | null;
}

function parseMobileAuthUrl(raw: string): ParsedMobileAuthUrl | null {
  let url: URL;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'tayartools:' || url.hostname !== 'auth') return null;

  const query = new URLSearchParams(url.search);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const value = (key: string) => query.get(key) || hash.get(key);
  const type = value('type') || value('auth');

  return {
    accessToken: value('access_token'),
    refreshToken: value('refresh_token'),
    code: value('code'),
    recovery: type === 'recovery',
    error: value('error_description') || value('error'),
  };
}

async function applyMobileAuthUrl(raw: string): Promise<void> {
  const parsed = parseMobileAuthUrl(raw);
  if (!parsed) return;

  const pendingWindow = window as PendingUrlWindow;
  if (pendingWindow.__TayarPendingAppUrl === raw) delete pendingWindow.__TayarPendingAppUrl;
  await closeNativeBrowser();

  if (parsed.error) {
    console.error('[mobile-auth] Authentication callback error:', parsed.error);
    window.dispatchEvent(new CustomEvent('tayar:mobile-auth-error', { detail: { message: parsed.error } }));
    return;
  }

  if (parsed.accessToken && parsed.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (error) {
      window.dispatchEvent(new CustomEvent('tayar:mobile-auth-error', { detail: { message: error.message } }));
      return;
    }
  } else if (parsed.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) {
      window.dispatchEvent(new CustomEvent('tayar:mobile-auth-error', { detail: { message: error.message } }));
      return;
    }
  } else {
    return;
  }

  if (parsed.recovery) window.location.hash = 'reset';
  window.dispatchEvent(new CustomEvent('tayar:mobile-auth-success', { detail: { recovery: parsed.recovery } }));
}

export function initMobileAuthBridge(): void {
  if (!isTayarNativeApp() || typeof window === 'undefined') return;

  const onAppUrl = (event: Event) => {
    const detail = (event as CustomEvent<{ url?: string }>).detail;
    const raw = String(detail?.url || '').trim();
    if (raw) void applyMobileAuthUrl(raw);
  };

  window.addEventListener('tayar:app-url-open', onAppUrl);

  const pending = String((window as PendingUrlWindow).__TayarPendingAppUrl || '').trim();
  if (pending) void applyMobileAuthUrl(pending);
}
