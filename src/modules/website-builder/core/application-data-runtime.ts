import { ApplicationBookingRejected, applicationBookingDatabaseRejection, validateApplicationBookingValues } from './application-booking';
import { createApplicationBrowserSessionBridge, createOwnedApplicationBrowserSessionBridge,
  type ApplicationBrowserSessionOptions } from './application-browser-session';
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

/** The expected ref comes from the trusted, verified customer Supabase binding.
 * A project snapshot cannot choose it, and only a public key reaches the browser. */
export function validateOwnedApplicationPublicBackend(config: ApplicationPublicBackend, expectedProjectRef: string): void {
  if (!/^[a-z0-9]{20}$/.test(expectedProjectRef) || projectRef(config.url) !== expectedProjectRef
    || config.projectRef !== expectedProjectRef || !publicKey(config.publishableKey, expectedProjectRef)) {
    throw new Error('Customer Supabase backend identity is unavailable.');
  }
}

export function createOwnedApplicationClient(config: ApplicationPublicBackend, expectedProjectRef: string): SupabaseClient {
  validateOwnedApplicationPublicBackend(config, expectedProjectRef);
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce',
      storageKey: `tayar-app-${expectedProjectRef}-auth` },
  });
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

function sameRequestField(type: ApplicationTable['fields'][number]['type'], submitted: unknown, stored: unknown): boolean {
  if (type === 'datetime' && typeof submitted === 'string' && typeof stored === 'string') {
    const left = Date.parse(submitted), right = Date.parse(stored);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
  }
  if ((type === 'uuid' || type === 'reference') && typeof submitted === 'string' && typeof stored === 'string') {
    return submitted.toLowerCase() === stored.toLowerCase();
  }
  if (type === 'json') {
    const canonical = (value: unknown): string => JSON.stringify(value, (_, item: unknown) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
    return canonical(submitted) === canonical(stored);
  }
  return submitted === stored;
}

/** Client operations always target the dedicated app project; PostgreSQL RLS is the authority. */
export function createApplicationDataRuntime(definition: ApplicationDefinition, config: ApplicationPublicBackend, platformUrl: string, browserSession?: ApplicationBrowserSessionOptions) {
  const client = createIsolatedApplicationClient(config, platformUrl);
  return buildApplicationDataRuntime(definition, client,
    browserSession ? createApplicationBrowserSessionBridge(client, browserSession) : null);
}

/** Customer-owned browser execution uses the same validated Auth/CRUD model.
 * Protected page delivery still requires a separately verified server route. */
export function createOwnedApplicationDataRuntime(definition: ApplicationDefinition, config: ApplicationPublicBackend,
  expectedProjectRef: string, browserSession?: { projectId: string; applicationOrigin: string }) {
  const client = createOwnedApplicationClient(config, expectedProjectRef);
  return buildApplicationDataRuntime(definition, client,
    browserSession ? createOwnedApplicationBrowserSessionBridge(client, browserSession) : null);
}

function buildApplicationDataRuntime(definition: ApplicationDefinition, client: SupabaseClient,
  sessionBridge: ReturnType<typeof createApplicationBrowserSessionBridge> | null) {
  const app = readApplicationDefinition(definition);
  const table = (id: string) => {
    const found = app.tables.find(item => item.id === id);
    if (!found) throw new Error('Unknown application table.');
    return found;
  };
  const checked = <T>(result: { data: T; error: { message: string } | null }): T => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };
  const captureWriteToken = async (expectedUserId?: string) => {
    if (expectedUserId === undefined) return undefined;
    rowId(expectedUserId);
    const session = await client.auth.getSession();
    const token = session.data.session?.access_token;
    if (session.error || !token) throw new Error('Application write identity is unavailable.');
    const identity = await client.auth.getUser(token);
    if (identity.error || !identity.data.user || identity.data.user.is_anonymous || identity.data.user.id !== expectedUserId) throw new Error('Application write identity changed.');
    return token;
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
    /** The UUID is stable for one intentional submission. The dedicated database
     * enforces owner-scoped uniqueness; a lost insert response is confirmed only
     * if the same user's readable row still matches every submitted field. */
    async createOnce(tableId: string, input: Record<string, unknown>, requestId: string, expectedUserId?: string): Promise<'created' | 'already-created'> {
      const target = table(tableId);
      const request = rowId(requestId).toLowerCase();
      const values = writable(target, input);
      validateApplicationBookingValues(target, values);
      const token = await captureWriteToken(expectedUserId);
      const currentOwner = async () => {
        const identity = await client.auth.getUser();
        const user = identity.data.user;
        if (identity.error || !user || user.is_anonymous) throw new Error();
        return rowId(user.id);
      };
      let owner: string;
      try { owner = await currentOwner(); }
      catch { throw new Error('Application submission identity is unavailable.'); }
      if (expectedUserId !== undefined && owner !== expectedUserId) throw new Error('Application write identity changed.');
      let rejection: ApplicationBookingRejected | undefined;
      try {
        const query = client.from(`app_${target.key}`).insert({ ...values, owner_id: owner, _tayar_request_id: request });
        if (token) query.setHeader('Authorization', `Bearer ${token}`);
        const result = await query;
        if (result.error) rejection = applicationBookingDatabaseRejection(target, result.error);
        if (!result.error) {
          try { if (await currentOwner() === owner) return 'created'; }
          catch { /* A changed/unavailable session makes the commit uncertain. */ }
          throw new Error('Application submission outcome is uncertain.');
        }
      } catch { /* The database may have committed before transport failed. */ }
      if (target.permissions.some(rule => rule.operation === 'read')) {
        try {
          if (await currentOwner() !== owner) throw new Error();
          const lookup = await client.from(`app_${target.key}`).select(['id', ...Object.keys(values)].join(','))
            .eq('owner_id', owner).eq('_tayar_request_id', request).maybeSingle();
          const row = lookup.data as unknown as Record<string, unknown> | null;
          if (!lookup.error && row && typeof row.id === 'string' && Object.entries(values).every(([key, value]) => {
            const field = target.fields.find(item => item.key === key);
            return !!field && Object.prototype.hasOwnProperty.call(row, key) && sameRequestField(field.type, value, row[key]);
          })) return 'already-created';
        } catch { /* Unknown commit outcome remains uncertain. */ }
      }
      if (rejection) throw rejection;
      throw new Error('Application submission outcome is uncertain.');
    },
    async update(tableId: string, id: string, input: Record<string, unknown>, expectedUserId?: string) {
      const target = table(tableId);
      const token = await captureWriteToken(expectedUserId);
      const query = client.from(`app_${target.key}`).update(writable(target, input)).eq('id', rowId(id)).select('*').maybeSingle();
      if (token) query.setHeader('Authorization', `Bearer ${token}`);
      const result = await query;
      if (result.error) { const rejected = applicationBookingDatabaseRejection(target, result.error); if (rejected) throw rejected; }
      const row = checked(result);
      if (!row) throw new Error('Record not found or update not permitted.');
      return row;
    },
    async remove(tableId: string, id: string, expectedUserId?: string) {
      const target = table(tableId);
      const token = await captureWriteToken(expectedUserId);
      const query = client.from(`app_${target.key}`).delete().eq('id', rowId(id)).select('id').maybeSingle();
      if (token) query.setHeader('Authorization', `Bearer ${token}`);
      const result = await query;
      if (result.error) { const rejected = applicationBookingDatabaseRejection(target, result.error); if (rejected) throw rejected; }
      const row = checked(result);
      if (!row) throw new Error('Record not found or deletion not permitted.');
      return row;
    },
  };
}
