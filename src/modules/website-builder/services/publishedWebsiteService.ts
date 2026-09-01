import { supabase } from '@/lib/supabase';
import {
  listAllPublishedSiteFiles,
  publishedSiteFilePaths,
  removePublishedSiteFiles,
} from '../core/editor-published-storage';
import {
  assertValidPublishedWebsiteBundle,
  isValidPublishedHtml,
} from '../core/published-site-validation';

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
  assertValidPublishedWebsiteBundle(files);

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
  assertValidPublishedWebsiteBundle(files);

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

  const verifiedHtml = await verifiedIndex.text();
  if (!isValidPublishedHtml(verifiedHtml)) {
    throw new Error('The uploaded index.html is not a valid HTML document.');
  }

  // Keep the previous live files in place until the new bundle is uploaded
  // and its index has been verified. Only then remove files that are no
  // longer part of the new release.
  await removePublishedSiteFiles(publishedSiteStorage, stalePaths);
}

export async function removePublishedWebsiteFiles(folder: string): Promise<void> {
  const existing = await listAllPublishedSiteFiles(publishedSiteStorage, folder);
  const paths = publishedSiteFilePaths(folder, existing);
  await removePublishedSiteFiles(publishedSiteStorage, paths);
}

export async function downloadPublishedWebsiteFile(path: string) {
  return publishedSiteStorage.download(path);
}

export async function removeStalePublishedWebsiteFiles(
  folder: string,
  liveNames: Set<string>,
): Promise<void> {
  const existing = await listAllPublishedSiteFiles(publishedSiteStorage, folder);
  const stalePaths = publishedSiteFilePaths(folder, existing, liveNames);
  await removePublishedSiteFiles(publishedSiteStorage, stalePaths);
}

export async function uploadPublishedWebsiteBlob(input: {
  path: string;
  body: Blob;
  contentType: string;
  cacheControl?: string;
  upsert?: boolean;
}) {
  return publishedSiteStorage.upload(input.path, input.body, {
    upsert: input.upsert ?? true,
    contentType: input.contentType,
    cacheControl: input.cacheControl ?? '0',
  });
}

export async function archivePublishedWebsiteFiles(
  prefix: string,
  files: PublishedWebsiteFile[],
): Promise<void> {
  assertValidPublishedWebsiteBundle(files);

  for (const file of files) {
    const { error } = await publishedSiteStorage.upload(
      prefix + '/' + file.name,
      new Blob([file.content], { type: file.contentType }),
      {
        upsert: false,
        contentType: file.contentType,
        cacheControl: '31536000',
      },
    );
    if (error) throw error;
  }
}
