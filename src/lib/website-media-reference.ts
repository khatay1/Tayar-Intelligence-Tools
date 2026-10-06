export const WEBSITE_MEDIA_ORIGIN = 'https://www.tayar.se';
export const WEBSITE_STORAGE_ORIGIN = 'https://pnbllxdlskljcakyaylt.supabase.co';
const ownerPath = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-zA-Z0-9._/-]+$/;

export function validWebsiteMediaPath(path: string): boolean {
  return path.length <= 1024 && ownerPath.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..');
}

export function websiteMediaUrl(path: string): string {
  if (!validWebsiteMediaPath(path)) throw new Error('Invalid website media path');
  return `${WEBSITE_MEDIA_ORIGIN}/api/website-media?path=${encodeURIComponent(path)}`;
}

export function websiteMediaPath(value: string): string | null {
  try {
    const url = new URL(value, WEBSITE_MEDIA_ORIGIN);
    if (url.username || url.password || url.hash) return null;
    let path: string | null = null;
    if (url.origin === WEBSITE_MEDIA_ORIGIN && url.pathname === '/api/website-media'
      && [...url.searchParams.keys()].every(key => key === 'path') && url.searchParams.getAll('path').length === 1) {
      path = url.searchParams.get('path');
    } else if (url.origin === WEBSITE_STORAGE_ORIGIN && !url.search && url.pathname.startsWith('/storage/v1/object/public/website-media/')) {
      path = decodeURIComponent(url.pathname.slice('/storage/v1/object/public/website-media/'.length));
    }
    return path && validWebsiteMediaPath(path) ? path : null;
  } catch { return null; }
}

// Work on URL tokens, including URLs embedded in custom HTML/CSS. Never adopt
// another Supabase project's URLs or signed URLs with credentials.
export const websiteMediaTokens = (text: string): string[] => [...new Set(text.match(/https:\/\/[^\s"'<>\\)]+|\/api\/website-media\?path=[a-zA-Z0-9%._-]+/g) || [])]
  .filter(value => websiteMediaPath(value) !== null);

export function normalizeWebsiteMediaReferences<T>(value: T): T {
  if (typeof value === 'string') {
    let text: string = value;
    for (const token of websiteMediaTokens(text)) text = text.split(token).join(websiteMediaUrl(websiteMediaPath(token)!));
    return text as T;
  }
  if (Array.isArray(value)) return value.map(normalizeWebsiteMediaReferences) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeWebsiteMediaReferences(child)])) as T;
  return value;
}
