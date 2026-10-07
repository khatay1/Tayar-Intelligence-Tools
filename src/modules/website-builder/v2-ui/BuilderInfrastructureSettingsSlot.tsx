import { useEffect, useMemo, useRef, useState } from 'react';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { createWebsiteConnectionEndpointCatalog } from '../services/websiteConnectionEndpointCatalog';
import { createWebsiteInfrastructureController } from '../services/websiteInfrastructureController';
import { BuilderInfrastructureConnectionContainer } from './BuilderInfrastructureConnectionContainer';
import { BuilderInfrastructurePanel } from './BuilderInfrastructurePanel';
import { BuilderByoPublishPanel } from './BuilderByoPublishPanel';
import { pollWebsiteByoPublish, startWebsiteByoPreview, startWebsiteByoProduction, type WebsiteByoPublishResult } from '../services/websiteByoPublishBrowserService';
import { useLocalizer } from '@/lib/ui-localization-cms';

interface Props {
  projectId?: string | null;
  ownerId?: string | null;
  ownerIsAnonymous?: boolean;
  loadSequence: number;
  hasUnsavedChanges?: boolean;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BuilderActiveInfrastructureSettings({ projectId, ownerId, loadSequence, hasUnsavedChanges = false }: {
  projectId: string; ownerId: string; loadSequence: number; hasUnsavedChanges?: boolean;
}) {
  const l = useLocalizer();
  const saved = useRef(!hasUnsavedChanges);
  saved.current = !hasUnsavedChanges;
  const [restoring, setRestoring] = useState(true);
  const [initialPreview, setInitialPreview] = useState<WebsiteByoPublishResult | null>(null);
  const [initialProduction, setInitialProduction] = useState<WebsiteByoPublishResult | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const target = useRef({ projectId, ownerId, loadSequence });
  target.current = { projectId, ownerId, loadSequence };
  const composition = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const scope = { projectId, ownerId, loadSequence, isCurrent: () => {
        const current = target.current;
        return active.current && current.projectId === projectId && current.ownerId === ownerId && current.loadSequence === loadSequence;
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
      const transport = catalog.transportFor('github');
      // Deployment availability is explicit; never infer it from an endpoint URL.
      const publishController = env.websiteByoPublishEnabled && catalog.availableProviders.length === 3 && transport ? {
        start: async (environment: 'preview' | 'production', newOperation: boolean) => {
          if (!saved.current) throw new Error('Save the current project before publishing.');
          const input = { scope, transport, storage: window.sessionStorage, newOperation };
          return environment === 'preview' ? startWebsiteByoPreview(input) : startWebsiteByoProduction(input);
        },
        poll: (environment: 'preview' | 'production') => pollWebsiteByoPublish({ scope, transport, storage: window.sessionStorage, environment, includeSettled: true }),
      } : undefined;
      return { controller, scope, publishController };
    } catch { return null; }
  }, [loadSequence, ownerId, projectId]);

  useEffect(() => {
    let active = true;
    setInitialPreview(null); setInitialProduction(null);
    setRestoring(true);
    if (composition?.publishController) {
      void Promise.all(['preview', 'production'].map(async environment => {
        const result = await composition.publishController!.poll(environment as 'preview' | 'production');
        if (!active || !composition.scope.isCurrent()) return;
        if (environment === 'preview') setInitialPreview(result); else setInitialProduction(result);
      })).catch(() => { /* Restoration grants no readiness on failure. */ }).finally(() => { if (active) setRestoring(false); });
    } else setRestoring(false);
    return () => { active = false; };
  }, [composition]);

  if (!composition) return <BuilderInfrastructurePanel connections={[]} projectSaved availableProviders={[]} />;
  return <>
    <BuilderInfrastructureConnectionContainer controller={composition.controller} scope={composition.scope} projectSaved />
    {hasUnsavedChanges && <p role="status">{l('Save the current project before publishing on your accounts.')}</p>}
    <BuilderByoPublishPanel key={`${projectId}:${ownerId}:${loadSequence}`} projectSaved={!hasUnsavedChanges && !restoring}
      controller={composition.publishController} initialPreview={initialPreview} initialProduction={initialProduction} />
  </>;
}

/** Editor boundary: invalid/unsaved/anonymous scopes never create a reader,
 * catalog, callback consumer or provider navigation path. */
export function BuilderInfrastructureSettingsSlot({ projectId, ownerId, ownerIsAnonymous = false, loadSequence, hasUnsavedChanges }: Props) {
  if (!projectId || !ownerId || ownerIsAnonymous || !uuid.test(projectId) || !uuid.test(ownerId)
    || !Number.isSafeInteger(loadSequence) || loadSequence < 0)
    return <BuilderInfrastructurePanel connections={[]} projectSaved={false} availableProviders={[]} />;
  return <BuilderActiveInfrastructureSettings key={`${projectId}:${ownerId}:${loadSequence}`} projectId={projectId} ownerId={ownerId} loadSequence={loadSequence} hasUnsavedChanges={hasUnsavedChanges} />;
}

export default BuilderInfrastructureSettingsSlot;
