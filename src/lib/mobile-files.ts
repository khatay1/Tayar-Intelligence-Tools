type NativePlugin = Record<string, (...args: any[]) => Promise<any>>;

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, NativePlugin | undefined>;
};

type TayarAnchorPrototype = typeof HTMLAnchorElement.prototype & {
  __tayarDownloadPatched?: boolean;
};

function capacitorGlobal(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as typeof window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isTayarNativeApp(): boolean {
  return Boolean(capacitorGlobal()?.isNativePlatform?.());
}

function nativePlugin(name: string): NativePlugin | undefined {
  return capacitorGlobal()?.Plugins?.[name];
}

function safeFilename(value: string): string {
  const cleaned = String(value || 'tayar-export')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'tayar-export';
}

function filenameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, window.location.href);
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    return safeFilename(last || 'tayar-export');
  } catch {
    return 'tayar-export';
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not prepare this file for saving.'));
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) {
        reject(new Error('Could not prepare this file for saving.'));
        return;
      }
      resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function tryWebShare(blob: Blob, filename: string, title?: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported';
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  try {
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return 'unsupported';
    await navigator.share({ files: [file], title: title || filename });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

async function shareNativeUri(uri: string, filename: string, title?: string): Promise<boolean> {
  const share = nativePlugin('Share');
  if (!share?.share) return false;
  await share.share({
    title: title || filename,
    dialogTitle: title || 'Save or share file',
    files: [uri],
  });
  return true;
}

async function writeBlobToNativeCache(blob: Blob, filename: string): Promise<string | null> {
  const filesystem = nativePlugin('Filesystem');
  if (!filesystem?.writeFile) return null;
  const path = `tayar-exports/${Date.now()}-${safeFilename(filename)}`;
  const result = await filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: 'CACHE',
    recursive: true,
  });
  return typeof result?.uri === 'string' ? result.uri : null;
}

async function downloadRemoteToNativeCache(url: string, filename: string): Promise<string | null> {
  const filesystem = nativePlugin('Filesystem');
  if (!filesystem?.downloadFile || !filesystem?.getUri || !/^https?:/i.test(url)) return null;
  const path = `tayar-exports/${Date.now()}-${safeFilename(filename)}`;
  await filesystem.downloadFile({
    url,
    path,
    directory: 'CACHE',
    recursive: true,
  });
  const result = await filesystem.getUri({ path, directory: 'CACHE' });
  return typeof result?.uri === 'string' ? result.uri : null;
}

export async function saveOrShareBlob(blob: Blob, filename: string, title?: string): Promise<boolean> {
  if (!isTayarNativeApp()) return false;
  const safeName = safeFilename(filename);

  const webShare = await tryWebShare(blob, safeName, title);
  if (webShare === 'shared' || webShare === 'cancelled') return true;

  const uri = await writeBlobToNativeCache(blob, safeName);
  if (!uri) return false;
  return await shareNativeUri(uri, safeName, title);
}

export async function saveOrShareUrl(rawUrl: string, filename?: string, title?: string): Promise<boolean> {
  if (!isTayarNativeApp()) return false;
  const safeName = safeFilename(filename || filenameFromUrl(rawUrl));

  if (/^https?:/i.test(rawUrl)) {
    try {
      const uri = await downloadRemoteToNativeCache(rawUrl, safeName);
      if (uri && await shareNativeUri(uri, safeName, title)) return true;
    } catch {
      // Fall through to fetch/blob handling below.
    }
  }

  const response = await fetch(rawUrl);
  if (!response.ok) throw new Error(`Could not prepare file (${response.status}).`);
  return await saveOrShareBlob(await response.blob(), safeName, title);
}

export function installNativeDownloadBridge(): void {
  if (!isTayarNativeApp() || typeof HTMLAnchorElement === 'undefined') return;
  const proto = HTMLAnchorElement.prototype as TayarAnchorPrototype;
  if (proto.__tayarDownloadPatched) return;

  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedTayarAnchorClick(this: HTMLAnchorElement) {
    const filename = this.download?.trim();
    const href = this.href?.trim();
    if (!filename || !href) {
      originalClick.call(this);
      return;
    }

    void saveOrShareUrl(href, filename, filename)
      .then((handled) => {
        if (!handled) originalClick.call(this);
      })
      .catch((error) => {
        console.warn('[mobile-files] Native save/share failed; falling back to WebView download.', error);
        originalClick.call(this);
      });
  };

  proto.__tayarDownloadPatched = true;
}

export function installNativeExternalLinkBridge(): void {
  if (!isTayarNativeApp() || typeof document === 'undefined') return;
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(target instanceof HTMLAnchorElement) || target.download) return;

    let url: URL;
    try {
      url = new URL(target.href, window.location.href);
    } catch {
      return;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    const isTayar = url.hostname === 'tayar.se' || url.hostname === 'www.tayar.se';
    if (isTayar) return;

    const browser = nativePlugin('Browser');
    if (!browser?.open) return;
    event.preventDefault();
    void browser.open({ url: url.toString() }).catch((error) => {
      console.warn('[mobile-links] Could not open native browser.', error);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    });
  }, true);
}
