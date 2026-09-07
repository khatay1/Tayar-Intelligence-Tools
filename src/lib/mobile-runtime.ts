export function initMobileRuntime(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;

  const native = Boolean(capacitor?.isNativePlatform?.());
  if (!native) return;

  const platform = capacitor?.getPlatform?.() || 'native';
  document.documentElement.classList.add('tayar-native', `tayar-${platform}`);
  document.documentElement.dataset.tayarPlatform = platform;
}
