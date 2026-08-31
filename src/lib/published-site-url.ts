function configuredOrigin(): string {
  const configured =
    String(import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_APP_URL || '').trim();

  const currentOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';

  if (configured) {
    try {
      const configuredUrl = new URL(configured);
      const configuredIsLocal =
        configuredUrl.hostname === 'localhost' ||
        configuredUrl.hostname === '127.0.0.1';

      if (currentOrigin) {
        const currentUrl = new URL(currentOrigin);
        const currentIsLocal =
          currentUrl.hostname === 'localhost' ||
          currentUrl.hostname === '127.0.0.1';

        // Never leak a template/local URL into a real published website.
        if (configuredIsLocal && !currentIsLocal) return currentUrl.origin;
      }

      return configuredUrl.origin;
    } catch {
      // Fall back to the current browser origin below.
    }
  }

  return currentOrigin;
}

function safeSegment(value: string): string {
  return encodeURIComponent(String(value || '').trim());
}

function safePath(value: string): string {
  return String(value || 'index.html')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildPublishedSiteBaseUrl(ownerId: string, projectId: string): string {
  const origin = configuredOrigin();
  if (!origin || !ownerId || !projectId) return '';
  return `${origin}/site/${safeSegment(ownerId)}/${safeSegment(projectId)}`;
}

export function buildPublishedSiteUrl(
  ownerId: string,
  projectId: string,
  file = 'index.html',
): string {
  const base = buildPublishedSiteBaseUrl(ownerId, projectId);
  if (!base) return '';
  return `${base}/${safePath(file)}`;
}

export function buildPreviewSiteBaseUrl(
  ownerId: string,
  projectId: string,
  token: string,
): string {
  const origin = configuredOrigin();
  if (!origin || !ownerId || !projectId || !token) return '';
  return `${origin}/preview/${safeSegment(ownerId)}/${safeSegment(projectId)}/${safeSegment(token)}`;
}

export function buildPreviewSiteUrl(
  ownerId: string,
  projectId: string,
  token: string,
  file = 'index.html',
): string {
  const base = buildPreviewSiteBaseUrl(ownerId, projectId, token);
  if (!base) return '';
  return `${base}/${safePath(file)}`;
}

export function normalizePublishedSiteUrl(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  if (url.pathname.startsWith('/site/') || url.pathname.startsWith('/preview/')) {
    return raw;
  }

  const marker = '/storage/v1/object/public/published-sites/';
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return raw;

  const storagePath = url.pathname.slice(markerIndex + marker.length);
  const parts = storagePath.split('/').filter(Boolean).map((part) => decodeURIComponent(part));

  const [ownerId, projectId, ...rest] = parts;
  if (!ownerId || !projectId) return raw;

  if (rest[0] === 'previews' && rest[1]) {
    const token = rest[1];
    const file = rest.slice(2).join('/') || 'index.html';
    return buildPreviewSiteUrl(ownerId, projectId, token, file) || raw;
  }

  // Archived versions are not public website URLs.
  if (rest[0] === 'versions') return raw;

  return buildPublishedSiteUrl(ownerId, projectId, rest.join('/') || 'index.html') || raw;
}
