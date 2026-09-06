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

export interface PublishedWebsiteSnapshot {
  files: ReadonlyMap<string, Blob>;
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
  rollbackSnapshot?: PublishedWebsiteSnapshot,
): Promise<void> {
  assertValidPublishedWebsiteBundle(files);

  const snapshot = rollbackSnapshot || await snapshotPublishedWebsiteFiles(folder);
  const previousFiles = snapshot.files;
  const existingNames = new Set(previousFiles.keys());
  const liveNames = new Set(files.map((file) => file.name));
  const stalePaths = [...existingNames]
    .filter((name) => !liveNames.has(name))
    .map((name) => folder + '/' + name);

  try {
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

    // Keep old live files until the new index passes verification.
    await removePublishedSiteFiles(publishedSiteStorage, stalePaths);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Published-site replacement failed.';
    try {
      await restorePublishedWebsiteSnapshot(folder, snapshot);
    } catch (rollbackError) {
      throw new Error(
        message +
        ' Automatic rollback was incomplete: ' +
        (rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error'),
      );
    }

    throw new Error(message + ' The previous live website was restored automatically.');
  }
}

export async function snapshotPublishedWebsiteFiles(
  folder: string,
): Promise<PublishedWebsiteSnapshot> {

  let existing: Array<{ id?: string | null; name: string }>;

  try {
    existing = await listAllPublishedSiteFiles(publishedSiteStorage, folder);
  } catch (error) {
    throw new Error(
      'Published-sites storage is unavailable: ' +
      (error instanceof Error ? error.message : 'unknown storage error'),
    );
  }

  const existingFiles = existing.filter(
    (item) => Boolean(item.id) && Boolean(item.name),
  );

  if (existingFiles.length > 250) {
    throw new Error(
      'Published-site folder contains too many live files to replace safely.',
    );
  }

  const previousFiles = new Map<string, Blob>();

  for (const item of existingFiles) {
    const path = folder + '/' + item.name;
    const { data, error } = await publishedSiteStorage.download(path);

    if (error || !data) {
      throw new Error(
        'Could not create a safe pre-publish backup for ' +
        item.name +
        (error?.message ? ': ' + error.message : '.'),
      );
    }

    previousFiles.set(item.name, data);
  }

  return { files: previousFiles };
}

export async function restorePublishedWebsiteSnapshot(
  folder: string,
  snapshot: PublishedWebsiteSnapshot,
): Promise<void> {
  const rollbackErrors: string[] = [];

  for (const [name, blob] of snapshot.files) {
    const { error } = await publishedSiteStorage.upload(folder + '/' + name, blob, {
      upsert: true,
      contentType: blob.type || undefined,
      cacheControl: '0',
    });
    if (error) rollbackErrors.push(name + ': ' + error.message);
  }

  try {
    const current = await listAllPublishedSiteFiles(publishedSiteStorage, folder);
    const stalePaths = publishedSiteFilePaths(folder, current, new Set(snapshot.files.keys()));
    await removePublishedSiteFiles(publishedSiteStorage, stalePaths);
  } catch (error) {
    rollbackErrors.push(error instanceof Error ? error.message : 'new files cleanup failed');
  }

  if (rollbackErrors.length) {
    throw new Error(rollbackErrors.join('; '));
  }
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
  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      const path = prefix + '/' + file.name;
      const { error } = await publishedSiteStorage.upload(
        path,
        new Blob([file.content], { type: file.contentType }),
        {
          upsert: false,
          contentType: file.contentType,
          cacheControl: '31536000',
        },
      );
      if (error) throw error;
      uploadedPaths.push(path);
    }
  } catch (error) {
    try {
      await removePublishedSiteFiles(publishedSiteStorage, uploadedPaths);
    } catch (cleanupError) {
      throw new Error(
        (error instanceof Error ? error.message : 'Release archive failed.') +
        ' Archive cleanup was incomplete: ' +
        (cleanupError instanceof Error ? cleanupError.message : 'unknown cleanup error'),
      );
    }
    throw error;
  }
}
