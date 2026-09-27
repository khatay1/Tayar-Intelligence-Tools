import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import { supabase } from '@/lib/supabase';
import { createWebsiteApplicationReleaseClient, type WebsiteApplicationReleaseStatus, type WebsiteApplicationReleaseOutcome } from '../services/websiteApplicationReleaseClient';

const client = createWebsiteApplicationReleaseClient(supabase);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Parent keys the panel by project/revision. Queries begin only on user action. */
export default function BuilderApplicationReleasePanel({ projectId, disabled }: { projectId: string | null; disabled?: boolean }) {
  const l = useLocalizer();
  const [status, setStatus] = useState<WebsiteApplicationReleaseStatus | null>(null);
  const [versionId, setVersionId] = useState('');
  const [outcome, setOutcome] = useState<WebsiteApplicationReleaseOutcome | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const busyRef = useRef(false);
  useEffect(() => () => { generation.current += 1; busyRef.current = false; }, [projectId]);
  async function query(inspect: boolean) {
    if (!projectId || disabled || busyRef.current || (inspect && !uuid.test(versionId))) return;
    const current = ++generation.current;
    const isCurrent = () => generation.current === current;
    busyRef.current = true; setBusy(true); setError(''); setOutcome(null);
    try {
      if (inspect) {
        const result = await client.inspect(projectId, versionId, isCurrent);
        if (isCurrent()) setOutcome(result);
      } else {
        const result = await client.read(projectId, isCurrent);
        if (isCurrent()) { setStatus(result); setVersionId(result.versionId ?? ''); }
      }
    } catch {
      if (isCurrent()) { setError('Private release status is unavailable.'); if (!inspect) setStatus(null); }
    } finally {
      if (isCurrent()) { busyRef.current = false; setBusy(false); }
    }
  }
  const blocked = disabled || busy || !projectId;
  return <details className="builder-v2-card builder-v2-card--nested" data-testid="application-release-panel">
    <summary>{l('Private release status')}</summary>
    {!projectId && <p>{l('Save a cloud project to inspect private releases.')}</p>}
    <p>{l('Publishing still requires the remaining runtime checks.')}</p>
    {status && <p role="status" aria-live="polite">{status.versionId ? l('A private release is selected.')
      : status.privateMode ? l('Private mode is enabled without an available release.') : l('No private release is selected.')}</p>}
    {status && !status.publishingAvailable && <p>{l('Private publishing is not available yet.')}</p>}
    {busy && <p role="status" aria-live="polite">{l('Checking release…')}</p>}
    {error && <p role="alert">{l(error)}</p>}
    <button type="button" disabled={blocked} onClick={() => void query(false)}>{l('Refresh release status')}</button>
    <form className="builder-v2-grid" onSubmit={event => { event.preventDefault(); void query(true); }}>
      <label>{l('Release identifier')}<input value={versionId} disabled={blocked} maxLength={36} autoComplete="off" spellCheck={false}
        onChange={event => { setVersionId(event.target.value.trim()); setOutcome(null); setError(''); }} /></label>
      <button type="submit" disabled={blocked || !uuid.test(versionId)}>{l('Check release result')}</button>
    </form>
    {outcome && <p role="status" aria-live="polite">{outcome === 'selected' ? l('The release is selected. Live runtime checks are still required.')
      : outcome === 'recorded' ? l('The release is saved but is not selected for display.')
        : l('The release result is not confirmed yet. Keep its files and check again.')}</p>}
  </details>;
}
