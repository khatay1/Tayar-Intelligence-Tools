import BuilderApplicationReleasePanel from './BuilderApplicationReleasePanel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { ApplicationDefinition } from '../core/application-model';
import type { ApplicationPublicBackend } from '../core/application-data-runtime';
import { createWebsiteApplicationBackendClient } from '../services/websiteApplicationBackendClient';

const client = createWebsiteApplicationBackendClient(supabase, env.supabaseUrl);

/** Mounted with a project/revision key so changing projects discards credentials and pending UI results. */
export default function BuilderApplicationBackendPanel({ projectId, definition, saved, disabled }: {
  projectId: string | null;
  definition?: ApplicationDefinition;
  saved: boolean;
  disabled?: boolean;
}) {
  const l = useLocalizer();
  const [backend, setBackend] = useState<ApplicationPublicBackend | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const secretInput = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  const busyRef = useRef(false);
  const eligible = Boolean(projectId && definition && saved);
  const refresh = useCallback(async () => {
    if (!projectId || !definition || !saved || busyRef.current) return;
    const version = ++requestVersion.current;
    busyRef.current = true; setBusy(true); setError(''); setAvailable(false); setBackend(null);
    try {
      const current = await client.read(projectId, definition);
      if (version !== requestVersion.current) return;
      setBackend(current); setAvailable(true);
      if (current) { setUrl(current.url); setPublicKey(current.publishableKey); }
    } catch (reason) {
      if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : 'Backend status is unavailable. Save the project and try again.');
    } finally {
      if (version === requestVersion.current) { busyRef.current = false; setBusy(false); }
    }
  }, [projectId, definition, saved]);
  useEffect(() => {
    void refresh();
    const input = secretInput.current;
    return () => { requestVersion.current += 1; busyRef.current = false; if (input) input.value = ''; };
  }, [refresh]);
  async function link() {
    if (!eligible || !projectId || !definition || disabled || !available || busyRef.current) return;
    const serviceKey = secretInput.current?.value ?? '';
    if (secretInput.current) secretInput.current.value = '';
    const version = ++requestVersion.current;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const normalizedUrl = url.trim().replace(/\/$/, '');
      const projectRef = new URL(normalizedUrl).hostname.split('.')[0];
      const current = await client.link(projectId, definition, { url: normalizedUrl, projectRef, publishableKey: publicKey.trim() }, serviceKey, () => version === requestVersion.current);
      if (version === requestVersion.current) setBackend(current);
    } catch (reason) {
      if (version === requestVersion.current) setError(reason instanceof Error && reason.message ? reason.message : 'Backend linking failed. Check the saved schema and connection settings, then enter the service key again.');
    } finally {
      if (version === requestVersion.current) { busyRef.current = false; setBusy(false); }
    }
  }
  const blocked = disabled || busy || !eligible || !available;
  return <details className="builder-v2-card builder-v2-card--nested" data-testid="application-backend-panel">
    <summary>{l('Application backend connection')}</summary>
    <p>{l('Connect an existing dedicated backend with the matching application schema.')}</p>
    {!eligible && <p>{l('Save this project before linking a backend.')}</p>}
    <p role="status" aria-live="polite">{busy ? l('Checking backend…') : backend ? `${l('Backend linked')}: ${backend.projectRef}` : l('No verified backend connection.')}</p>
    {backend && <p>{l('Backend linked. Publishing still requires the remaining runtime checks.')}</p>}
    {error && <p role="alert">{l(error)}</p>}
    <button type="button" disabled={disabled || busy || !eligible} onClick={() => void refresh()}>{l('Refresh backend status')}</button>
    <form className="builder-v2-grid" autoComplete="off" onSubmit={event => { event.preventDefault(); void link(); }}>
      <label>{l('Dedicated backend URL')}<input type="url" required disabled={blocked} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://project-ref.supabase.co" maxLength={200} /></label>
      <label>{l('Backend public key')}<input required disabled={blocked} value={publicKey} onChange={event => setPublicKey(event.target.value)} maxLength={4096} autoComplete="off" spellCheck={false} /></label>
      <label>{l('Backend service key')}<input ref={secretInput} type="password" required disabled={blocked} maxLength={16384} autoComplete="new-password" spellCheck={false} /></label>
      <p>{l('The service key is encrypted on the server and cleared from this form after submission.')}</p>
      <button type="submit" disabled={blocked}>{l('Verify and link backend')}</button>
    </form>
    <BuilderApplicationReleasePanel key={projectId ?? 'local'} projectId={projectId} disabled={disabled} />
  </details>;
}
