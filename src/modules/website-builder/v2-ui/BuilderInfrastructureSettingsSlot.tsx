import { useMemo, useRef } from 'react';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { createWebsiteConnectionEndpointCatalog } from '../services/websiteConnectionEndpointCatalog';
import { createWebsiteInfrastructureController } from '../services/websiteInfrastructureController';
import { BuilderInfrastructureConnectionContainer } from './BuilderInfrastructureConnectionContainer';
import { BuilderInfrastructurePanel } from './BuilderInfrastructurePanel';

interface Props {
  projectId?: string | null;
  ownerId?: string | null;
  ownerIsAnonymous?: boolean;
  loadSequence: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BuilderActiveInfrastructureSettings({ projectId, ownerId, loadSequence }: {
  projectId: string; ownerId: string; loadSequence: number;
}) {
  const target = useRef({ projectId, ownerId, loadSequence });
  target.current = { projectId, ownerId, loadSequence };
  const composition = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const scope = { projectId, ownerId, loadSequence, isCurrent: () => {
        const current = target.current;
        return current.projectId === projectId && current.ownerId === ownerId && current.loadSequence === loadSequence;
      } };
      const catalog = createWebsiteConnectionEndpointCatalog({
        environment: {
          VITE_WEBSITE_GITHUB_CONNECTION_URL: env.websiteGithubConnectionUrl,
          VITE_WEBSITE_SUPABASE_CONNECTION_URL: env.websiteSupabaseConnectionUrl,
          VITE_WEBSITE_VERCEL_CONNECTION_URL: env.websiteVercelConnectionUrl,
        },
        platformUrl: env.supabaseUrl,
        anonKey: env.supabaseAnonKey,
        getSession: async () => {
          const result = await supabase.auth.getSession();
          const session = result.data.session;
          if (result.error || !session || session.user.id !== ownerId || session.user.is_anonymous
            || !scope.isCurrent()) return null;
          return { ownerId, accessToken: session.access_token };
        },
      });
      const controller = createWebsiteInfrastructureController({ client: supabase, catalog, scope,
        storage: window.sessionStorage, location: window.location, history: window.history,
        navigate: url => { window.location.assign(url); } });
      return { controller, scope };
    } catch { return null; }
  }, [loadSequence, ownerId, projectId]);

  if (!composition) return <BuilderInfrastructurePanel connections={[]} projectSaved availableProviders={[]} />;
  return <BuilderInfrastructureConnectionContainer controller={composition.controller}
    scope={composition.scope} projectSaved />;
}

/** Editor boundary: invalid/unsaved/anonymous scopes never create a reader,
 * catalog, callback consumer or provider navigation path. */
export function BuilderInfrastructureSettingsSlot({ projectId, ownerId, ownerIsAnonymous = false, loadSequence }: Props) {
  if (!projectId || !ownerId || ownerIsAnonymous || !uuid.test(projectId) || !uuid.test(ownerId)
    || !Number.isSafeInteger(loadSequence) || loadSequence < 0)
    return <BuilderInfrastructurePanel connections={[]} projectSaved={false} availableProviders={[]} />;
  return <BuilderActiveInfrastructureSettings projectId={projectId} ownerId={ownerId} loadSequence={loadSequence} />;
}

export default BuilderInfrastructureSettingsSlot;
