import { serveOwnedApplicationRoute, type OwnedApplicationRouteManifest } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';
import { serveOwnedStripeCheckout, type OwnedStripeCheckoutTarget } from './website-owned-stripe-checkout';

declare const __TAYAR_MANIFEST__: OwnedApplicationRouteManifest;
declare const __TAYAR_PAGES__: Map<string, string>;
declare const __TAYAR_PATHS__: Map<string, string>;
declare const __TAYAR_STRIPE_CHECKOUTS__: ReadonlyArray<OwnedStripeCheckoutTarget>;

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('tayarRoute');
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
