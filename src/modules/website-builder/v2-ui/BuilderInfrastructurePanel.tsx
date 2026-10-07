import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { InfrastructureEnvironment, InfrastructureProvider, InfrastructureStatus,
  PublicInfrastructureConnection } from '../core/application-infrastructure-connections';

type Provider = Extract<InfrastructureProvider, 'github' | 'supabase' | 'vercel' | 'stripe'>;
interface Props {
  /** Supply only the owner-scoped server reader's result, never project JSON. */
  connections: PublicInfrastructureConnection[];
  projectSaved: boolean;
  requiresStripe?: boolean;
  availableProviders?: readonly Provider[];
  onConnect?(provider: Provider, environment: InfrastructureEnvironment): Promise<void>;
  onRefresh?(): Promise<void>;
}
const providers: Provider[] = ['github', 'supabase', 'vercel', 'stripe'];
const names: Record<Provider, string> = { github: 'GitHub', supabase: 'Supabase', vercel: 'Vercel', stripe: 'Stripe' };
const accepted: Record<Provider, readonly InfrastructureStatus[]> = {
  github: ['connected', 'ready'],
  supabase: ['connected', 'setup-incomplete', 'outdated-schema', 'ready'],
  vercel: ['connected', 'setup-incomplete', 'deployment-failed', 'ready'],
  stripe: ['ready'],
};
const environments = (provider: Provider): InfrastructureEnvironment[] =>
  provider === 'vercel' ? ['preview', 'production'] : provider === 'stripe' ? ['production'] : ['preview'];

function usable(provider: Provider, item: PublicInfrastructureConnection | undefined) {
  return !!item && !!item.targetId && !!item.verifiedAt && accepted[provider].includes(item.status);
}
function action(provider: Provider, environment: InfrastructureEnvironment, connected: boolean) {
  if (provider !== 'vercel') return connected ? 'Manage connection' : 'Connect account';
  if (environment === 'preview') return connected ? 'Manage preview' : 'Connect preview';
  return connected ? 'Manage production' : 'Connect production';
}

export function BuilderInfrastructurePanel({ connections, projectSaved, requiresStripe = false,
  availableProviders = [], onConnect, onRefresh }: Props) {
  const l = useLocalizer();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState('');
  const requiredSlots: Array<[Provider, InfrastructureEnvironment]> = [
    ['github', 'preview'], ['supabase', 'preview'], ['vercel', 'preview'], ['vercel', 'production'],
    ...(requiresStripe ? [['stripe', 'production'] as [Provider, InfrastructureEnvironment]] : []),
  ];
  const requiredProviders = [...new Set(requiredSlots.map(([provider]) => provider))];
  const ready = requiredSlots.every(([provider, environment]) => usable(provider,
    connections.find(item => item.provider === provider && item.environment === environment))
    && connections.some(item => item.provider === provider && item.environment === environment && item.status === 'ready'));
  return <section className="builder-v2-card" data-testid="byo-infrastructure-panel">
    <div className="builder-v2-card__header"><div><strong>{l('Infrastructure')}</strong><p>{l('Your accounts own the code, database and hosting. Tayar handles setup.')}</p></div></div>
    <p>{l('After handover, you manage these accounts and their billing. Tayar is used for project setup and future edits you request.')}</p>
    <p role="status">{l(ready ? 'Infrastructure ready for publishing' : 'Connect your accounts after saving the project')}</p>
    {error && <p role="alert">{l(error)}</p>}
    {providers.map(provider => {
      const optional = provider === 'stripe' && !requiresStripe;
      const available = availableProviders.includes(provider);
      const slots = environments(provider);
      return <div className="builder-v2-card builder-v2-card--nested" key={provider}>
        <div className="builder-v2-card__header"><strong>{names[provider]}</strong>
          <span>{l(optional ? 'Not required' : provider === 'vercel' ? 'Preview + production' : provider === 'stripe' ? 'Production' : 'Preview')}</span></div>
        {!optional && slots.map(environment => {
          const item = connections.find(connection => connection.provider === provider && connection.environment === environment);
          const status = item?.status ?? 'disconnected';
          const key = `${provider}:${environment}`;
          return <div key={environment} data-environment={environment}>
            <small>{l(environment === 'preview' ? 'Preview' : 'Production')}: {l(status)}</small>
            {item?.accountId && <small>{l('Account')}: {item.accountId}</small>}
            {item?.targetId && <small>{l('Target')}: {item.targetId}</small>}
            <button type="button" disabled={!projectSaved || !onConnect || !available || !!busy} onClick={async () => {
              if (!onConnect || !available) return;
              setBusy(key); setError('');
              try { await onConnect(provider, environment); } catch { setError('Connection could not be completed. Try again.'); }
              finally { setBusy(undefined); }
            }}>{l(action(provider, environment, status !== 'disconnected'))}</button>
          </div>;
        })}
      </div>;
    })}
    {onRefresh && <button type="button" disabled={!!busy} onClick={async () => {
      setBusy('refresh'); setError('');
      try { await onRefresh(); } catch { setError('Connection status could not be refreshed.'); }
      finally { setBusy(undefined); }
    }}>{l('Refresh connection status')}</button>}
    {(!onConnect || requiredProviders.some(provider => !availableProviders.includes(provider)))
      && <small>{l('Connection setup is not available yet. Tayar must activate this provider before you can connect your account.')}</small>}
  </section>;
}

export default BuilderInfrastructurePanel;
