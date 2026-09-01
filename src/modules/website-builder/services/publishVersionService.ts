import { supabase } from '@/lib/supabase';

export interface PublishVersionManifestItem {
  name: string;
  contentType: string;
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

export async function deleteWebsitePublishVersionArchive(input: {
  versionId: string;
  projectId: string;
  ownerId: string;
  storagePrefix: string;
  fileManifest: PublishVersionManifestItem[];
}) {
  const paths = input.fileManifest.map(
    (item) => `${input.storagePrefix}/${item.name}`,
  );

  if (paths.length) {
    const { error: removeError } = await supabase.storage
      .from('published-sites')
      .remove(paths);
    if (removeError) return { error: removeError };
  }

  const { error } = await supabase
    .from('website_publish_versions')
    .delete()
    .eq('id', input.versionId)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);

  return { error };
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
