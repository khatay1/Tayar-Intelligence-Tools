import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  checkWebsiteCustomDomain,
  connectWebsiteCustomDomain,
  getWebsiteCustomDomain,
  removeWebsiteCustomDomain,
  type WebsiteCustomDomain,
} from '../services/websiteDomainService';

interface CustomDomainContext {
  cloudProjectId: string | null;
  user: { id: string } | null;
  customDomain: WebsiteCustomDomain | null;
  customDomainDraft: string;
  projectLoadSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  setCustomDomain: Dispatch<SetStateAction<WebsiteCustomDomain | null>>;
  setCustomDomainDraft: Dispatch<SetStateAction<string>>;
  setCustomDomainBusy: Dispatch<SetStateAction<boolean>>;
  setCustomDomainError: Dispatch<SetStateAction<string>>;
  setSiteUrl: Dispatch<SetStateAction<string>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  l: (text: string) => string;
}

export function useCustomDomainHandlers({
  cloudProjectId, user, customDomain, customDomainDraft,
  projectLoadSequenceRef, activeUserIdRef, setCustomDomain,
  setCustomDomainDraft, setCustomDomainBusy, setCustomDomainError,
  setSiteUrl, setSaved, l,
}: CustomDomainContext) {
  const refreshCustomDomain = useCallback(async () => {
    if (!cloudProjectId || !user) {
      setCustomDomain(null);
      setCustomDomainDraft('');
      return;
    }
    const loadSequence = projectLoadSequenceRef.current;
    const project = cloudProjectId;
    const userId = user.id;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      const domain = await getWebsiteCustomDomain(project);
      if (projectLoadSequenceRef.current !== loadSequence || activeUserIdRef.current !== userId) return;
      setCustomDomain(domain);
      setCustomDomainDraft(domain?.hostname || '');
    } catch (error) {
      if (projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId) {
        setCustomDomainError(error instanceof Error ? error.message : 'Could not load the custom domain.');
      }
    } finally {
      if (projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId) setCustomDomainBusy(false);
    }
  }, [cloudProjectId, user, projectLoadSequenceRef, activeUserIdRef, setCustomDomain, setCustomDomainDraft, setCustomDomainBusy, setCustomDomainError]);

  async function connectCustomDomain() {
    if (!cloudProjectId || !customDomainDraft.trim()) return;
    const loadSequence = projectLoadSequenceRef.current;
    const userId = activeUserIdRef.current;
    const isCurrent = () => projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      const domain = await connectWebsiteCustomDomain(cloudProjectId, customDomainDraft);
      if (!isCurrent()) return;
      setCustomDomain(domain);
      setCustomDomainDraft(domain?.hostname || customDomainDraft.trim().toLowerCase());
      if (domain?.warning) setCustomDomainError(domain.warning);
      if (domain?.status === 'verified') { setSiteUrl(`https://${domain.hostname}`); setSaved(false); }
    } catch (error) {
      if (isCurrent()) setCustomDomainError(error instanceof Error ? error.message : 'Could not connect the domain.');
    } finally {
      if (isCurrent()) setCustomDomainBusy(false);
    }
  }

  async function checkCustomDomain() {
    if (!cloudProjectId || !customDomain?.hostname) return;
    const loadSequence = projectLoadSequenceRef.current;
    const userId = activeUserIdRef.current;
    const isCurrent = () => projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      const domain = await checkWebsiteCustomDomain(cloudProjectId, customDomain.hostname);
      if (!isCurrent()) return;
      setCustomDomain(domain);
      if (domain?.status === 'verified') { setSiteUrl(`https://${domain.hostname}`); setSaved(false); }
    } catch (error) {
      if (isCurrent()) setCustomDomainError(error instanceof Error ? error.message : 'Could not verify the domain.');
    } finally {
      if (isCurrent()) setCustomDomainBusy(false);
    }
  }

  async function removeCustomDomain() {
    if (!cloudProjectId || !customDomain) return;
    if (!window.confirm(l('Disconnect this custom domain?'))) return;
    const loadSequence = projectLoadSequenceRef.current;
    const userId = activeUserIdRef.current;
    const isCurrent = () => projectLoadSequenceRef.current === loadSequence && activeUserIdRef.current === userId;
    setCustomDomainBusy(true);
    setCustomDomainError('');
    try {
      await removeWebsiteCustomDomain(cloudProjectId);
      if (!isCurrent()) return;
      setCustomDomain(null);
      setCustomDomainDraft('');
    } catch (error) {
      if (isCurrent()) setCustomDomainError(error instanceof Error ? error.message : 'Could not disconnect the domain.');
    } finally {
      if (isCurrent()) setCustomDomainBusy(false);
    }
  }

  return { refreshCustomDomain, connectCustomDomain, checkCustomDomain, removeCustomDomain };
}
