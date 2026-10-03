import { supabase } from '@/lib/supabase';
import { collectWebsiteFormDefinitions } from '../core/website-forms';
import type { WebsitePage } from '../core/website-builder-model';
import { normalizeEditorPublishPlan, validateEditorPublishPlan, type EditorPublishPlan } from '../core/editor-publishing';
import { archivePublishedWebsiteFiles, readPublishedWebsiteFolderFiles } from './publishedWebsiteService';
import { discardWebsitePublishVersionArchive, type PublishVersionManifestItem } from './publishVersionService';
import type { WebsiteSharePreviewArtifact } from '../core/editor-share-preview-handler';

export type WebsitePublishScheduleStatus = 'scheduled' | 'processing' | 'published' | 'failed' | 'cancelled';

export interface WebsitePublishSchedule {
  id: string;
  projectId: string;
  ownerId: string;
  plan: EditorPublishPlan;
  status: WebsitePublishScheduleStatus;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

function scheduleArchivePrefix(ownerId: string, projectId: string, scheduleId: string) {
  return `${ownerId}/${projectId}/versions/${scheduleId}`;
}

function validArtifact(input: {
  projectId: string;
  ownerId: string;
  artifact?: WebsiteSharePreviewArtifact;
}) {
  const artifact = input.artifact;
  if (!artifact || !/^[A-Za-z0-9_-]{8,160}$/.test(artifact.previewToken)) return false;
  if (artifact.releasePrefix !== `${input.ownerId}/${input.projectId}/previews/${artifact.previewToken}/release`) return false;
  if (!artifact.editorFingerprint || artifact.editorFingerprint.length > 2_000_000) return false;
  if (!Number.isFinite(Date.parse(artifact.projectUpdatedAt))) return false;
  try {
    const url = new URL(artifact.publishedUrl);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && artifact.publishedUrl.length <= 2048;
  } catch {
    return false;
  }
}

export async function listWebsitePublishSchedules(projectId: string, ownerId: string) {
  return supabase
    .from('website_publish_schedules')
    .select('id, project_id, user_id, environment, mode, page_ids, scheduled_at, release_note, status, last_error, release_storage_prefix, editor_fingerprint, expected_project_updated_at, published_url, claimed_at, completed_at, attempt_count, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', ownerId)
    .order('scheduled_at', { ascending: true });
}

export async function createWebsitePublishSchedule(input: {
  id: string;
  projectId: string;
  ownerId: string;
  plan: Partial<EditorPublishPlan>;
  allPageIds: string[];
  pages?: WebsitePage[];
  artifact?: WebsiteSharePreviewArtifact;
}) {
  const plan = normalizeEditorPublishPlan(input.plan, input.allPageIds);
  const errors = validateEditorPublishPlan(plan);
  if (!plan.scheduledAt) errors.push('Scheduled publishing requires a future date and time.');
  if (plan.environment !== 'production' || plan.mode !== 'full') errors.push('Scheduled publishing currently supports full production releases only.');
  if (!validArtifact(input)) errors.push('Create a fresh staging snapshot before scheduling this release.');
  if (!Array.isArray(input.pages)) errors.push('Scheduled publishing requires the current page snapshot.');
  if (errors.length) return { data: null, error: new Error(errors.join(' ')) };

  const readinessError = await checkWebsitePublishSchedulerReadiness();
  if (readinessError) return { data: null, error: readinessError };

  const artifact = input.artifact!;
  const files = await readPublishedWebsiteFolderFiles(artifact.releasePrefix);
  const releaseStoragePrefix = scheduleArchivePrefix(input.ownerId, input.projectId, input.id);
  const manifest: PublishVersionManifestItem[] = files.map((file) => ({
    name: file.name,
    contentType: file.contentType,
  }));
  const formDefinitions = collectWebsiteFormDefinitions(input.pages!);
  if (formDefinitions.length > 100) {
    return { data: null, error: new Error('Scheduled publishing supports at most 100 forms.') };
  }

  try {
    await archivePublishedWebsiteFiles(releaseStoragePrefix, files);
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Scheduled release snapshot could not be archived.') };
  }

  const result = await supabase.from('website_publish_schedules').insert({
    id: input.id,
    project_id: input.projectId,
    user_id: input.ownerId,
    environment: plan.environment,
    mode: plan.mode,
    page_ids: plan.pageIds,
    scheduled_at: new Date(plan.scheduledAt!).toISOString(),
    release_note: plan.releaseNote,
    status: 'scheduled',
    release_storage_prefix: releaseStoragePrefix,
    release_manifest: manifest,
    editor_fingerprint: artifact.editorFingerprint,
    expected_project_updated_at: artifact.projectUpdatedAt,
    published_url: artifact.publishedUrl,
    form_definitions: formDefinitions,
  }).select('id').single();

  if (result.error || !result.data) {
    const cleanup = await discardWebsitePublishVersionArchive({
      versionId: input.id,
      projectId: input.projectId,
      ownerId: input.ownerId,
      storagePrefix: releaseStoragePrefix,
      fileManifest: manifest,
    });
    if (cleanup.error) {
      return {
        data: null,
        error: new Error(`${result.error?.message || 'Scheduled release could not be saved.'} Snapshot cleanup needs support review.`),
      };
    }
  }

  return result;
}

export async function cancelWebsitePublishSchedule(input: { id: string; projectId: string; ownerId: string }) {
  const cancelled = await supabase
    .from('website_publish_schedules')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .eq('status', 'scheduled')
    .select('id, release_storage_prefix, release_manifest')
    .single();

  if (cancelled.error || !cancelled.data) return cancelled;

  const manifest = Array.isArray(cancelled.data.release_manifest)
    ? cancelled.data.release_manifest as PublishVersionManifestItem[]
    : [];
  const expectedPrefix = scheduleArchivePrefix(input.ownerId, input.projectId, input.id);
  if (cancelled.data.release_storage_prefix === expectedPrefix && manifest.length) {
    const cleanup = await discardWebsitePublishVersionArchive({
      versionId: input.id,
      projectId: input.projectId,
      ownerId: input.ownerId,
      storagePrefix: expectedPrefix,
      fileManifest: manifest,
    });
    if (cleanup.error) {
      return { data: cancelled.data, error: new Error(`Schedule cancelled, but snapshot cleanup needs support review: ${cleanup.error.message}`) };
    }
  }

  return { data: cancelled.data, error: null };
}

export async function rescheduleWebsitePublish(input: {
  id: string;
  projectId: string;
  ownerId: string;
  scheduledAt: string;
}) {
  const timestamp = Date.parse(input.scheduledAt);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return { data: null, error: new Error('Scheduled publish time must be in the future.') };
  const readinessError = await checkWebsitePublishSchedulerReadiness();
  if (readinessError) return { data: null, error: readinessError };
  return supabase
    .from('website_publish_schedules')
    .update({ scheduled_at: new Date(timestamp).toISOString(), status: 'scheduled', last_error: null, claimed_at: null, completed_at: null, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .in('status', ['scheduled', 'failed'])
    .select('id')
    .single();
}

export async function checkWebsitePublishSchedulerReadiness(): Promise<Error | null> {
  const { data: ready, error: readinessError } = await supabase.rpc('website_publish_scheduler_ready');
  if (readinessError || ready !== true) return new Error('Scheduled publishing is unavailable until its executor is configured.');
  const { data: status, error: functionError } = await supabase.functions.invoke('website-publish-scheduler', { body: { action: 'status' } });
  if (functionError || status?.ready !== true) return new Error('Scheduled publishing is unavailable until its executor is configured.');
  return null;
}
