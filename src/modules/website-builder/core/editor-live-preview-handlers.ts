import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { downloadPublishedWebsiteFile, removePublishedWebsiteFiles, verifyPublishedRoute } from '../services/publishedWebsiteService';
import type { LiveVerification } from './website-builder-model';

interface LivePreviewContext {
  user: { id: string } | null;
  cloudProjectId: string | null;
  activeProjectOwnerId: string;
  projectLoadSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  liveVerificationSequenceRef: MutableRefObject<number>;
  previewOperationSequenceRef: MutableRefObject<number>;
  previewToken: string;
  publishBusy: boolean;
  previewBusy: boolean;
  setLiveVerification: Dispatch<SetStateAction<LiveVerification>>;
  setPublishError: Dispatch<SetStateAction<string>>;
  setPreviewBusy: Dispatch<SetStateAction<boolean>>;
  setPreviewError: Dispatch<SetStateAction<string>>;
  setPreviewUrl: Dispatch<SetStateAction<string>>;
  setPreviewToken: Dispatch<SetStateAction<string>>;
  setPreviewCreatedAt: Dispatch<SetStateAction<string | null>>;
  setPreviewFingerprint: Dispatch<SetStateAction<string>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  publicWebsiteUrl: (projectId: string, ownerId?: string) => string;
}

export function createLivePreviewHandlers({
  user, cloudProjectId, activeProjectOwnerId, projectLoadSequenceRef,
  activeUserIdRef, liveVerificationSequenceRef, previewOperationSequenceRef,
  previewToken, publishBusy, previewBusy, setLiveVerification, setPublishError,
  setPreviewBusy, setPreviewError, setPreviewUrl, setPreviewToken,
  setPreviewCreatedAt, setPreviewFingerprint, setSaved, publicWebsiteUrl,
}: LivePreviewContext) {
  async function verifyLiveDeployment(
    expectedProjectId: string | null = cloudProjectId,
    expectedOwnerId = activeProjectOwnerId,
    expectedLoadSequence = projectLoadSequenceRef.current,
  ) {
    const verificationSequence = ++liveVerificationSequenceRef.current;
    const verificationUserId = user?.id ?? null;
    const verificationIsCurrent = () =>
      liveVerificationSequenceRef.current === verificationSequence &&
      projectLoadSequenceRef.current === expectedLoadSequence &&
      activeUserIdRef.current === verificationUserId;

    if (!verificationIsCurrent()) return false;

    if (!verificationUserId || !expectedProjectId) {
      setLiveVerification('idle');
      return false;
    }

    setLiveVerification('checking');

    const path = `${expectedOwnerId}/${expectedProjectId}/index.html`;
    const { data, error } = await downloadPublishedWebsiteFile(path);

    if (!verificationIsCurrent()) return false;

    if (error || !data || data.size <= 0) {
      setLiveVerification('failed');
      return false;
    }

    const liveUrl = publicWebsiteUrl(expectedProjectId, expectedOwnerId);
    const routeHealthy = await verifyPublishedRoute(liveUrl);

    if (!verificationIsCurrent()) return false;

    setLiveVerification(routeHealthy ? 'healthy' : 'failed');

    if (!routeHealthy && import.meta.env.PROD) {
      setPublishError('The site files exist, but the public website renderer did not return HTML. Try Publish again after refreshing Tayar.');
    }

    return routeHealthy;
  }


  async function revokeSharePreview(updateBusy = true) {
    if (publishBusy || previewBusy) return;
    if (!user || !cloudProjectId || !previewToken) return;

    const revokeSequence = ++previewOperationSequenceRef.current;
    const revokeLoadSequence = projectLoadSequenceRef.current;
    const revokeProjectId = cloudProjectId;
    const revokeUserId = user.id;
    const revokeToken = previewToken;
    const revokeIsCurrent = () =>
      previewOperationSequenceRef.current === revokeSequence &&
      projectLoadSequenceRef.current === revokeLoadSequence &&
      activeUserIdRef.current === revokeUserId;

    if (updateBusy) setPreviewBusy(true);
    setPreviewError('');

    try {
      const folder = `${revokeUserId}/${revokeProjectId}/previews/${revokeToken}`;
      await removePublishedWebsiteFiles(folder);

      if (!revokeIsCurrent()) return;

      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setPreviewFingerprint('');
      setSaved(false);
    } catch (error) {
      if (!revokeIsCurrent()) return;
      setPreviewError(error instanceof Error ? error.message : 'Could not revoke share preview.');
    } finally {
      if (updateBusy && previewOperationSequenceRef.current === revokeSequence) {
        setPreviewBusy(false);
      }
    }
  }
  return { verifyLiveDeployment, revokeSharePreview };
}
