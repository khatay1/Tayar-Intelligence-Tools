/** Server-owned connection metadata. OAuth grants and runtime secrets belong in
 * separate encrypted custody, never in an editable project or exported source. */
export type InfrastructureProvider = 'github' | 'supabase' | 'vercel' | 'stripe' | 'external';
export type InfrastructureEnvironment = 'preview' | 'production';
export type InfrastructureStatus = 'disconnected' | 'connecting' | 'connected' | 'permissions-missing'
  | 'setup-incomplete' | 'outdated-schema' | 'deployment-failed' | 'credentials-revoked' | 'ready';

export interface InfrastructureConnection {
  id: string;
  ownerId: string;
  projectId: string;
  provider: InfrastructureProvider;
  environment: InfrastructureEnvironment;
  /** Provider account/team ID, distinct from a human-readable label. */
  accountId: string;
  targetId: string | null;
  permissions: string[];
  status: InfrastructureStatus;
  version: number;
  operationId: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

export type PublicInfrastructureConnection = Omit<InfrastructureConnection, 'operationId'>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity = /^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$/;
const permission = /^[a-zA-Z0-9][a-zA-Z0-9_:./-]{0,119}$/;
const providers: InfrastructureProvider[] = ['github', 'supabase', 'vercel', 'stripe', 'external'];
const statuses: InfrastructureStatus[] = ['disconnected', 'connecting', 'connected', 'permissions-missing', 'setup-incomplete', 'outdated-schema', 'deployment-failed', 'credentials-revoked', 'ready'];

export function assertInfrastructureConnection(value: InfrastructureConnection): InfrastructureConnection {
  if (!uuid.test(value.id) || !uuid.test(value.ownerId) || !uuid.test(value.projectId)
    || !providers.includes(value.provider) || !['preview', 'production'].includes(value.environment)
    || !identity.test(value.accountId) || (value.targetId !== null && !identity.test(value.targetId))
    || !statuses.includes(value.status) || !Number.isSafeInteger(value.version) || value.version < 1
    || !Array.isArray(value.permissions) || value.permissions.length > 40
    || value.permissions.some(scope => typeof scope !== 'string' || !permission.test(scope))
    || new Set(value.permissions).size !== value.permissions.length
    || (value.operationId !== null && !uuid.test(value.operationId))
    || !Number.isFinite(Date.parse(value.updatedAt))
    || (value.verifiedAt !== null && !Number.isFinite(Date.parse(value.verifiedAt)))) throw new Error('Invalid infrastructure connection.');
  if ((value.status === 'connecting') !== (value.operationId !== null)) throw new Error('Invalid infrastructure operation.');
  if (['connected', 'ready'].includes(value.status) && !value.verifiedAt) throw new Error('Infrastructure is not verified.');
  if (value.status === 'ready' && (!value.targetId || !value.verifiedAt)) throw new Error('Infrastructure is not verified.');
  return value;
}

/** Only server-owned records may be projected to UI. This copy has no token,
 * operation nonce or provider response payload. */
export function publicInfrastructureConnection(value: InfrastructureConnection): PublicInfrastructureConnection {
  const source = assertInfrastructureConnection(value);
  return { id: source.id, ownerId: source.ownerId, projectId: source.projectId, provider: source.provider,
    environment: source.environment, accountId: source.accountId, targetId: source.targetId,
    permissions: [...source.permissions], status: source.status, version: source.version,
    verifiedAt: source.verifiedAt, updatedAt: source.updatedAt };
}

export interface InfrastructureOperationScope {
  ownerId: string;
  projectId: string;
  provider: InfrastructureProvider;
  environment: InfrastructureEnvironment;
  accountId: string;
  expectedVersion: number;
}

function matches(value: InfrastructureConnection, scope: InfrastructureOperationScope): boolean {
  return value.ownerId === scope.ownerId && value.projectId === scope.projectId
    && value.provider === scope.provider && value.environment === scope.environment
    && value.accountId === scope.accountId && value.version === scope.expectedVersion;
}

/** Caller supplies a fresh random UUID; persistence must compare-and-swap the version. */
export function beginInfrastructureOperation(value: InfrastructureConnection, scope: InfrastructureOperationScope, operationId: string, now: string): InfrastructureConnection {
  assertInfrastructureConnection(value);
  if (!matches(value, scope) || value.operationId || !uuid.test(operationId) || !Number.isFinite(Date.parse(now))) throw new Error('Infrastructure connection changed.');
  return { ...value, status: 'connecting', operationId, version: value.version + 1, updatedAt: now };
}

/** A successful API request is not proof of readiness. The trusted worker must
 * supply observed status after reading the actual remote target. */
export function finishInfrastructureOperation(value: InfrastructureConnection, scope: InfrastructureOperationScope,
  operationId: string, result: { status: Exclude<InfrastructureStatus, 'connecting'>; targetId: string | null; permissions: string[]; verifiedAt: string | null }, now: string): InfrastructureConnection {
  assertInfrastructureConnection(value);
  if (!matches(value, scope) || value.operationId !== operationId || !uuid.test(operationId)
    || !Number.isFinite(Date.parse(now)) || !statuses.includes(result.status)) throw new Error('Infrastructure connection changed.');
  return assertInfrastructureConnection({ ...value, ...result, permissions: [...result.permissions],
    operationId: null, version: value.version + 1, updatedAt: now });
}

export function disconnectInfrastructureConnection(value: InfrastructureConnection, scope: InfrastructureOperationScope, now: string): InfrastructureConnection {
  assertInfrastructureConnection(value);
  if (!matches(value, scope) || !Number.isFinite(Date.parse(now))) throw new Error('Infrastructure connection changed.');
  return { ...value, status: 'disconnected', targetId: null, permissions: [], verifiedAt: null,
    operationId: null, version: value.version + 1, updatedAt: now };
}
