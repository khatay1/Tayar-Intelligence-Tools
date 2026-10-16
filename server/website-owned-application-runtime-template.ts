import { serveOwnedApplicationRoute, type OwnedApplicationRouteManifest } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';
import { serveOwnedStripeCheckout, type OwnedStripeCheckoutTarget } from './website-owned-stripe-checkout';
import { serveOwnedEmailWorker } from './website-owned-email-worker';
import { createOwnedEmailRpcClient } from './website-owned-email-rpc';
import { readOwnedRuntimeEnvironment, type OwnedRuntimeSecretPlan } from './website-owned-runtime-secret-plan';
import { serveOwnedPaymentRoute } from './website-owned-payment-route';
import { serveOwnedReleaseIdentity, type OwnedReleaseIdentity } from './website-owned-release-identity';
import { resolveOwnedRuntimeRequestManifest } from './website-owned-request-scope';

declare const __TAYAR_MANIFEST__: OwnedApplicationRouteManifest;
declare const __TAYAR_PAGES__: Map<string, string>;
declare const __TAYAR_PATHS__: Map<string, string>;
declare const __TAYAR_STRIPE_CHECKOUTS__: ReadonlyArray<OwnedStripeCheckoutTarget>;
declare const __TAYAR_SECRET_PLAN__: OwnedRuntimeSecretPlan;
declare const __TAYAR_RELEASE_IDENTITY__: OwnedReleaseIdentity;

export default async function handler(request: Request) {
  let manifest: OwnedApplicationRouteManifest;
  try { manifest = resolveOwnedRuntimeRequestManifest(__TAYAR_MANIFEST__, __TAYAR_RELEASE_IDENTITY__); }
  catch { return new Response('Application runtime environment is unavailable.', { status: 503,
    headers: { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store', 'vercel-cdn-cache-control': 'no-store' } }); }
  const url = new URL(request.url);
  const route = url.searchParams.get('tayarRoute');
  if (route === 'release-proof') return serveOwnedReleaseIdentity(request, __TAYAR_RELEASE_IDENTITY__);
  if(route==='stripe-webhook'||route?.startsWith('stripe-order-')){
    try{return await serveOwnedPaymentRoute(request,{manifest,route,
      environment:readOwnedRuntimeEnvironment(__TAYAR_SECRET_PLAN__)});}
    catch{return Response.json({error:'Payment runtime unavailable.'},{status:503,headers:{'cache-control':'private, no-store'}});}
  }
  if (route === 'email-worker') {
    url.pathname = '/api/application-email-worker'; url.searchParams.delete('tayarRoute');
    try {
      const environment = readOwnedRuntimeEnvironment(__TAYAR_SECRET_PLAN__);
      return serveOwnedEmailWorker(new Request(url, request), {
        projectId: manifest.projectId,
        environment: __TAYAR_SECRET_PLAN__.environment,
        applicationOrigin: manifest.applicationOrigin,
        cronSecret: environment.CRON_SECRET,
        connections: __TAYAR_SECRET_PLAN__.emailConnections.map(connection => ({ id: connection.id, from: connection.from,
          apiKey: environment[connection.environmentKey] })),
        client: () => createOwnedEmailRpcClient({ backend: manifest.backend,
          expectedProjectRef: manifest.expectedProjectRef, secretKey: environment.SUPABASE_SECRET_KEY }),
      });
    } catch { return Response.json({ error: 'Email worker unavailable.' }, { status: 503,
      headers: { 'cache-control': 'private, no-store' } }); }
  }
  if (route === 'stripe-checkout') {
    url.pathname = '/api/stripe-checkout'; url.searchParams.delete('tayarRoute');
    return serveOwnedStripeCheckout(new Request(url, request), {
      projectId: manifest.projectId,
      applicationOrigin: manifest.applicationOrigin,
      pagePaths: manifest.pages.map(page => page.path),
      checkouts: __TAYAR_STRIPE_CHECKOUTS__,
    });
  }
  if (route === 'session') url.pathname = '/api/application-session';
  else if (route && __TAYAR_PATHS__.has(route)) url.pathname = __TAYAR_PATHS__.get(route)!;
  else return new Response('Application route not found.', {
    status: 404,
    headers: { 'cache-control': 'private, no-store' },
  });
  url.searchParams.delete('tayarRoute');
  return serveOwnedApplicationRoute(new Request(url, request), manifest, async pageId =>
    new Response(__TAYAR_PAGES__.get(pageId), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
}
