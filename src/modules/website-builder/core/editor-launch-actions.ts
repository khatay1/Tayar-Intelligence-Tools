import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { CloudWebsiteProject } from './website-builder-model';

interface LaunchActionsContext {
  user: { id: string } | null;
  cloudProjectId: string | null;
  activeProjectOwnerId: string;
  publishedUrl: string;
  cloudProjects: CloudWebsiteProject[];
  projectLoadSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  setLaunchManualChecks: Dispatch<SetStateAction<Record<'stripe' | 'domain' | 'support', boolean>>>;
  setLaunchCenterOpen: Dispatch<SetStateAction<boolean>>;
  setLaunchCheckBusy: Dispatch<SetStateAction<boolean>>;
  setLaunchLastCheckedAt: Dispatch<SetStateAction<string | null>>;
  refreshBilling: (projectId?: string | null, loadSequence?: number) => Promise<unknown>;
  refreshProjectTeamAccess: (projectId: string | null, loadSequence?: number) => Promise<unknown>;
  verifyLiveDeployment: (projectId?: string | null, ownerId?: string, loadSequence?: number) => Promise<boolean>;
  recoverPublishedProjectState: (project: CloudWebsiteProject, loadSequence?: number) => Promise<unknown>;
  manualChecksKey: string;
  launchCenterSeenKey: string;
}

export function createLaunchActions({
  user, cloudProjectId, activeProjectOwnerId, publishedUrl, cloudProjects,
  projectLoadSequenceRef, activeUserIdRef, setLaunchManualChecks,
  setLaunchCenterOpen, setLaunchCheckBusy, setLaunchLastCheckedAt,
  refreshBilling, refreshProjectTeamAccess, verifyLiveDeployment,
  recoverPublishedProjectState, manualChecksKey, launchCenterSeenKey,
}: LaunchActionsContext) {
  function setLaunchManualCheck(key: 'stripe' | 'domain' | 'support', checked: boolean) {
    setLaunchManualChecks((current) => {
      const next = { ...current, [key]: checked };
      try { localStorage.setItem(manualChecksKey, JSON.stringify(next)); } catch { /* browser storage may be unavailable */ }
      return next;
    });
  }

  function closeLaunchCenter() {
    setLaunchCenterOpen(false);
    try { localStorage.setItem(launchCenterSeenKey, '1'); } catch { /* browser storage may be unavailable */ }
  }

  async function runV1LaunchChecks() {
    const launchLoadSequence = projectLoadSequenceRef.current;
    const launchProjectId = cloudProjectId;
    const launchOwnerId = activeProjectOwnerId;
    const launchUserId = user?.id ?? null;
    const launchIsCurrent = () =>
      projectLoadSequenceRef.current === launchLoadSequence &&
      activeUserIdRef.current === launchUserId;

    setLaunchCheckBusy(true);
    try {
      if (user) await refreshBilling(launchProjectId);
      if (!launchIsCurrent()) return;

      if (user && launchProjectId) {
        await refreshProjectTeamAccess(launchProjectId, launchLoadSequence);
        if (!launchIsCurrent()) return;

        if (publishedUrl) {
          await verifyLiveDeployment(
            launchProjectId,
            launchOwnerId,
            launchLoadSequence,
          );
        } else {
          const project = cloudProjects.find((item) => item.id === launchProjectId);
          if (project) await recoverPublishedProjectState(project, launchLoadSequence);
        }
      }

      if (launchIsCurrent()) {
        setLaunchLastCheckedAt(new Date().toISOString());
      }
    } finally {
      if (launchIsCurrent()) {
        setLaunchCheckBusy(false);
      }
    }
  }

  return { setLaunchManualCheck, closeLaunchCenter, runV1LaunchChecks };
}
