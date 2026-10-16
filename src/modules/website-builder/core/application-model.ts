/** Editable application definitions only. Rows, users, role assignments and secrets live on the server. */
export type ApplicationFieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'uuid' | 'json' | 'enum' | 'reference';
export interface ApplicationFormula { operation: 'sum' | 'subtract' | 'multiply'; fieldIds: string[] }
export interface ApplicationField {
  id: string;
  key: string;
  name: string;
  type: ApplicationFieldType;
  required: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: string | number | boolean | null;
  options?: string[];
  referenceTableId?: string;
  /** Server-computed numeric value. Formula sources must be ordinary required
   * numeric fields so callers can never submit or overwrite the result. */
  formula?: ApplicationFormula;
}
export type ApplicationDataOperation = 'read' | 'create' | 'update' | 'delete';
export type ApplicationAccess = 'public' | 'authenticated' | 'owner' | 'role';
export interface ApplicationPermission {
  operation: ApplicationDataOperation;
  access: ApplicationAccess;
  roleId?: string;
}
export interface ApplicationBookingRule {
  resourceFieldId: string;
  additionalResourceFieldIds?: string[];
  startFieldId: string;
  endFieldId: string;
  statusFieldId?: string;
  blockingStatuses?: string[];
  waitlistStatus?: string;
  schedule?: ApplicationBookingSchedule;
  recurrence?: { timeZone: string; maxOccurrences: number };
}
export interface ApplicationBookingSchedule {
  timeZone: string;
  weekly: Array<{ day: number; startMinute: number; endMinute: number }>;
  maxDurationMinutes: number;
  exceptions?: Array<{ date: string; windows: Array<{ startMinute: number; endMinute: number }> }>;
}
export interface ApplicationCounterRule { fieldId: string; minimum: number; maximum?: number; integer: boolean }
/** Creates one parent record and one or more line records while changing every
 * referenced counter in the same database transaction. */
export interface ApplicationTransactionRule {
  itemTableId: string;
  lineTableId: string;
  lineTransactionFieldId: string;
  lineItemFieldId: string;
  lineQuantityFieldId: string;
  counterDirection: 'decrement' | 'increment';
}
/** Server-priced Stripe payment for an authenticated transaction. Amounts are
 * stored in the currency's minor unit and refunds require an explicit role. */
export interface ApplicationPaymentRule {
  provider: 'stripe';
  currency: string;
  itemUnitAmountFieldId: string;
  refundRoleId: string;
}
export interface ApplicationWorkflowTransition {
  id: string;
  label: string;
  from: string[];
  to: string;
  access: Exclude<ApplicationAccess, 'public'>;
  roleId?: string;
  /** Optional predicate group checked on the locked record before any effect. */
  conditionMode?: 'all' | 'any';
  conditions?: ApplicationWorkflowCondition[];
  /** Bounded record changes executed atomically with the state transition. */
  effects?: ApplicationWorkflowEffect[];
}
export type ApplicationWorkflowCondition =
  | { fieldId: string; operator: 'is-null' | 'not-null' }
  | { fieldId: string; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean | null };
export type ApplicationWorkflowEffect =
  | { operation: 'set'; fieldId: string; value: string | number | boolean | null }
  | { operation: 'increment'; fieldId: string; amount: number }
  | { operation: 'timestamp'; fieldId: string }
  /** One required reference selects one row in a distinct related table; up to
   * four targets are authorized, locked and mutated atomically with the source. */
  | { operation: 'related'; referenceFieldId: string; fieldId: string; change:
      | { operation: 'set'; value: string | number | boolean | null }
      | { operation: 'increment'; amount: number }
      | { operation: 'timestamp' } };
/** A guarded enum state machine. The state field can only change through the
 * generated atomic transition RPC, never through ordinary record updates. */
export interface ApplicationWorkflowRule {
  fieldId: string;
  transitions: ApplicationWorkflowTransition[];
}
/** Transactional email to the verified record owner. Sender and credentials
 * belong to the referenced integration, never to the editable rule. */
export interface ApplicationEmailNotification {
  id: string;
  connectionId: string;
  event: { type: 'created' } | { type: 'transition'; transitionId: string };
  subject: string;
  text: string;
}
export interface ApplicationTable {
  id: string;
  key: string;
  name: string;
  fields: ApplicationField[];
  permissions: ApplicationPermission[];
  booking?: ApplicationBookingRule;
  counter?: ApplicationCounterRule;
  /** Explicitly opt into owner-only reservation SQL; still requires separately proven backend activation. */
  stockReservations?: { mode: 'owner' };
  transaction?: ApplicationTransactionRule;
  payment?: ApplicationPaymentRule;
  workflow?: ApplicationWorkflowRule;
  attachments?: { maxBytes: number; mimeTypes: string[] };
  notifications?: ApplicationEmailNotification[];
  reports?: ApplicationReport[];
}
export interface ApplicationReport {
  id: string; name: string; operation: 'count' | 'sum' | 'min' | 'max' | 'avg'; fieldId?: string;
  groupByFieldId?: string;
  period?: { fieldId: string; unit: 'day' | 'week' | 'month' | 'year'; timeZone: string; offset: number; comparePrevious: boolean };
}
export interface ApplicationRole { id: string; name: string }
export interface ApplicationPageAccess {
  pageId: string;
  access: Exclude<ApplicationAccess, 'owner'>;
  roleId?: string;
}
export type ApplicationRequirementCapability = 'page' | 'auth' | 'form' | 'records' | 'booking' | 'counter' | 'transaction' | 'workflow' | 'formula' | 'files' | 'payment' | 'email' | 'reports';
export interface ApplicationRequirement {
  id: string;
  summary: string;
  capability: ApplicationRequirementCapability;
  /** Verified references such as auth, page:<id>, form:<table>, view:<table>:<action>. */
  evidence: string[];
}
export interface ApplicationRequirementManifest {
  version: 1;
  request: string;
  items: ApplicationRequirement[];
  specification?: import('./project-specification').ProjectSpecification;
}
export interface ApplicationDefinition {
  version: 1;
  tables: ApplicationTable[];
  roles: ApplicationRole[];
  auth: { enabled: boolean; signUpEnabled: boolean; emailVerificationRequired: boolean };
  pageAccess: ApplicationPageAccess[];
  requirements?: ApplicationRequirementManifest;
}

export const APPLICATION_LIMITS = { tables: 50, fields: 80, roles: 30, permissions: 120, pageAccess: 100, requirements: 100, requirementEvidence: 20 } as const;
export const APPLICATION_SYSTEM_FIELDS = ['id', 'owner_id', 'created_at', 'updated_at'] as const;
export function createApplicationDefinition(): ApplicationDefinition {
  return { version: 1, tables: [], roles: [], auth: { enabled: false, signUpEnabled: false, emailVerificationRequired: true }, pageAccess: [] };
}
