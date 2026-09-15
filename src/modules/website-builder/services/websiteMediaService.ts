import { supabase } from '@/lib/supabase';

const websiteMediaStorage = supabase.storage.from('website-media');
const MEDIA_PAGE_SIZE = 100;
const MEDIA_MAX_FILES = 1_000;

type WebsiteMediaListResult = Awaited<ReturnType<typeof websiteMediaStorage.list>>;
type WebsiteMediaListItem = NonNullable<WebsiteMediaListResult['data']>[number];

export async function listWebsiteMediaFiles(userId: string) {
  const files: WebsiteMediaListItem[] = [];

  for (let offset = 0; offset < MEDIA_MAX_FILES; offset += MEDIA_PAGE_SIZE) {
    const result = await websiteMediaStorage.list(userId, {
      limit: MEDIA_PAGE_SIZE,
      offset,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (result.error) return result;

    const page = result.data || [];
    files.push(...page);
    if (page.length < MEDIA_PAGE_SIZE) break;
  }

  return { data: files, error: null };
}

export function getWebsiteMediaPublicUrl(path: string): string {
  return websiteMediaStorage.getPublicUrl(path).data.publicUrl;
}

export async function uploadWebsiteMediaFile(
  path: string,
  file: File,
) {
  return websiteMediaStorage.upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
}

export async function deleteWebsiteMediaFile(path: string) {
  return websiteMediaStorage.remove([path]);
}
