import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { EditorPublishRedirect } from '../core/editor-publishing';
import {
  getEditorPublishingHostState,
  patchEditorPublishingHostState,
  subscribeEditorPublishingHost,
} from '../core/editor-publishing-host-store';
import { loadActiveWebsiteProjectId } from '../core/editor-project-lifecycle';
import {
  listWebsitePublishRedirects,
  mapWebsitePublishRedirectRows,
  replaceWebsitePublishRedirects,
} from '../services/publishRedirectService';
import { BuilderRedirectsPanel } from './BuilderRedirectsPanel';

export interface BuilderPersistedRedirectsPanelProps {
  redirects?: EditorPublishRedirect[];
  onChange?(redirects: EditorPublishRedirect[]): void;
  onSave?(): void | Promise<void>;
}

export function BuilderPersistedRedirectsPanel({
  redirects,
  onChange,
  onSave,
}: BuilderPersistedRedirectsPanelProps) {
  const { user } = useAuth();
  const host = useSyncExternalStore(
    subscribeEditorPublishingHost,
    getEditorPublishingHostState,
    getEditorPublishingHostState,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadSequenceRef = useRef(0);
  const saveSequenceRef = useRef(0);
  const projectId = loadActiveWebsiteProjectId(user?.id);
  const externallyControlled = redirects !== undefined || onChange !== undefined || onSave !== undefined;
  const resolvedRedirects = redirects ?? host.redirects;
  const resolvedOnChange = onChange ?? ((next: EditorPublishRedirect[]) => {
    patchEditorPublishingHostState({ redirects: next });
    setError('');
  });

  useEffect(() => {
    const sequence = ++loadSequenceRef.current;
    saveSequenceRef.current += 1;
    const ownerId = user?.id ?? null;
    const isCurrent = () =>
      loadSequenceRef.current === sequence &&
      (user?.id ?? null) === ownerId &&
      loadActiveWebsiteProjectId(user?.id) === projectId;

    if (externallyControlled) {
      setBusy(false);
      setError('');
      return;
    }

    if (!ownerId || !projectId) {
      patchEditorPublishingHostState({ redirects: [] });
      setBusy(false);
      setError('');
      return;
    }

    setBusy(true);
    setError('');
    void listWebsitePublishRedirects(projectId, ownerId).then(({ data, error: loadError }) => {
      if (!isCurrent()) return;
      if (loadError) {
        patchEditorPublishingHostState({ redirects: [] });
        setError('Publishing redirects are available to the project owner after the Publishing MAX migration is applied.');
        setBusy(false);
        return;
      }
      patchEditorPublishingHostState({
        redirects: mapWebsitePublishRedirectRows(
          (data || []) as Array<Record<string, unknown>>,
        ),
      });
      setBusy(false);
    });
  }, [externallyControlled, projectId, user?.id]);

  const saveFallback = async () => {
    const sequence = ++saveSequenceRef.current;
    const ownerId = user?.id ?? null;
    const expectedProjectId = projectId;
    const isCurrent = () =>
      saveSequenceRef.current === sequence &&
      (user?.id ?? null) === ownerId &&
      loadActiveWebsiteProjectId(user?.id) === expectedProjectId;

    if (!ownerId || !expectedProjectId) {
      if (isCurrent()) setError('Save this website to the cloud before saving redirects.');
      return;
    }

    setBusy(true);
    setError('');
    const result = await replaceWebsitePublishRedirects({
      projectId: expectedProjectId,
      ownerId,
      redirects: getEditorPublishingHostState().redirects,
    });

    if (!isCurrent()) return;
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error?.message || 'Publishing redirects could not be saved.');
      return;
    }
    patchEditorPublishingHostState({ redirects: result.data });
  };

  const resolvedOnSave = onSave ?? saveFallback;

  return (
    <div aria-busy={busy}>
      <BuilderRedirectsPanel
        redirects={resolvedRedirects}
        onChange={resolvedOnChange}
        onSave={resolvedOnSave}
      />
      {busy && <p className="tayar-v2-muted" role="status">Loading publishing redirects…</p>}
      {error && <p className="tayar-v2-error" role="alert">{error}</p>}
    </div>
  );
}

export default BuilderPersistedRedirectsPanel;
