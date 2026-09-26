import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDefinition, ApplicationTable } from './application-model';
import { readApplicationDefinition } from './application-validation';

export interface ApplicationPublicBackend {
  url: string;
  publishableKey: string;
  projectRef: string;
}

function projectRef(url: string): string {
  const parsed = new URL(url);
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  if (parsed.protocol !== 'https:' || !match || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Generated applications require a dedicated HTTPS Supabase project URL.');
  }
  return match[1];
}

function publicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Older Supabase projects expose a legacy anon JWT. Reject service_role tokens.
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const body = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
    return body.role === 'anon';
  } catch { return false; }
}

/** The browser receives only a public project key. It must never reuse Tayar's platform client. */
export function createIsolatedApplicationClient(config: ApplicationPublicBackend, platformUrl: string): SupabaseClient {
  const ref = projectRef(config.url);
  if (ref !== config.projectRef || ref === projectRef(platformUrl)) throw new Error('Application backend identity does not match its dedicated project.');
  if (!publicKey(config.publishableKey)) throw new Error('Application backend requires a public anon or publishable key.');
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: `tayar-app-${ref}-auth` },
  });
}

const rowId = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('A valid record ID is required.');
  return value;
};

function writable(table: ApplicationTable, input: Record<string, unknown>): Record<string, unknown> {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Record values must be an object.');
  const allowed = new Set(table.fields.map(field => field.key));
  const values = Object.entries(input);
  if (!values.length || values.some(([key]) => !allowed.has(key))) throw new Error('Only declared application fields can be written.');
  return Object.fromEntries(values);
}

/** Client operations always target the dedicated app project; PostgreSQL RLS is the authority. */
export function createApplicationDataRuntime(definition: ApplicationDefinition, config: ApplicationPublicBackend, platformUrl: string) {
  const app = readApplicationDefinition(definition);
  const client = createIsolatedApplicationClient(config, platformUrl);
  const table = (id: string) => {
    const found = app.tables.find(item => item.id === id);
    if (!found) throw new Error('Unknown application table.');
    return found;
  };
  const checked = <T>(result: { data: T; error: { message: string } | null }): T => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };
  return {
    auth: {
      async signUp(email: string, password: string) {
        if (!app.auth.enabled || !app.auth.signUpEnabled) throw new Error('Registration is disabled for this application.');
        const result = await client.auth.signUp({ email, password });
        if (result.error) throw new Error(result.error.message);
        return result.data;
      },
      async signIn(email: string, password: string) {
        if (!app.auth.enabled) throw new Error('Authentication is disabled for this application.');
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error) throw new Error(result.error.message);
        return result.data;
      },
      async currentUser() {
        if (!app.auth.enabled) return null;
        const result = await client.auth.getUser();
        if (result.error) throw new Error(result.error.message);
        return result.data.user;
      },
      async requestPasswordReset(email: string) {
        if (!app.auth.enabled) throw new Error('Authentication is disabled for this application.');
        const result = await client.auth.resetPasswordForEmail(email);
        if (result.error) throw new Error(result.error.message);
        return result.data;
      },
      async updatePassword(password: string) {
        if (!app.auth.enabled) throw new Error('Authentication is disabled for this application.');
        const result = await client.auth.updateUser({ password });
        if (result.error) throw new Error(result.error.message);
        return result.data;
      },
      async signOut() {
        if (!app.auth.enabled) return;
        const result = await client.auth.signOut();
        if (result.error) throw new Error(result.error.message);
      },
    },
    async list(tableId: string, options: { limit?: number; offset?: number } = {}) {
      const target = table(tableId);
      const limit = options.limit ?? 25;
      const offset = options.offset ?? 0;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid pagination.');
      return checked(await client.from(`app_${target.key}`).select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1));
    },
    async get(tableId: string, id: string) {
      const target = table(tableId);
      return checked(await client.from(`app_${target.key}`).select('*').eq('id', rowId(id)).maybeSingle());
    },
    async create(tableId: string, input: Record<string, unknown>) {
      const target = table(tableId);
      return checked(await client.from(`app_${target.key}`).insert(writable(target, input)).select('*').single());
    },
    async update(tableId: string, id: string, input: Record<string, unknown>) {
      const target = table(tableId);
      const row = checked(await client.from(`app_${target.key}`).update(writable(target, input)).eq('id', rowId(id)).select('*').maybeSingle());
      if (!row) throw new Error('Record not found or update not permitted.');
      return row;
    },
    async remove(tableId: string, id: string) {
      const target = table(tableId);
      const row = checked(await client.from(`app_${target.key}`).delete().eq('id', rowId(id)).select('id').maybeSingle());
      if (!row) throw new Error('Record not found or deletion not permitted.');
      return row;
    },
  };
}
