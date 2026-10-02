import { useEffect, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { PublicInfrastructureConnection } from '../core/application-infrastructure-connections';
import type { WebsiteConnectionScope } from '../services/websiteConnectionCoordinator';
import type { WebsiteInfrastructureController } from '../services/websiteInfrastructureController';
import { BuilderGithubConnectionChooser } from './BuilderGithubConnectionChooser';
import { BuilderInfrastructurePanel } from './BuilderInfrastructurePanel';
import { BuilderSupabaseConnectionChooser } from './BuilderSupabaseConnectionChooser';
import { BuilderVercelConnectionChooser } from './BuilderVercelConnectionChooser';

interface Props {
  controller: WebsiteInfrastructureController;
  scope: WebsiteConnectionScope;
  projectSaved: boolean;
  requiresStripe?: boolean;
}

export function BuilderInfrastructureConnectionContainer({ controller, scope, projectSaved,
  requiresStripe = false }: Props) {
  const l = useLocalizer();
  const [state, setState] = useState(controller.getState());
  const sync = () => { if (scope.isCurrent()) setState(controller.getState()); };
  const refresh = async () => {
    try { await controller.refresh(); } finally { sync(); }
  };

  useEffect(() => () => { controller.dispose(); }, [controller]);
  useEffect(() => {
    let active = true;
    const update = () => { if (active && scope.isCurrent()) setState(controller.getState()); };
    if (!projectSaved) { update(); return () => { active = false; }; }
    controller.consumeHandoff(); update();
    void controller.refresh().then(update).catch(update);
    return () => { active = false; };
  }, [controller, projectSaved, scope]);

  const handoff = state.handoff;
  const connection = (provider: PublicInfrastructureConnection['provider']) => state.connections
    .find(item => item.provider === provider && item.environment === 'production');
  const closeChooser = () => { controller.clearHandoff(); sync(); };
  const transport = handoff ? controller.transportFor(handoff.provider) : null;

  return <div data-testid="infrastructure-connection-container">
    <BuilderInfrastructurePanel connections={[...state.connections]} projectSaved={projectSaved}
      requiresStripe={requiresStripe} availableProviders={controller.availableProviders}
      onConnect={async provider => {
        if (provider === 'stripe') throw new Error('Connection setup is unavailable.');
        await controller.begin(provider, 'production');
      }} onRefresh={projectSaved ? refresh : undefined} />
    {state.loading && <p role="status">{l('Loading infrastructure status...')}</p>}
    {state.error && <p role="alert">{l('Infrastructure status is unavailable.')}</p>}
    {handoff?.provider === 'github' && transport && <BuilderGithubConnectionChooser key={handoff.handoff.id}
      scope={scope} transport={transport} handoff={handoff.handoff} connection={connection('github')}
      onConnected={refresh} onClose={closeChooser} />}
    {handoff?.provider === 'supabase' && transport && <BuilderSupabaseConnectionChooser key={handoff.handoff.id}
      scope={scope} transport={transport} handoff={handoff.handoff} connection={connection('supabase')}
      onConnected={refresh} onClose={closeChooser} />}
    {handoff?.provider === 'vercel' && transport && <BuilderVercelConnectionChooser key={handoff.handoff.id}
      scope={scope} transport={transport} handoff={handoff.handoff} connection={connection('vercel')}
      onConnected={refresh} onClose={closeChooser} />}
  </div>;
}

export default BuilderInfrastructureConnectionContainer;
