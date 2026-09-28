import { createApplicationBrowserSessionBridge, type ApplicationBrowserSessionOptions } from './application-browser-session';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDefinition, ApplicationTable } from './application-model';
import { readApplicationDefinition } from './application-validation';

export interface ApplicationPublicBackend {
  url: string;
  publishableKey: string;
  projectRef: string;
}

export interface ApplicationListOptions {
  limit?: number;
  offset?: number;
  sort?: { field: string; direction: 'asc' | 'desc' };
  filters?: Array<{ field: string; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike'; value: string | number | boolean }>;
}

export function canAccessApplicationPage(definition: ApplicationDefinition, pageId: string, user: { is_anonymous?: boolean } | null, roles: readonly string[] = []): boolean {
  const rule = definition.pageAccess.find(item => item.pageId === pageId);
  if (!rule || rule.access === 'public') return true;
  if (!definition.auth.enabled || !user || user.is_anonymous) return false;
  return rule.access === 'authenticated' || (rule.access === 'role' && !!rule.roleId && roles.includes(rule.roleId));
}

function projectRef(url: string): string {
  const parsed = new URL(url);
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  if (parsed.protocol !== 'https:' || !match || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Generated applications require a dedicated HTTPS Supabase project URL.');
  }
  return match[1];
}

function publicKey(key: string, ref: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Older Supabase projects expose a legacy anon JWT. Reject service_role tokens.
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const body = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown; ref?: unknown; iss?: unknown };
    return body.role === 'anon' && body.ref === ref && body.iss === 'supabase';
  } catch { return false; }
}

/** The browser receives only a public project key. It must never reuse Tayar's platform client. */
export function validateApplicationPublicBackend(config: ApplicationPublicBackend, platformUrl: string): void {
  const ref = projectRef(config.url);
  if (ref !== config.projectRef || ref === projectRef(platformUrl)) throw new Error('Application backend identity does not match its dedicated project.');
  if (!publicKey(config.publishableKey, ref)) throw new Error('Application backend requires a public anon or publishable key for this project.');
}

export function createIsolatedApplicationClient(config: ApplicationPublicBackend, platformUrl: string): SupabaseClient {
  validateApplicationPublicBackend(config, platformUrl);
  const ref = config.projectRef;
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
export function createApplicationDataRuntime(definition: ApplicationDefinition, config: ApplicationPublicBackend, platformUrl: string, browserSession?: ApplicationBrowserSessionOptions) {
  const app = readApplicationDefinition(definition);
  const client = createIsolatedApplicationClient(config, platformUrl);
  const sessionBridge = browserSession ? createApplicationBrowserSessionBridge(client, browserSession) : null;
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
    dispose() { sessionBridge?.dispose(); void client.auth.stopAutoRefresh().catch(() => {}); },
    auth: {
      async prepareNavigation() { await sessionBridge?.synchronize(); },
      async signUp(email: string, password: string) {
        if (!app.auth.enabled || !app.auth.signUpEnabled) throw new Error('Registration is disabled for this application.');
        const result = await client.auth.signUp({ email, password });
        if (result.error) throw new Error(result.error.message);
        if (result.data.session) await sessionBridge?.synchronize();
        return result.data;
      },
      async signIn(email: string, password: string) {
        if (!app.auth.enabled) throw new Error('Authentication is disabled for this application.');
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error) throw new Error(result.error.message);
        await sessionBridge?.synchronize();
        return result.data;
      },
      async currentUser() {
        if (!app.auth.enabled) return null;
        const result = await client.auth.getUser();
        if (result.error) throw new Error(result.error.message);
        return result.data.user;
      },
      async currentRoles() {
        if (!app.auth.enabled || !app.roles.length) return [];
        return checked(await client.rpc('app_my_roles')) as string[];
      },
      async isRoleAdministrator() {
        if (!app.auth.enabled || !app.roles.length) return false;
        return checked(await client.rpc('app_is_role_admin')) === true;
      },
      async canAccessPage(pageId: string) {
        const rule = app.pageAccess.find(item => item.pageId === pageId);
        if (!rule || rule.access === 'public') return true;
        if (!app.auth.enabled) return false;
        const session = await client.auth.getSession();
        if (session.error) throw new Error(session.error.message);
        if (!session.data.session) return false;
        const userResult = await client.auth.getUser();
        if (userResult.error) throw new Error(userResult.error.message);
        const user = userResult.data.user;
        if (!user || user.is_anonymous || rule.access === 'authenticated') return canAccessApplicationPage(app, pageId, user);
        const roles = checked(await client.rpc('app_my_roles')) as string[];
        return canAccessApplicationPage(app, pageId, user, Array.isArray(roles) ? roles : []);
      },
      async setUserRole(userId: string, roleId: string, enabled: boolean) {
        if (!app.auth.enabled || !app.roles.some(role => role.id === roleId)) throw new Error('Unknown application role.');
        if (typeof enabled !== 'boolean') throw new Error('Role state must be a boolean.');
        const result = await client.rpc('app_set_user_role', { target_user: rowId(userId), requested_role: roleId, enabled });
        if (result.error) throw new Error(result.error.message);
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
        await sessionBridge?.synchronize();
      },
    },
    async list(tableId: string, options: ApplicationListOptions = {}) {
      const target = table(tableId);
      const limit = options.limit ?? 25;
      const offset = options.offset ?? 0;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid pagination.');
      const fields = new Map(target.fields.map(field => [field.key, field]));
      const sortable = new Set(['id', 'created_at', 'updated_at', ...fields.keys()]);
      const sort = options.sort ?? { field: 'created_at', direction: 'desc' };
      if (!sortable.has(sort.field) || !['asc', 'desc'].includes(sort.direction)) throw new Error('Invalid sort field or direction.');
      if (options.filters !== undefined && (!Array.isArray(options.filters) || options.filters.length > 10)) throw new Error('Invalid query filters.');
      let query = client.from(`app_${target.key}`).select('*');
      for (const filter of options.filters ?? []) {
        if (!filter || !fields.has(filter.field) || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike'].includes(filter.operator)
          || !['string', 'number', 'boolean'].includes(typeof filter.value)
          || (typeof filter.value === 'string' && filter.value.length > 500)
          || (typeof filter.value === 'number' && !Number.isFinite(filter.value))
          || (filter.operator === 'ilike' && (!['text', 'enum'].includes(fields.get(filter.field)!.type) || typeof filter.value !== 'string'))) throw new Error('Invalid query filter.');
        switch (filter.operator) {
          case 'eq': query = query.eq(filter.field, filter.value); break;
          case 'neq': query = query.neq(filter.field, filter.value); break;
          case 'gt': query = query.gt(filter.field, filter.value); break;
          case 'gte': query = query.gte(filter.field, filter.value); break;
          case 'lt': query = query.lt(filter.field, filter.value); break;
          case 'lte': query = query.lte(filter.field, filter.value); break;
          case 'ilike': query = query.ilike(filter.field, String(filter.value)); break;
        }
      }
      return checked(await query.order(sort.field, { ascending: sort.direction === 'asc' }).range(offset, offset + limit - 1));
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
