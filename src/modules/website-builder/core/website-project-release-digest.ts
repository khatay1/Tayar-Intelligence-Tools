function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Whole saved project handshake; object order differs in PostgreSQL JSONB.
 * Serialize first to match persisted JSON semantics, including omitted undefined.
 */
export async function websiteProjectReleaseDigest(snapshot: Record<string, unknown>): Promise<string> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid project snapshot.');
  const serialized = JSON.stringify(snapshot);
  if (new TextEncoder().encode(serialized).byteLength > 2_000_000) throw new Error('Project snapshot exceeds the release limit.');
  const bytes = new TextEncoder().encode(canonical(JSON.parse(serialized)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
