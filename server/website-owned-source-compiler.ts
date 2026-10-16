import { compileInitialApplicationSchema } from '../src/modules/website-builder/core/application-schema-sql';
import { analyzeByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';
import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { renderWebsiteApplicationSnapshot } from '../src/modules/website-builder/services/websiteApplicationRenderService';
import { validateGitHubSourceManifest, type GitHubSourceFile } from '../src/modules/website-builder/services/websiteGithubExportTransport';
import { websiteOwnedApplicationRuntimeTemplate } from './generated/website-owned-application-runtime-template';
import { readEditorIntegrationsFromProject, writeEditorIntegrationsToProject } from '../src/modules/website-builder/core/editor-integrations-project-host';
import { bindSavedOwnedEmailNotifications, compileOwnedEmailNotificationRules } from './website-owned-email-rules';
import { compileOwnedEmailQueueStatements } from './website-owned-email-schema';
import { createOwnedRuntimeSecretPlan } from './website-owned-runtime-secret-plan';
import { compileOwnedPaymentPackage } from './website-owned-payment-package';
import { bindOwnedReleaseIdentity } from './website-owned-release-identity';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeRoute = /^(?:[\p{L}\p{N}._-]+\/)*[\p{L}\p{N}._-]+\.html$/u;
const secrets = /(?:secret:\/\/|sb_secret_|\bservice_role\b|\b(?:sk|rk)_(?:test|live)_[a-zA-Z0-9]{8,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/i;

/** Source-only package. The caller must obtain the snapshot and customer binding
 * from trusted owner-scoped persistence; this function never reads browser input. */
export async function compileWebsiteOwnedApplicationSource(snapshot: Record<string, unknown>, input: {
  projectId: string; applicationOrigin: string; expectedProjectRef: string; backend: ApplicationPublicBackend;
  environment: 'preview' | 'production'; platformOrigin: string; platformUrl: string;
}): Promise<GitHubSourceFile[]> {
  if (typeof window !== 'undefined' || !uuid.test(input.projectId)) throw new Error('Customer source scope is unavailable.');
  const origin = new URL(input.applicationOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== input.applicationOrigin
    || origin.hostname.endsWith('.supabase.co') || origin.origin === new URL(input.backend.url).origin
    || ![input.platformOrigin, input.platformUrl].every(value => new URL(value).protocol === 'https:')) {
    throw new Error('Customer source origin is unavailable.');
  }
  validateOwnedApplicationPublicBackend(input.backend, input.expectedProjectRef);
  // Source compilation includes the complete order runtime. Publish readiness
  // still uses the default capability gate until catalog/webhook verification.
  const capabilities = analyzeByoSourceCapabilities(snapshot, input.environment, { stripeOrderRuntimeCompiled: true });
  if (capabilities.blockers.length || !capabilities.needs.database || !capabilities.definition.auth.enabled) {
    throw new Error('Customer application source requires supported Auth/data without unhandled capabilities.');
  }
  const hasEmailNotifications = capabilities.definition.tables.some(table => table.notifications?.length);
  const payment = compileOwnedPaymentPackage(capabilities.definition, input.projectId);
  const email = hasEmailNotifications ? bindSavedOwnedEmailNotifications({ projectId: input.projectId,
    definition: capabilities.definition, environment: input.environment,
    integrations: readEditorIntegrationsFromProject(snapshot) }) : { rules: [], connections: [] };
  // Rendering has no integration side effects. Resend is mounted below as an
  // owned server worker, so keep only renderer-supported Stripe metadata here.
  const renderSnapshot = email.connections.length ? writeEditorIntegrationsToProject(snapshot, { version: 1,
    connections: readEditorIntegrationsFromProject(snapshot).connections.filter(connection => connection.providerId === 'stripe') }) : snapshot;
  const rendered = await renderWebsiteApplicationSnapshot(renderSnapshot);
  const secretPlan = createOwnedRuntimeSecretPlan({ environment: input.environment, capabilities,
    emailConnections: email.connections.map(connection => ({ id: connection.id, from: connection.from })) });
  const again = await renderWebsiteApplicationSnapshot(renderSnapshot);
  if (JSON.stringify(rendered) !== JSON.stringify(again) || rendered.length !== capabilities.pageIds.length) {
    throw new Error('Customer application rendering is not deterministic.');
  }
  const pages = snapshot.pages as Array<{ id: string; language?: string; sections: unknown[] }>;
  const routes = rendered.map(file => {
    const page = pages.find(item => item.id === file.pageId);
    if (!page || !safeRoute.test(file.name) || file.name.split('/').some(part => part === '.' || part === '..')
      || file.content.length > 500_000 || secrets.test(file.content)
      || file.content.includes(input.platformOrigin) || file.content.includes(input.platformUrl)) {
      throw new Error('Customer application page contains unsupported source.');
    }
    return { path: `/${file.name}`, pageId: file.pageId, language: ['ar', 'sv'].includes(page.language ?? '') ? page.language : 'en',
      sections: page.sections, html: file.content };
  });
  const routeKeys = new Set(routes.map(route => route.path.toLowerCase()));
  if (routeKeys.size !== routes.length) throw new Error('Customer application routes are ambiguous.');
  const manifest = { projectId: input.projectId, applicationOrigin: input.applicationOrigin,
    expectedProjectRef: input.expectedProjectRef, backend: input.backend, definition: capabilities.definition,
    pages: routes.map(({ html: _html, ...page }) => page) };
  const runtime = await bindOwnedReleaseIdentity(`const __TAYAR_MANIFEST__ = ${JSON.stringify(manifest)};
const __TAYAR_PAGES__ = new Map(${JSON.stringify(routes.map(route => [route.pageId, route.html]))});
const __TAYAR_PATHS__ = new Map(${JSON.stringify(routes.map(route => [route.pageId, route.path]))});
const __TAYAR_STRIPE_CHECKOUTS__ = ${JSON.stringify(capabilities.stripeCheckouts)};
const __TAYAR_SECRET_PLAN__ = ${JSON.stringify(secretPlan)};
${websiteOwnedApplicationRuntimeTemplate}`, input.projectId, input.environment);
  if (/(?:secret:\/\/|sb_secret_|\b(?:sk|rk)_(?:test|live)_[a-zA-Z0-9]{8,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/i.test(runtime)
    || runtime.includes(input.platformOrigin) || runtime.includes(input.platformUrl)) {
    throw new Error('Customer application runtime contains platform or secret material.');
  }
  const rewrites = [
    ...payment.rewrites,
    { source: '/api/application-session', destination: '/api/application?tayarRoute=session' },
    ...(email.connections.length ? [{ source: '/api/application-email-worker', destination: '/api/application?tayarRoute=email-worker' }] : []),
    ...(capabilities.stripeCheckouts.length ? [{ source: '/api/stripe-checkout', destination: '/api/application?tayarRoute=stripe-checkout' }] : []),
    ...routes.map(route => ({ source: route.path, destination: `/api/application?tayarRoute=${encodeURIComponent(route.pageId)}` })),
    { source: '/', destination: `/api/application?tayarRoute=${encodeURIComponent(rendered.find(file => file.name === 'index.html')!.pageId)}` },
  ];
  const schema = ['begin;', ...compileInitialApplicationSchema(capabilities.definition,
    { emailNotificationsProvisioned: email.connections.length > 0, stripeOrderPaymentsProvisioned: payment.statements.length > 0 }),
    ...payment.statements,
    ...(email.connections.length ? [...compileOwnedEmailQueueStatements(input.projectId),
      ...compileOwnedEmailNotificationRules({ definition: capabilities.definition, environment: input.environment, rules: email.rules })] : []),
    'commit;'];
  const files = [
    { path: 'package.json', content: JSON.stringify({ private: true, type: 'commonjs' }, null, 2) + '\n' },
    { path: 'vercel.json', content: JSON.stringify({ $schema: 'https://openapi.vercel.sh/vercel.json', framework: null,
      buildCommand: null, rewrites }, null, 2) + '\n' },
    { path: 'api/application.js', content: runtime },
    { path: 'database/schema.sql', content: '-- Initial schema for a NEW dedicated Supabase project only. Do not reapply to an existing database.\n' + schema.join('\n') + '\n' },
    { path: 'application-definition.json', content: JSON.stringify(capabilities.definition, null, 2) + '\n' },
    { path: 'runtime-environment-plan.json', content: JSON.stringify(secretPlan, null, 2) + '\n' },
    { path: 'HANDOVER.md', content: `# Your application

This repository, hosting project and database belong to your connected provider accounts.
The deployed application runs on your hosting and dedicated Supabase project without calling the Tayar platform.

Application origin: ${input.applicationOrigin}
Supabase project reference: ${input.expectedProjectRef}

## Database source

The repository includes application-definition.json and database/schema.sql so another developer can maintain the schema and access policies without Tayar.
The SQL is an initial schema for a NEW dedicated Supabase project only; it is not a data backup or a migration to rerun on an existing database.
Use your provider backup/restore tools to preserve actual records. Reconfigure Auth redirects and hosting runtime credentials when rebuilding on a different project.

## After delivery

You manage provider billing, backups, user administration, credential rotation, monitoring and future maintenance.
Keep the application runtime credentials configured in your hosting account. They are separate from the OAuth permissions used by Tayar to set up the project.
The repository includes runtime-environment-plan.json. It contains variable names and purposes only, never credential values. Configure every listed variable in the matching Preview or Production environment before deployment.
Before revoking Tayar setup access, test sign-in, a bound form submission and access denial on protected pages on your deployed domain.
Revoke the setup applications from your provider account settings after verifying the handover. Do not remove runtime environment variables or delete the repository, database or hosting project.
A Tayar disconnect action may also clean runtime credentials for security; do not use it as a completed-project handover without checking its effect first.
Future edits require a new authorized connection. No patient or user records, passwords or provider secrets are included in this handover document.
` },
  ];
  validateGitHubSourceManifest(files);
  return files;
}
