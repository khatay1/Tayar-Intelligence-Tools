import type { EditorPublishPlan } from './editor-publishing';
import { createWebsitePublishSchedule } from '../services/publishScheduleService';
import { stageWebsiteRelease } from '../services/publishingWorkflowService';

export interface PublishingMaxHandlerDeps {
  getProjectId: () => string | null;
  getOwnerId: () => string | null;
  publishNow: () => Promise<unknown>;
  getReleaseSnapshot: () => Record<string, unknown>;
  onScheduled?: (scheduleId: string) => void;
  onStaged?: (releaseId: string) => void;
}

export function createPublishingMaxHandler(deps: PublishingMaxHandlerDeps) {
  return async function applyPublishPlan(plan: EditorPublishPlan) {
    const projectId = deps.getProjectId();
    const ownerId = deps.getOwnerId();
    if (!projectId || !ownerId) throw new Error('Save the website project before using Publishing MAX.');

    if (plan.mode === 'scheduled') {
      if (!plan.scheduledFor) throw new Error('Choose a publish date and time.');
      const { data, error } = await createWebsitePublishSchedule({
        projectId,
        ownerId,
        scheduledFor: plan.scheduledFor,
        payload: {
          environment: plan.environment,
          scope: plan.scope,
          pageIds: plan.pageIds,
          snapshot: deps.getReleaseSnapshot(),
        },
      });
      if (error) throw error;
      const scheduleId = String((data as { id?: string } | null)?.id || '');
      if (scheduleId) deps.onScheduled?.(scheduleId);
      return { kind: 'scheduled' as const, id: scheduleId };
    }

    if (plan.environment === 'staging') {
      const { data, error } = await stageWebsiteRelease({
        projectId,
        ownerId,
        snapshot: deps.getReleaseSnapshot(),
      });
      if (error) throw error;
      const releaseId = String((data as { id?: string } | null)?.id || '');
      if (releaseId) deps.onStaged?.(releaseId);
      return { kind: 'staged' as const, id: releaseId };
    }

    await deps.publishNow();
    return { kind: 'published' as const };
  };
}
