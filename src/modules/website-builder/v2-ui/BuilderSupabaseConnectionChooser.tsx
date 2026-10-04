import { useEffect, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { PublicInfrastructureConnection } from '../core/application-infrastructure-connections';
import { listWebsiteSupabaseChoices, selectWebsiteSupabaseProject,
  type SupabaseBrowserScope, type SupabaseHandoff } from '../services/websiteSupabaseBrowserConnection';
import type { WebsiteConnectionBrowserTransport } from '../services/websiteConnectionEndpointCatalog';

interface Props {
  scope: SupabaseBrowserScope; transport: WebsiteConnectionBrowserTransport; handoff: SupabaseHandoff;
  connection?: PublicInfrastructureConnection; onConnected(): Promise<void>; onClose(): void;
}
type Choices = Awaited<ReturnType<typeof listWebsiteSupabaseChoices>>;

export function BuilderSupabaseConnectionChooser({ scope, transport, handoff, connection, onConnected, onClose }: Props) {
  const l = useLocalizer();
  const [choices, setChoices] = useState<Choices>();
  const [busy, setBusy] = useState(false), [bound, setBound] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setChoices(undefined); setError('');
    void listWebsiteSupabaseChoices({ scope, transport, handoff })
      .then(result => { if (active && scope.isCurrent()) setChoices(result); })
      .catch(() => { if (active && scope.isCurrent()) setError('Supabase projects are unavailable. Reconnect Supabase.'); });
    return () => { active = false; };
  }, [scope, transport, handoff]);
  return <section className="builder-v2-card" data-testid="supabase-project-chooser">
    <div className="builder-v2-card__header"><strong>{l('Choose Supabase project')}</strong>
      <button type="button" onClick={onClose}>{l('Close')}</button></div>
    <p>{l('Only active projects in organizations you own are shown. Tayar accounts are excluded.')}</p>
    {error && <p role="alert">{l(error)}</p>}
    {!choices && !error && <p role="status">{l('Loading Supabase projects...')}</p>}
    {choices && choices.projects.length === 0 && <p role="status">{l('No eligible Supabase project was found. Use a project in a customer-owned Supabase organization that is separate from Tayar\'s platform organization, then reconnect Supabase.')}</p>}
    {choices?.projects.map(project => <button type="button" key={project.projectRef} disabled={busy || bound}
      onClick={async () => {
        setBusy(true); setError('');
        try {
          await selectWebsiteSupabaseProject({ scope, transport, handoff, choice: project,
            accountUserId: choices.accountUserId, connectionId: connection?.id, expectedVersion: connection?.version });
          if (!scope.isCurrent()) throw new Error();
          await onConnected(); if (scope.isCurrent()) setBound(true);
        } catch { if (scope.isCurrent()) setError('Supabase project connection could not be verified. Try again.'); }
        finally { if (scope.isCurrent()) setBusy(false); }
      }}>{project.organizationName} / {project.projectName}</button>)}
    {bound && <p role="status">{l('Supabase project connected. Backend setup is still required.')}</p>}
  </section>;
}

export default BuilderSupabaseConnectionChooser;
