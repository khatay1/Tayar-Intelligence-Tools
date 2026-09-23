import type { EditorPublishPlan } from './editor-publishing';
import { createWebsitePublishSchedule } from '../services/publishScheduleService';
import { stageWebsiteRelease } from '../services/publishingWorkflowService';
import type { PublishedWebsiteFile } from '../services/publishedWebsiteService';

export interface PublishingMaxHandlerDeps {
  getProjectId: () => string | null;
  getOwnerId: () => string | null;
  getAllPageIds: () => string[];
  publishNow: () => Promise<unknown>;
  getReleaseFiles: (plan: EditorPublishPlan) => PublishedWebsiteFile[];
  onScheduled?: (scheduleId: string) => void;
  onStaged?: (folder: string) => void;
}

function createScheduleId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPublishingMaxHandler(deps: PublishingMaxHandlerDeps) {
  return async function applyPublishPlan(plan: EditorPublishPlan) {
    const projectId = deps.getProjectId();
    const ownerId = deps.getOwnerId();
    if (!projectId || !ownerId) throw new Error('Save the website project before using Publishing MAX.');

    if (plan.scheduledAt) {
      const scheduleId = createScheduleId();
      const { data, error } = await createWebsitePublishSchedule({
        id: scheduleId,
        projectId,
        ownerId,
        plan,
        allPageIds: deps.getAllPageIds(),
      });
      if (error) throw error;
      const savedScheduleId = String((data as { id?: string } | null)?.id || scheduleId);
      deps.onScheduled?.(savedScheduleId);
      return { kind: 'scheduled' as const, id: savedScheduleId };
    }

    if (plan.environment === 'staging') {
      const folder = await stageWebsiteRelease({
        projectId,
        ownerId,
        files: deps.getReleaseFiles(plan),
      });
      deps.onStaged?.(folder);
      return { kind: 'staged' as const, id: folder };
    }

    await deps.publishNow();
    return { kind: 'published' as const };
  };
}
