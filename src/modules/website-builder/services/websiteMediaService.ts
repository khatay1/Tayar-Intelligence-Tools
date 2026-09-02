import { supabase } from '@/lib/supabase';

const websiteMediaStorage = supabase.storage.from('website-media');

export async function listWebsiteMediaFiles(userId: string) {
  return websiteMediaStorage.list(userId, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });
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
