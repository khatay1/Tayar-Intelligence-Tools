import { supabase } from '@/lib/supabase';
import {
  listAllPublishedSiteFiles,
  publishedSiteFilePaths,
  removePublishedSiteFiles,
} from '../core/editor-published-storage';

export interface PublishedWebsiteFile {
  name: string;
  content: string;
  contentType: string;
}

const publishedSiteStorage = supabase.storage.from('published-sites');

export async function uploadPublishedWebsiteFolderFiles(
  folder: string,
  files: PublishedWebsiteFile[],
): Promise<void> {
  for (const file of files) {
    const { error } = await publishedSiteStorage.upload(
      folder + '/' + file.name,
      new Blob([file.content], { type: file.contentType }),
      {
        upsert: true,
        contentType: file.contentType,
        cacheControl: '0',
      },
    );
    if (error) throw error;
  }
}

export async function replacePublishedWebsiteFiles(
  folder: string,
  files: PublishedWebsiteFile[],
): Promise<void> {
  let existing: Array<{ id?: string | null; name: string }>;

  try {
    existing = await listAllPublishedSiteFiles(publishedSiteStorage, folder);
  } catch (error) {
    throw new Error(
      'Published-sites storage is unavailable: ' +
      (error instanceof Error ? error.message : 'unknown storage error'),
    );
  }

  const liveNames = new Set(files.map((file) => file.name));
  const stalePaths = publishedSiteFilePaths(folder, existing, liveNames);
  await removePublishedSiteFiles(publishedSiteStorage, stalePaths);

  for (const file of files) {
    const blob = new Blob([file.content], { type: file.contentType });
    const { error: liveError } = await publishedSiteStorage.upload(
      folder + '/' + file.name,
      blob,
      {
        upsert: true,
        contentType: file.contentType,
        cacheControl: '0',
      },
    );

    if (liveError) {
      throw new Error(
        'Could not publish ' +
        file.name +
        ': ' +
        liveError.message,
      );
    }
  }

  const { data: verifiedIndex, error: verifyError } =
    await publishedSiteStorage.download(folder + '/index.html');

  if (verifyError || !verifiedIndex || verifiedIndex.size <= 0) {
    throw new Error(
      'Files were uploaded but the live index could not be verified' +
      (verifyError?.message ? ': ' + verifyError.message : '.'),
    );
  }
}

export async function removePublishedWebsiteFiles(folder: string): Promise<void> {
  const existing = await listAllPublishedSiteFiles(publishedSiteStorage, folder);
  const paths = publishedSiteFilePaths(folder, existing);
  await removePublishedSiteFiles(publishedSiteStorage, paths);
}
