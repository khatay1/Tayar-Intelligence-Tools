import type { WebsiteConnectionEndpointCatalog, WebsiteConnectionEndpointProvider } from './websiteConnectionEndpointCatalog';
import { beginWebsiteGitHubConnection, consumeWebsiteGitHubHandoffFragment, type GitHubHandoff } from './websiteGithubBrowserConnection';
import { beginWebsiteSupabaseConnection, consumeWebsiteSupabaseHandoffFragment, type SupabaseHandoff } from './websiteSupabaseBrowserConnection';
import { beginWebsiteVercelConnection, consumeWebsiteVercelHandoffFragment, type VercelHandoff } from './websiteVercelBrowserConnection';

export interface WebsiteConnectionScope {
  ownerId: string; projectId: string; loadSequence: number; isCurrent(): boolean;
}
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;
type StorageReader = Pick<Storage, 'getItem' | 'removeItem'>;
export type WebsiteConnectionHandoff = { provider: 'github'; handoff: GitHubHandoff }
  | { provider: 'supabase'; handoff: SupabaseHandoff }
  | { provider: 'vercel'; handoff: VercelHandoff };

/** Starts only explicitly available provider flows; the returned URL remains
 * provider-validated by the dedicated adapter before navigation is allowed. */
export async function beginWebsiteProviderConnection(input: { provider: WebsiteConnectionEndpointProvider;
  catalog: WebsiteConnectionEndpointCatalog; scope: WebsiteConnectionScope;
  environment: 'preview' | 'production'; storage: StorageWriter }): Promise<string> {
  const transport = input.catalog.transportFor(input.provider);
  if (!transport || !input.catalog.availableProviders.includes(input.provider))
    throw new Error('Connection setup is unavailable.');
  if (input.provider === 'github') return beginWebsiteGitHubConnection({ ...input, transport });
  if (input.provider === 'supabase') return beginWebsiteSupabaseConnection({ ...input, transport });
  return beginWebsiteVercelConnection({ ...input, transport });
}

/** Removes recognized callback fragments synchronously through the matching
 * adapter and returns only an opaque, scope-bound handoff. */
export function consumeWebsiteProviderHandoff(input: { scope: WebsiteConnectionScope;
  location: Pick<Location, 'hash' | 'pathname' | 'search'>; history: Pick<History, 'replaceState' | 'state'>;
  storage: StorageReader }): WebsiteConnectionHandoff | null {
  if (input.location.hash.startsWith('#tayar_github_handoff=')) {
    const handoff = consumeWebsiteGitHubHandoffFragment(input);
    return handoff ? { provider: 'github', handoff } : null;
  }
  if (input.location.hash.startsWith('#tayar_supabase_handoff=')) {
    const handoff = consumeWebsiteSupabaseHandoffFragment(input);
    return handoff ? { provider: 'supabase', handoff } : null;
  }
  if (input.location.hash.startsWith('#tayar_vercel_handoff=')) {
    const handoff = consumeWebsiteVercelHandoffFragment(input);
    return handoff ? { provider: 'vercel', handoff } : null;
  }
  return null;
}
