import { useSyncExternalStore } from 'react';
import type { EditorPublishRedirect } from '../core/editor-publishing';
import {
  getEditorPublishingHostState,
  patchEditorPublishingHostState,
  subscribeEditorPublishingHost,
} from '../core/editor-publishing-host-store';
import { BuilderRedirectsPanel } from './BuilderRedirectsPanel';

export interface BuilderPersistedRedirectsPanelProps {
  redirects?: EditorPublishRedirect[];
  onChange?(redirects: EditorPublishRedirect[]): void;
  onSave?(): void | Promise<void>;
}

export function BuilderPersistedRedirectsPanel({ redirects, onChange, onSave }: BuilderPersistedRedirectsPanelProps) {
  const host = useSyncExternalStore(subscribeEditorPublishingHost, getEditorPublishingHostState, getEditorPublishingHostState);
  const resolvedRedirects = redirects ?? host.redirects;
  const resolvedOnChange = onChange ?? (next => patchEditorPublishingHostState({ redirects: next }));
  return <BuilderRedirectsPanel redirects={resolvedRedirects} onChange={resolvedOnChange} onSave={onSave}/>;
}

export default BuilderPersistedRedirectsPanel;
