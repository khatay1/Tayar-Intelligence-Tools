const WEBSITE_PROVIDER_HANDOFF_HASH = /^#tayar_(?:github|supabase|vercel)_handoff=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Recognizes only opaque callback fragments issued by Tayar's provider
 * connection endpoints. Each adapter still validates the pending account and
 * project scope before consuming the handoff. */
export function isWebsiteProviderHandoffHash(hash: string): boolean {
  return WEBSITE_PROVIDER_HANDOFF_HASH.test(hash);
}
