/** Public project files contain opaque references, never credential values. */
export function isEditorSecretReference(value: unknown): value is string {
  return typeof value === 'string'
    && /^secret:\/\/[a-zA-Z0-9][a-zA-Z0-9/_:.-]{0,450}$/.test(value)
    && value !== 'secret://redacted';
}

/** A project Vault reference identifies one connection, field and environment. */
export function isEditorProjectSecretReferenceFor(value: unknown, connectionId: string, field: string, environment: string): boolean {
  if (!isEditorSecretReference(value)) return false;
  const match = /^secret:\/\/website\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,119})\/([a-zA-Z][a-zA-Z0-9_-]{0,63})\/(preview|staging|production)$/i.exec(value);
  return Boolean(match && match[2] === connectionId && match[3] === field && match[4] === environment);
}

/** Lexical preflight only. Server adapters must also validate DNS and forbid redirects. */
export function hasEmbeddedIntegrationCredentials(value: string): boolean {
  try {
    const url = new URL(value);
    return Boolean(url.username || url.password) || [...url.searchParams.keys()].some(key => /^(api[_-]?key|access[_-]?token|token|secret|password|authorization)$/i.test(key));
  } catch {
    return false;
  }
}

export function isPublicIntegrationEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) return false;
    if (!host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host)) return false;
    if (/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host)) return false;
    if (!/^[a-z0-9.-]+$/.test(host) || host.split('.').some(part => !part || part.startsWith('-') || part.endsWith('-'))) return false;
    for (const key of url.searchParams.keys()) {
      if (/^(api[_-]?key|access[_-]?token|token|secret|password|authorization)$/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
