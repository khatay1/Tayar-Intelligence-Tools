import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicInfrastructureConnection } from '../core/application-infrastructure-connections';
import { beginWebsiteProviderConnection, consumeWebsiteProviderHandoff,
  type WebsiteConnectionHandoff, type WebsiteConnectionScope } from './websiteConnectionCoordinator';
import type { WebsiteConnectionEndpointCatalog, WebsiteConnectionEndpointProvider } from './websiteConnectionEndpointCatalog';
import { readWebsiteInfrastructureConnections } from './websiteInfrastructureConnectionClient';

export interface WebsiteInfrastructureControllerState {
  connections: readonly PublicInfrastructureConnection[];
  handoff: WebsiteConnectionHandoff | null;
  loading: boolean;
  error: string;
}

/** Standalone project-lifecycle controller. It owns only browser metadata and
 * opaque handoffs; provider grants remain in server custody. */
export function createWebsiteInfrastructureController(input: {
  client: Pick<SupabaseClient, 'rpc'>; catalog: WebsiteConnectionEndpointCatalog;
  scope: WebsiteConnectionScope; storage: Pick<Storage, 'setItem' | 'getItem' | 'removeItem'>;
  location: Pick<Location, 'hash' | 'pathname' | 'search'>; history: Pick<History, 'replaceState' | 'state'>;
  navigate(url: string): void;
}) {
  let disposed = false, requestSequence = 0;
  let state: WebsiteInfrastructureControllerState = { connections: [], handoff: null, loading: false, error: '' };
  const isCurrent = () => !disposed && input.scope.isCurrent();
  const snapshot = () => ({ ...state, connections: [...state.connections] });
  const refresh = async () => {
    if (!isCurrent()) throw new Error('Infrastructure scope changed.');
    const request = ++requestSequence; state = { ...state, loading: true, error: '' };
    try {
      const connections = await readWebsiteInfrastructureConnections({ client: input.client,
        projectId: input.scope.projectId, ownerId: input.scope.ownerId,
        isCurrent: () => isCurrent() && request === requestSequence });
      if (!isCurrent() || request !== requestSequence) throw new Error();
      state = { ...state, connections, loading: false };
      return snapshot();
    } catch {
      if (isCurrent() && request === requestSequence)
        state = { ...state, connections: [], loading: false, error: 'Infrastructure status is unavailable.' };
      throw new Error('Infrastructure status is unavailable.');
    }
  };
  return Object.freeze({
    availableProviders: input.catalog.availableProviders,
    getState: snapshot,
    refresh,
    consumeHandoff: () => {
      if (!isCurrent()) return null;
      const handoff = consumeWebsiteProviderHandoff({ scope: input.scope, location: input.location,
        history: input.history, storage: input.storage });
      if (handoff && isCurrent()) state = { ...state, handoff };
      return handoff;
    },
    clearHandoff: () => { if (isCurrent()) state = { ...state, handoff: null }; },
    begin: async (provider: WebsiteConnectionEndpointProvider, environment: 'preview' | 'production') => {
      if (!isCurrent()) throw new Error('Infrastructure scope changed.');
      const url = await beginWebsiteProviderConnection({ provider, catalog: input.catalog,
        scope: input.scope, environment, storage: input.storage });
      if (!isCurrent()) throw new Error('Infrastructure scope changed.');
      input.navigate(url);
      return url;
    },
    dispose: () => { disposed = true; requestSequence += 1; state = { connections: [], handoff: null, loading: false, error: '' }; },
  });
}
