import { useEffect, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { PublicInfrastructureConnection } from '../core/application-infrastructure-connections';
import { listWebsiteVercelChoices, selectWebsiteVercelProject,
  type VercelBrowserScope, type VercelBrowserTransport, type VercelHandoff } from '../services/websiteVercelBrowserConnection';

interface Props {
  scope: VercelBrowserScope; transport: VercelBrowserTransport; handoff: VercelHandoff;
  connection?: PublicInfrastructureConnection; onConnected(): Promise<void>; onClose(): void;
}
type Choices = Awaited<ReturnType<typeof listWebsiteVercelChoices>>;

export function BuilderVercelConnectionChooser({ scope, transport, handoff, connection, onConnected, onClose }: Props) {
  const l = useLocalizer();
  const [choices, setChoices] = useState<Choices>();
  const [busy, setBusy] = useState(false), [bound, setBound] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setChoices(undefined); setError('');
    void listWebsiteVercelChoices({ scope, transport, handoff })
      .then(result => { if (active && scope.isCurrent()) setChoices(result); })
      .catch(() => { if (active && scope.isCurrent()) setError('Vercel projects are unavailable. Reconnect Vercel.'); });
    return () => { active = false; };
  }, [scope, transport, handoff]);
  return <section className="builder-v2-card" data-testid="vercel-project-chooser">
    <div className="builder-v2-card__header"><strong>{l('Choose Vercel project')}</strong>
      <button type="button" onClick={onClose}>{l('Close')}</button></div>
    <p>{l('Only projects linked to the selected GitHub repository are shown.')}</p>
    {error && <p role="alert">{l(error)}</p>}
    {!choices && !error && <p role="status">{l('Loading Vercel projects...')}</p>}
    {choices && <><small>{l('Account')}: {choices.accountId}</small>
      {choices.projects.length === 0 && <p role="status">{l('No eligible Vercel project was found. Use a personal account or customer-owned team that is separate from Tayar\'s platform account, and link its project to this GitHub repository first.')}</p>}
      {choices.projects.map(project => <button type="button" key={project.projectId} disabled={busy || bound}
        onClick={async () => {
          setBusy(true); setError('');
          try {
            await selectWebsiteVercelProject({ scope, transport, handoff, userId: choices.userId,
              accountId: choices.accountId, configurationId: choices.configurationId,
              vercelProjectId: project.projectId, connectionId: connection?.id,
              expectedVersion: connection?.version });
            if (!scope.isCurrent()) throw new Error();
            await onConnected(); if (scope.isCurrent()) setBound(true);
          } catch { if (scope.isCurrent()) setError('Vercel project connection could not be verified. Try again.'); }
          finally { if (scope.isCurrent()) setBusy(false); }
        }}>{project.projectName} ({project.productionBranch})</button>)}</>}
    {bound && <p role="status">{l('Vercel project connected. Deployment setup is still required.')}</p>}
  </section>;
}

export default BuilderVercelConnectionChooser;

