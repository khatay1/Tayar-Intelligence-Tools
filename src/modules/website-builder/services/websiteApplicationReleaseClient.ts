import type { SupabaseClient } from '@supabase/supabase-js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface WebsiteApplicationReleaseStatus {
  privateMode: boolean;
  versionId: string | null;
  publishingAvailable: boolean;
}
export type WebsiteApplicationReleaseOutcome = 'selected' | 'recorded' | 'unresolved';

/** Read-only browser boundary. Never return raw function errors or response fields. */
export function createWebsiteApplicationReleaseClient(client: Pick<SupabaseClient, 'functions'>) {
  async function invoke(body: Record<string, string>, isCurrent: () => boolean) {
    if (!uuid.test(body.projectId) || !isCurrent()) throw new Error('Private release status is unavailable.');
    const result = await client.functions.invoke('website-application-release', { body });
    if (!isCurrent() || result.error || result.data?.projectId !== body.projectId || result.data?.operation !== body.operation) throw new Error();
    return result.data;
  }
  return {
    async read(projectId: string, isCurrent: () => boolean): Promise<WebsiteApplicationReleaseStatus> {
      try {
        const data = await invoke({ operation: 'status', projectId }, isCurrent);
        if (typeof data.privateMode !== 'boolean' || typeof data.publishingAvailable !== 'boolean'
          || (data.versionId !== null && (typeof data.versionId !== 'string' || !uuid.test(data.versionId)))
          || (!data.privateMode && data.versionId !== null)) throw new Error();
        return { privateMode: data.privateMode, versionId: data.versionId, publishingAvailable: data.publishingAvailable };
      } catch { throw new Error('Private release status is unavailable.'); }
    },
    async inspect(projectId: string, versionId: string, isCurrent: () => boolean): Promise<WebsiteApplicationReleaseOutcome> {
      try {
        if (!uuid.test(versionId)) throw new Error();
        const data = await invoke({ operation: 'outcome', projectId, versionId }, isCurrent);
        if (data.versionId !== versionId || !['selected', 'recorded', 'unresolved'].includes(data.status)) throw new Error();
        return data.status;
      } catch { throw new Error('Private release status is unavailable.'); }
    },
  };
}
