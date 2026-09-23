import { normalizePublishedSiteUrl } from '@/lib/published-site-url';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import { saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import type { CloudWebsiteProject,LiveVerification } from '../core/website-builder-model';
import { updateWebsiteProjectPublicationState } from '../services/projectCloudService';
import { downloadPublishedWebsiteFile,verifyPublishedRoute } from '../services/publishedWebsiteService';

interface createRecoverPublishedStateHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  cloudRevisionRef: React.MutableRefObject<{ projectId: string; updatedAt: string | null; } | null>;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  publicWebsiteUrl: (projectId: string, ownerId?: string) => string;
  setCloudProjects: React.Dispatch<React.SetStateAction<CloudWebsiteProject[]>>;
  setLiveVerification: React.Dispatch<React.SetStateAction<LiveVerification>>;
  setPublishedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string>>;
  user: User | null;
}

export function createRecoverPublishedStateHandler({
  activeUserIdRef,
  cloudRevisionRef,
  projectLoadSequenceRef,
  publicWebsiteUrl,
  setCloudProjects,
  setLiveVerification,
  setPublishedAt,
  setPublishedUrl,
  user,
}: createRecoverPublishedStateHandlerDependencies) {
  return async function recoverPublishedProjectState(project: CloudWebsiteProject, expectedLoadSequence?: number) {
    const recoveryUserId = user?.id ?? null;
    if (!recoveryUserId) return false;

    const loadIsCurrent = () =>
      (expectedLoadSequence === undefined ||
        projectLoadSequenceRef.current === expectedLoadSequence) &&
      activeUserIdRef.current === recoveryUserId;

    if (!loadIsCurrent()) return false;

    const ownerId = project.user_id || recoveryUserId;
    const path = `${ownerId}/${project.id}/index.html`;
    const { data, error } = await downloadPublishedWebsiteFile(path);

    if (!loadIsCurrent()) return false;

    const storedUrl =
      typeof project.content?.publishedUrl === 'string'
        ? project.content.publishedUrl
        : '';

    if (error || !data || data.size <= 0) {
      setLiveVerification(storedUrl ? 'failed' : 'idle');
      return false;
    }

    const canonicalStoredUrl = normalizePublishedSiteUrl(storedUrl);
    const recoveredUrl = publicWebsiteUrl(project.id, ownerId) || canonicalStoredUrl;
    const recoveredAt =
      typeof project.content?.publishedAt === 'string'
        ? project.content.publishedAt
        : project.updated_at || new Date().toISOString();

    if (!recoveredUrl) {
      setLiveVerification('failed');
      return false;
    }

    const routeHealthy = await verifyPublishedRoute(recoveredUrl);

    if (!loadIsCurrent()) return false;

    setPublishedUrl(recoveredUrl);
    setPublishedAt(recoveredAt);
    setLiveVerification(routeHealthy ? 'healthy' : 'failed');

    if (project.user_id === recoveryUserId && routeHealthy && (!storedUrl || storedUrl !== recoveredUrl || project.status !== 'completed')) {
      const recoveredContent = {
        ...project.content,
        publishedUrl: recoveredUrl,
        publishedAt: recoveredAt,
        updatedAt: new Date().toISOString(),
      };

      const recoverUpdatedAt = new Date().toISOString();
      const { data: recoveredRow, error: recoverError } = await updateWebsiteProjectPublicationState({
        projectId: project.id,
        userId: recoveryUserId,
        content: recoveredContent,
        published: true,
        updatedAt: recoverUpdatedAt,
        expectedUpdatedAt: project.updated_at,
      });

      if (!recoverError && loadIsCurrent()) {
        cloudRevisionRef.current = { projectId: project.id, updatedAt: recoveredRow?.updated_at || recoverUpdatedAt };
        setCloudProjects((current) =>
          current.map((item) =>
            item.id === project.id
              ? { ...item, content: recoveredContent, status: 'completed', updated_at: recoveredRow?.updated_at || recoverUpdatedAt }
              : item
          )
        );
        saveLocalWebsiteProject({
          ...recoveredContent,
          cloudProjectId: project.id,
        });
      }
    }

    return routeHealthy;
  };
}
