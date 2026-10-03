import { serveOwnedApplicationRoute } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';

declare const __TAYAR_MANIFEST__: any;
declare const __TAYAR_PAGES__: Map<string, string>;
declare const __TAYAR_PATHS__: Map<string, string>;

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('tayarRoute');
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
