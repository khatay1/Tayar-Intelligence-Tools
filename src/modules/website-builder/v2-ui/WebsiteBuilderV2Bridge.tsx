import { useAuth } from '@/context/AuthContext';
import { loadActiveWebsiteProjectId } from '../core/editor-project-lifecycle';
import type { EditorPublishPlan } from '../core/editor-publishing';
import { createWebsitePublishSchedule } from '../services/publishScheduleService';
import WebsiteBuilderV2BridgeBase, { type WebsiteBuilderV2BridgeProps } from './WebsiteBuilderV2BridgeBase';

function createScheduleId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error('Secure publishing requires a browser with crypto.randomUUID support.');
  return uuid;
}

export type { WebsiteBuilderV2BridgeProps } from './WebsiteBuilderV2BridgeBase';

export function WebsiteBuilderV2Bridge(props: WebsiteBuilderV2BridgeProps) {
  const { user } = useAuth();

  const handlePublishPlan = async (plan: EditorPublishPlan) => {
    if (props.onPublishPlan) {
      await props.onPublishPlan(plan);
      return;
    }

    if (plan.mode === 'selective') {
      throw new Error('Selected-page publishing is not available yet. Choose Full site to publish all pages.');
    }

    if (plan.scheduledAt) {
      const projectId = loadActiveWebsiteProjectId();
      if (!projectId || !user?.id) {
        throw new Error('Save this project to the cloud before scheduling a publish.');
      }
      const { error } = await createWebsitePublishSchedule({
        id: createScheduleId(),
        projectId,
        ownerId: user.id,
        plan,
        allPageIds: props.pages.map((page) => page.id),
      });
      if (error) throw error;
      return;
    }

    if (plan.environment === 'staging') {
      await Promise.resolve(props.onPreview());
      return;
    }

    await Promise.resolve(props.onPublish());
  };

  return <WebsiteBuilderV2BridgeBase {...props} onPublishPlan={handlePublishPlan} />;
}

export default WebsiteBuilderV2Bridge;
