import type { ApplicationDefinition } from '../core/application-model';
import { readApplicationDefinition } from '../core/application-validation';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';

/** Validate the actual Auth service, not editable metadata or a successful database RPC.
 * Only the model's email/password provider is supported by this release.
 * Public settings do not prove redirect URLs, SMTP delivery or password protection.
 */
export async function assertDedicatedApplicationAuthSettings(
  definition: ApplicationDefinition,
  config: ApplicationPublicBackend,
  platformUrl: string,
): Promise<void> {
  if (typeof window !== 'undefined') throw new Error('Backend authentication verification requires a server runtime.');
  const backend = { ...config };
  validateApplicationPublicBackend(backend, platformUrl);
  const app = readApplicationDefinition(definition);
  let settings: Record<string, unknown>;
  try {
    const response = await fetch(`${backend.url}/auth/v1/settings`, {
      headers: { apikey: backend.publishableKey, Accept: 'application/json' },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error();
    const body = await response.text();
    if (body.length > 65_536) throw new Error();
    const raw: unknown = JSON.parse(body);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error();
    settings = raw as Record<string, unknown>;
  } catch { throw new Error('Dedicated application authentication settings are unavailable.'); }
  const providers = settings.external;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)
    || typeof settings.disable_signup !== 'boolean' || typeof settings.mailer_autoconfirm !== 'boolean') {
    throw new Error('Dedicated application authentication settings are invalid.');
  }
  const external = providers as Record<string, unknown>;
  if (external.email !== app.auth.enabled || external.anonymous_users !== false
    || settings.disable_signup !== !app.auth.signUpEnabled
    || (app.auth.enabled && settings.mailer_autoconfirm !== !app.auth.emailVerificationRequired)
    || Object.entries(external).some(([provider, enabled]) => typeof enabled !== 'boolean' || (provider !== 'email' && enabled))
    || ['saml_enabled', 'passkeys_enabled'].some(key => settings[key] !== undefined && settings[key] !== false)) {
    throw new Error('Dedicated application authentication settings do not match the project.');
  }
}
