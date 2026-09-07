import { closeNativeBrowser, installNativeDownloadBridge, installNativeExternalLinkBridge } from './mobile-files';

type TayarMobileWindow = Window & {
  __TayarPendingAppUrl?: string;
  __TayarLastAppUrl?: string;
};

const BILLING_RETURN_STATUSES = new Set(['success', 'canceled', 'portal-return']);

function handoffNativeBillingReturn(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('native') !== '1') return;

  const billing = params.get('billing') || '';
  if (!BILLING_RETURN_STATUSES.has(billing)) return;

  const target = new URL('tayartools://billing');
  target.searchParams.set('billing', billing);
  target.hash = 'workspace/subscription';

  try {
    window.location.replace(target.toString());
  } catch (error) {
    console.warn('[mobile-runtime] Could not hand billing return to the native app.', error);
  }
}

function handleAppUrl(rawValue: unknown): void {
  const raw = String(rawValue || '').trim();
  if (!raw || typeof window === 'undefined') return;

  const target = window as TayarMobileWindow;
  if (target.__TayarLastAppUrl === raw) return;
  target.__TayarLastAppUrl = raw;
  target.__TayarPendingAppUrl = raw;

  try {
    const url = new URL(raw);
    const isTayarWeb = (url.protocol === 'https:' || url.protocol === 'http:') &&
      (url.hostname === 'tayar.se' || url.hostname === 'www.tayar.se');
    const isTayarScheme = url.protocol === 'tayartools:';
    if (!isTayarWeb && !isTayarScheme) return;

    void closeNativeBrowser();

    const isAuthCallback = isTayarScheme && url.hostname === 'auth';
    if (!isAuthCallback) {
      const nextPath = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextPath) {
        window.history.pushState({}, '', nextPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }

    window.dispatchEvent(new CustomEvent('tayar:app-url-open', { detail: { url: raw } }));
  } catch {
    // Ignore malformed external URLs.
  }
}

export function initMobileRuntime(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const capacitor = (window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: Record<string, any>;
    };
  }).Capacitor;

  const native = Boolean(capacitor?.isNativePlatform?.());
  if (!native) {
    handoffNativeBillingReturn();
    return;
  }

  const platform = capacitor?.getPlatform?.() || 'native';
  document.documentElement.classList.add('tayar-native', `tayar-${platform}`);
  document.documentElement.dataset.tayarPlatform = platform;
  installNativeDownloadBridge();
  installNativeExternalLinkBridge();

  const appPlugin = capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;

  void appPlugin.addListener('backButton', (event: { canGoBack?: boolean }) => {
    if (event?.canGoBack) {
      window.history.back();
      return;
    }
    if (typeof appPlugin.exitApp === 'function') void appPlugin.exitApp();
  });

  void appPlugin.addListener('appUrlOpen', (event: { url?: string }) => {
    handleAppUrl(event?.url);
  });

  if (typeof appPlugin.getLaunchUrl === 'function') {
    void appPlugin.getLaunchUrl()
      .then((result: { url?: string } | null | undefined) => handleAppUrl(result?.url))
      .catch((error: unknown) => console.warn('[mobile-runtime] Could not read launch URL.', error));
  }
}
