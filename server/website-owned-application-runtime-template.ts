import { serveOwnedApplicationRoute, type OwnedApplicationRouteManifest } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';
import { serveOwnedStripeCheckout, type OwnedStripeCheckoutTarget } from './website-owned-stripe-checkout';
import { serveOwnedEmailWorker } from './website-owned-email-worker';
import { createOwnedEmailRpcClient } from './website-owned-email-rpc';
import { readOwnedRuntimeEnvironment, type OwnedRuntimeSecretPlan } from './website-owned-runtime-secret-plan';
import { serveOwnedPaymentRoute } from './website-owned-payment-route';

declare const __TAYAR_MANIFEST__: OwnedApplicationRouteManifest;
declare const __TAYAR_PAGES__: Map<string, string>;
declare const __TAYAR_PATHS__: Map<string, string>;
declare const __TAYAR_STRIPE_CHECKOUTS__: ReadonlyArray<OwnedStripeCheckoutTarget>;
declare const __TAYAR_SECRET_PLAN__: OwnedRuntimeSecretPlan;

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('tayarRoute');
  if(route==='stripe-webhook'||route?.startsWith('stripe-order-')){
    try{return await serveOwnedPaymentRoute(request,{manifest:__TAYAR_MANIFEST__,route,
      environment:readOwnedRuntimeEnvironment(__TAYAR_SECRET_PLAN__)});}
    catch{return Response.json({error:'Payment runtime unavailable.'},{status:503,headers:{'cache-control':'private, no-store'}});}
  }
  if (route === 'email-worker') {
    url.pathname = '/api/application-email-worker'; url.searchParams.delete('tayarRoute');
    try {
      const environment = readOwnedRuntimeEnvironment(__TAYAR_SECRET_PLAN__);
      return serveOwnedEmailWorker(new Request(url, request), {
        projectId: __TAYAR_MANIFEST__.projectId,
        environment: __TAYAR_SECRET_PLAN__.environment,
        applicationOrigin: __TAYAR_MANIFEST__.applicationOrigin,
        cronSecret: environment.CRON_SECRET,
        connections: __TAYAR_SECRET_PLAN__.emailConnections.map(connection => ({ id: connection.id, from: connection.from,
          apiKey: environment[connection.environmentKey] })),
        client: () => createOwnedEmailRpcClient({ backend: __TAYAR_MANIFEST__.backend,
          expectedProjectRef: __TAYAR_MANIFEST__.expectedProjectRef, secretKey: environment.SUPABASE_SECRET_KEY }),
      });
    } catch { return Response.json({ error: 'Email worker unavailable.' }, { status: 503,
      headers: { 'cache-control': 'private, no-store' } }); }
  }
  if (route === 'stripe-checkout') {
    url.pathname = '/api/stripe-checkout'; url.searchParams.delete('tayarRoute');
    return serveOwnedStripeCheckout(new Request(url, request), {
      projectId: __TAYAR_MANIFEST__.projectId,
      applicationOrigin: __TAYAR_MANIFEST__.applicationOrigin,
      pagePaths: __TAYAR_MANIFEST__.pages.map(page => page.path),
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
  return serveOwnedApplicationRoute(new Request(url, request), __TAYAR_MANIFEST__, async pageId =>
    new Response(__TAYAR_PAGES__.get(pageId), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
}
