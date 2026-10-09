import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationPublicBackend } from './application-data-runtime';
import type { ApplicationTable } from './application-model';
import { applicationFileId, applicationFileExtension } from './application-files';

/** Each request uses a captured JWT instead of the mutable shared Auth client.
 * Late responses never become visible after sign-out, account switch or disposal. */
export function createApplicationFilesRuntime(config: ApplicationPublicBackend, authClient: SupabaseClient,
  table: (id: string) => ApplicationTable, capture: (expectedUserId: string) => Promise<string | undefined>, closed: () => boolean) {
  const assertIdentity = async (owner: string) => {
    const session = await authClient.auth.getSession();
    if (closed() || session.error || session.data.session?.user.id !== owner) throw new Error('Attachment identity changed.');
  };
  const bucket = async (tableId: string, owner: string) => {
    const target = table(tableId);
    if (!target.attachments) throw new Error('Attachments are disabled.');
    await assertIdentity(owner);
    const token = await capture(owner);
    if (!token) throw new Error('Attachment identity unavailable.');
    await assertIdentity(owner);
    const client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    return { storage: client.storage.from(`app_files_${target.key}`), rule: target.attachments };
  };
  const path = (recordId: string, fileId: string) => `${applicationFileId(recordId)}/${applicationFileId(fileId)}`;
  return {
    async list(tableId: string, recordId: string, owner: string, page = 0) {
      if (!Number.isSafeInteger(page) || page < 0 || page > 100_000) throw new Error('Invalid attachment page.');
      const { storage } = await bucket(tableId, owner);
      const result = await storage.list(applicationFileId(recordId), { limit: 21, offset: page * 20, sortBy: { column: 'name', order: 'asc' } });
      await assertIdentity(owner);
      if (result.error || !result.data || result.data.some(file => !file.id)) throw new Error('Could not list attachments.');
      return { files: result.data.slice(0, 20).map(file => ({ id: applicationFileId(file.name), size: Number(file.metadata?.size ?? 0), extension: applicationFileExtension(file.metadata?.mimetype) })), hasNext: result.data.length > 20 };
    },
    async upload(tableId: string, recordId: string, fileId: string, file: Blob, owner: string) {
      const { storage, rule } = await bucket(tableId, owner), key = path(recordId, fileId);
      if (!(file instanceof Blob) || !file.size || file.size > rule.maxBytes || !rule.mimeTypes.includes(file.type)) throw new Error('Attachment type or size is not allowed.');
      const result = await storage.upload(key, file, { upsert: false, contentType: file.type, cacheControl: '0' });
      await assertIdentity(owner);
      if (result.error) {
        // Retry the same immutable path. A duplicate is success only if the bytes
        // match; never overwrite another file or infer success from a 409 alone.
        const stored = await storage.download(key);
        await assertIdentity(owner);
        if (stored.error || !stored.data || stored.data.size !== file.size) throw new Error('Attachment result is uncertain. Retry the same file.');
        const digest = async (value: Blob) => new Uint8Array(await crypto.subtle.digest('SHA-256', await value.arrayBuffer()));
        const [left, right] = await Promise.all([digest(file), digest(stored.data)]);
        await assertIdentity(owner);
        if (left.some((value, index) => value !== right[index])) throw new Error('Attachment identity already belongs to different bytes.');
      }
    },
    async download(tableId: string, recordId: string, fileId: string, owner: string) {
      const { storage, rule } = await bucket(tableId, owner);
      const result = await storage.download(path(recordId, fileId));
      await assertIdentity(owner);
      if (result.error || !result.data || result.data.size > rule.maxBytes) throw new Error('Could not download attachment.');
      // Downloads are never rendered inline as executable content.
      return new Blob([result.data], { type: 'application/octet-stream' });
    },
    async remove(tableId: string, recordId: string, fileId: string, owner: string) {
      const { storage } = await bucket(tableId, owner);
      const result = await storage.remove([path(recordId, fileId)]);
      await assertIdentity(owner);
      if (result.error) throw new Error('Could not delete attachment.');
    },
  };
}
