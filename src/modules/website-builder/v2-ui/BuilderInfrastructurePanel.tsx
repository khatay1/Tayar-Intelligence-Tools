import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { InfrastructureProvider, PublicInfrastructureConnection } from '../core/application-infrastructure-connections';

type Provider = Extract<InfrastructureProvider, 'github' | 'supabase' | 'vercel' | 'stripe'>;
interface Props {
  /** Supply only the owner-scoped server reader's result, never project JSON. */
  connections: PublicInfrastructureConnection[];
  projectSaved: boolean;
  requiresStripe?: boolean;
  availableProviders?: readonly Provider[];
  onConnect?(provider: Provider): Promise<void>;
  onRefresh?(): Promise<void>;
}
const providers: Provider[] = ['github', 'supabase', 'vercel', 'stripe'];
const names: Record<Provider, string> = { github: 'GitHub', supabase: 'Supabase', vercel: 'Vercel', stripe: 'Stripe' };

export function BuilderInfrastructurePanel({ connections, projectSaved, requiresStripe = false,
  availableProviders = [], onConnect, onRefresh }: Props) {
  const l = useLocalizer();
  const [busy, setBusy] = useState<Provider | 'refresh'>();
  const [error, setError] = useState('');
  const required = providers.filter(provider => provider !== 'stripe' || requiresStripe);
  const ready = required.every(provider => connections.some(item => item.provider === provider && item.environment === 'production'
    && item.status === 'ready' && !!item.verifiedAt));
  return <section className="builder-v2-card" data-testid="byo-infrastructure-panel">
    <div className="builder-v2-card__header"><div><strong>{l('Infrastructure')}</strong><p>{l('Your accounts own the code, database and hosting. Tayar handles setup.')}</p></div></div>
    <p role="status">{l(ready ? 'Infrastructure ready for publishing' : 'Connect your accounts after saving the project')}</p>
    {error && <p role="alert">{l(error)}</p>}
    {providers.map(provider => {
      const item = connections.find(connection => connection.provider === provider && connection.environment === 'production');
      const status = item?.status ?? 'disconnected';
      const optional = provider === 'stripe' && !requiresStripe;
      const available = availableProviders.includes(provider);
      return <div className="builder-v2-card builder-v2-card--nested" key={provider}>
        <div className="builder-v2-card__header"><strong>{names[provider]}</strong><span>{l(optional ? 'Not required' : status)}</span></div>
        {item?.accountId && <small>{l('Account')}: {item.accountId}</small>}
        {item?.targetId && <small>{l('Target')}: {item.targetId}</small>}
        {!optional && <button type="button" disabled={!projectSaved || !onConnect || !available || !!busy} onClick={async () => {
          if (!onConnect || !available) return;
          setBusy(provider); setError('');
          try { await onConnect(provider); } catch { setError('Connection could not be completed. Try again.'); }
          finally { setBusy(undefined); }
        }}>{l(status === 'disconnected' ? 'Connect account' : 'Manage connection')}</button>}
      </div>;
    })}
    {onRefresh && <button type="button" disabled={!!busy} onClick={async () => {
      setBusy('refresh'); setError('');
      try { await onRefresh(); } catch { setError('Connection status could not be refreshed.'); }
      finally { setBusy(undefined); }
    }}>{l('Refresh connection status')}</button>}
    {(!onConnect || required.some(provider => !availableProviders.includes(provider)))
      && <small>{l('Connection setup is not available yet.')}</small>}
  </section>;
}

export default BuilderInfrastructurePanel;
