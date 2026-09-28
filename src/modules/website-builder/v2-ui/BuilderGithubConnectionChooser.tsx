import { useEffect, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { PublicInfrastructureConnection } from '../core/application-infrastructure-connections';
import { listWebsiteGitHubChoices, selectWebsiteGitHubRepository,
  type GitHubBrowserScope, type GitHubBrowserTransport, type GitHubHandoff } from '../services/websiteGithubBrowserConnection';

interface Props {
  scope: GitHubBrowserScope;
  transport: GitHubBrowserTransport;
  handoff: GitHubHandoff;
  connection?: PublicInfrastructureConnection;
  onConnected(): Promise<void>;
  onClose(): void;
}
type Choices = Awaited<ReturnType<typeof listWebsiteGitHubChoices>>;

/** Shown only after a real callback supplied the owner-scoped opaque handle.
 * A successful binding remains `connected`; the parent refreshes server-owned
 * status and publishing still waits for verified export/backend/deployment. */
export function BuilderGithubConnectionChooser({ scope, transport, handoff, connection, onConnected, onClose }: Props) {
  const l = useLocalizer();
  const [installationId, setInstallationId] = useState<string>();
  const [page, setPage] = useState(1);
  const [choices, setChoices] = useState<Choices>();
  const [busy, setBusy] = useState(false);
  const [bound, setBound] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setChoices(undefined); setError('');
    void listWebsiteGitHubChoices({ scope, transport, handoff, installationId, page })
      .then(result => { if (active && scope.isCurrent()) setChoices(result); })
      .catch(() => { if (active && scope.isCurrent()) setError('GitHub repositories are unavailable. Reconnect GitHub.'); });
    return () => { active = false; };
  }, [scope, transport, handoff, installationId, page]);
  const selectInstallation = (id: string) => { setInstallationId(id); setPage(1); setChoices(undefined); };
  return <section className="builder-v2-card" data-testid="github-repository-chooser">
    <div className="builder-v2-card__header"><strong>{l('Choose GitHub repository')}</strong>
      <button type="button" onClick={onClose}>{l('Close')}</button></div>
    <p>{l('Select the account and repository that will own your source code.')}</p>
    {error && <p role="alert">{l(error)}</p>}
    {!choices && !error && <p role="status">{l('Loading repositories...')}</p>}
    {choices && !installationId && choices.installations.map(item =>
      <button type="button" key={item.id} onClick={() => selectInstallation(item.id)} disabled={busy || bound}>
        {item.accountLogin}
      </button>)}
    {choices && installationId && <>
      <button type="button" disabled={busy || bound} onClick={() => { setInstallationId(undefined); setPage(1); }}>
        {l('Choose another account')}
      </button>
      {choices.repositories.map(repository =>
        <button type="button" key={repository.id} disabled={busy || bound} onClick={async () => {
          setBusy(true); setError('');
          try {
            await selectWebsiteGitHubRepository({ scope, transport, handoff, installationId, repositoryId: repository.id,
              connectionId: connection?.id, expectedVersion: connection?.version });
            if (!scope.isCurrent()) throw new Error();
            await onConnected();
            if (scope.isCurrent()) setBound(true);
          } catch { if (scope.isCurrent()) setError('Repository connection could not be verified. Try again.'); }
          finally { if (scope.isCurrent()) setBusy(false); }
        }}>{repository.fullName} ({repository.defaultBranch})</button>)}
    </>}
    {choices?.hasMore && page < 10 && <button type="button" disabled={busy || bound} onClick={() => { setPage(current => current + 1); setChoices(undefined); }}>
      {l('Next page')}
    </button>}
    {bound && <p role="status">{l('Repository connected. Publishing setup is still required.')}</p>}
  </section>;
}

export default BuilderGithubConnectionChooser;
