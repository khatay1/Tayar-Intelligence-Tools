import { installNativeDownloadBridge, installNativeExternalLinkBridge } from './mobile-files';

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
  if (!native) return;

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
    const raw = String(event?.url || '').trim();
    if (!raw) return;
    try {
      const url = new URL(raw);
      const isTayarWeb = (url.protocol === 'https:' || url.protocol === 'http:') &&
        (url.hostname === 'tayar.se' || url.hostname === 'www.tayar.se');
      const isTayarScheme = url.protocol === 'tayartools:';
      if (!isTayarWeb && !isTayarScheme) return;

      const nextPath = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextPath) return;
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new CustomEvent('tayar:app-url-open', { detail: { url: raw } }));
    } catch {
      // Ignore malformed external URLs.
    }
  });
}
