import type { ApplicationAuthScreenConfig, OwnedApplicationAuthScreenConfig } from '../core/application-auth-controller';
import type { ApplicationDefinition } from '../core/application-model';
import { applicationPageScript } from '../browser/generated/application-page-script';
import type { PublishedApplicationForm } from '../core/application-published-forms';
import type { PublishedApplicationDataView } from '../core/application-published-data-views';

/** Called only on an authorized private HTML response on its isolated origin.
 * The stored immutable page stays unchanged; only public runtime configuration
 * from that same release is added to this no-store response. */
export async function addApplicationPageBootstrap(response: Response, config: (ApplicationAuthScreenConfig | OwnedApplicationAuthScreenConfig) & {
  definition: ApplicationDefinition; paths: string[]; pageId: string;
  applicationForms: PublishedApplicationForm[];
  applicationDataViews?: PublishedApplicationDataView[];
}): Promise<Response> {
  const html = await response.text();
  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0) throw new Error('Application HTML is invalid.');
  const json = JSON.stringify(config).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const script = `<script data-tayar-application-runtime data-application="${json}">${applicationPageScript.replace(/<\/script/gi, '<\\/script')}</script>`;
  const headers = new Headers(response.headers);
  for (const header of ['content-length', 'etag', 'last-modified', 'content-encoding']) headers.delete(header);
  headers.set('vary', 'Authorization, Cookie, Accept');
  headers.set('referrer-policy', 'no-referrer');
  return new Response(html.slice(0, end) + script + html.slice(end), { status: response.status, headers });
}
