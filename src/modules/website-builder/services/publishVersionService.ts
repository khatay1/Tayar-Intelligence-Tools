import { supabase } from '@/lib/supabase';

export interface PublishVersionManifestItem {
  name: string;
  contentType: string;
}

export interface WebsitePublishVersionArchiveTarget {
  versionId: string;
  projectId: string;
  ownerId: string;
  storagePrefix: string;
  fileManifest: PublishVersionManifestItem[];
}

function websitePublishVersionArchivePaths(input: WebsitePublishVersionArchiveTarget) {
  return input.fileManifest.map(
    (item) => `${input.storagePrefix}/${item.name}`,
  );
}

async function removeWebsitePublishVersionArchiveFiles(input: WebsitePublishVersionArchiveTarget) {
  const paths = websitePublishVersionArchivePaths(input);
  if (!paths.length) return { error: null };

  return supabase.storage
    .from('published-sites')
    .remove(paths);
}

export async function listWebsitePublishVersions(
  projectId: string,
  ownerId: string,
) {
  return supabase
    .from('website_publish_versions')
    .select('id, project_id, user_id, release_note, published_url, storage_prefix, editor_fingerprint, snapshot, file_manifest, created_at')
    .eq('project_id', projectId)
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(30);
}

export async function deleteWebsitePublishVersionArchive(input: WebsitePublishVersionArchiveTarget) {
  // Delete the visible database record first. If that fails, keep its files so
  // the release never points at a missing archive.
  const { data, error: deleteError } = await supabase
    .from('website_publish_versions')
    .delete()
    .eq('id', input.versionId)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .select('id');

  if (deleteError) return { error: deleteError, recordDeleted: false };
  if (!data?.length) {
    return {
      error: new Error('Stored release archive was not found or cannot be deleted.'),
      recordDeleted: false,
    };
  }

  const { error: removeError } = await removeWebsitePublishVersionArchiveFiles(input);
  return {
    error: removeError
      ? new Error(`Release record was deleted, but archived files need cleanup: ${removeError.message}`)
      : null,
    recordDeleted: true,
  };
}

export async function discardWebsitePublishVersionArchive(input: WebsitePublishVersionArchiveTarget) {
  // Compensation may run before or after the version row was inserted. A
  // no-match delete is therefore expected; storage cleanup must still proceed.
  const { error: deleteError } = await supabase
    .from('website_publish_versions')
    .delete()
    .eq('id', input.versionId)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);

  if (deleteError) return { error: deleteError };

  return removeWebsitePublishVersionArchiveFiles(input);
}

export async function createWebsitePublishVersion(input: {
  id: string;
  projectId: string;
  ownerId: string;
  releaseNote: string;
  publishedUrl: string;
  storagePrefix: string;
  editorFingerprint: string;
  snapshot: Record<string, unknown>;
  fileManifest: PublishVersionManifestItem[];
}) {
  return supabase
    .from('website_publish_versions')
    .insert({
      id: input.id,
      project_id: input.projectId,
      user_id: input.ownerId,
      release_note: input.releaseNote,
      published_url: input.publishedUrl,
      storage_prefix: input.storagePrefix,
      editor_fingerprint: input.editorFingerprint,
      snapshot: input.snapshot,
      file_manifest: input.fileManifest,
    });
}
