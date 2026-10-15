import type { ApplicationDefinition } from './application-model';
import { validApplicationBookingSchedule } from './application-booking-schedule';

/** Domain-neutral planning metadata. References the existing application's
 * requirements/schema; descriptions are never evidence of executed code/tests. */
export interface ProjectSpecification {
  version: 1;
  intent: string;
  actors: Array<{ id: string; name: string; roleId?: string }>;
  entities: Array<{ id: string; scope: 'global' | 'owner' | 'organization' | 'branch'; classification: 'public' | 'internal' | 'confidential' | 'restricted' }>;
  requirements: Array<{ id: string; origin: 'explicit' | 'inferred'; acceptanceCriteria: string[] }>;
  /** Optional and backward compatible. Only closed test kinds supported by the
   * platform runner may contribute behavioral evidence. */
  acceptanceTests?: ProjectAcceptanceTest[];
  operations: Array<{ id: string; summary: string; actorIds: string[]; entityIds: string[]; requirementIds: string[]; dependsOn: string[]; execution: 'native' | 'custom'; transactional: boolean; source?: string }>;
  rules: Array<{ id: string; summary: string; operationIds: string[] }>;
  tenancy: { mode: 'single' | 'organizations' | 'branches'; organizationEntityId?: string; branchEntityId?: string };
  integrations: Array<{ id: string; purpose: string; operationIds: string[]; scopes: string[]; activation: 'deferred' }>;
  privacy: Array<{ entityId: string; purpose: string; retentionDays: number | null }>;
  decisions: Array<{ id: string; kind: 'missing' | 'conflict' | 'unsupported'; summary: string; operationIds: string[]; blocking: boolean }>;
}

interface ProjectAcceptanceTestBase {
  id: string;
  requirementId: string;
  criterionIndex: number;
}

export type ProjectAcceptanceTest = ProjectAcceptanceTestBase & (
  | {
    kind: 'form-values';
    pageId: string;
    sectionId: string;
    input: Array<{ name: string; value: string }>;
    expected: { outcome: 'accepted'; values: Record<string, unknown> } | { outcome: 'rejected' };
  }
  | {
    kind: 'record-values';
    pageId: string;
    sectionId: string;
    operation: 'create' | 'update';
    input: Array<{ name: string; value: string }>;
    expected: { outcome: 'accepted'; values: Record<string, unknown> } | { outcome: 'rejected' };
  }
  | {
    kind: 'workflow-transition';
    tableId: string;
    transitionId: string;
    fromState: string;
    expected: { outcome: 'available'; toState: string } | { outcome: 'rejected' };
  }
  | {
    kind: 'page-access';
    pageId: string;
    principal: { authenticated: boolean; roleIds: string[] };
    expected: { accessible: boolean };
  }
  | {
    kind: 'booking-schedule';
    tableId: string;
    startsAt: string;
    endsAt: string;
    expected: { withinSchedule: boolean };
  }
);

/** Canonical UTC instants keep acceptance fixtures independent of local parsing
 * and reject calendar normalization such as February 30 becoming March 2. */
export function projectAcceptanceInstant(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value ? instant : null;
}

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const text = (value: unknown, limit = 800): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit;
const customSourceLimitBytes = 64 * 1024;

export function projectSpecificationIssues(value: unknown, application: ApplicationDefinition): string[] {
  const issues: string[] = [];
  const fail = (path: string, message: string) => { issues.push(`${path}: ${message}`); };
  function shape(input: unknown, keys: string[], path: string): input is ObjectValue {
    if (!object(input)) { fail(path, 'Expected a specification object.'); return false; }
    if (Object.keys(input).some(key => !keys.includes(key))) fail(path, 'Unknown specification property.');
    return true;
  }
  function list(input: unknown, path: string, limit = 100): unknown[] {
    if (!Array.isArray(input) || input.length > limit) { fail(path, 'Invalid or oversized specification list.'); return []; }
    return input;
  }
  function catalog(input: unknown, path: string, keys: string[], key = 'id'): ObjectValue[] {
    const used = new Set<string>();
    return list(input, path).filter((item, index): item is ObjectValue => {
      const at = `${path}[${index}]`;
      if (!shape(item, keys, at)) return false;
      if (!identifier(item[key]) || used.has(String(item[key]))) fail(at, 'IDs must be valid and unique.');
      else used.add(item[key] as string);
      return true;
    });
  }
  function references(input: unknown, known: Set<unknown>, path: string, required = false): string[] {
    const entries = list(input, path);
    if (required && !entries.length) fail(path, 'At least one reference is required.');
    if (new Set(entries).size !== entries.length || entries.some(id => !identifier(id) || !known.has(id))) fail(path, 'Unknown or duplicate reference.');
    return entries.filter(identifier);
  }
  if (!shape(value, ['version', 'intent', 'actors', 'entities', 'requirements', 'acceptanceTests', 'operations', 'rules', 'tenancy', 'integrations', 'privacy', 'decisions'], 'specification')) return issues;
  if (value.version !== 1 || !text(value.intent, 2000)) fail('specification', 'Version 1 and a nonempty project intent are required.');
  const tableIds = new Set((Array.isArray(application.tables) ? application.tables : []).filter(object).map(table => table.id));
  const fieldKeys = new Set((Array.isArray(application.tables) ? application.tables : []).filter(object)
    .flatMap(table => Array.isArray(table.fields) ? table.fields.filter(object).map(field => field.key) : []));
  const roleIds = new Set((Array.isArray(application.roles) ? application.roles : []).filter(object).map(role => role.id));
  const requirementIds = new Set((Array.isArray(application.requirements?.items) ? application.requirements.items : []).filter(object).map(item => item.id));
  const actors = catalog(value.actors, 'actors', ['id', 'name', 'roleId']);
  if (!actors.length) fail('actors', 'Define the people or systems using this project.');
  for (const actor of actors) if (!text(actor.name, 160) || (actor.roleId !== undefined && !roleIds.has(actor.roleId as string))) fail(`actors.${actor.id}`, 'Actor name or application role is invalid.');
  const actorIds = new Set(actors.map(actor => actor.id));
  const entities = catalog(value.entities, 'entities', ['id', 'scope', 'classification']);
  for (const entity of entities) if (!tableIds.has(entity.id as string) || !['global', 'owner', 'organization', 'branch'].includes(String(entity.scope))
    || !['public', 'internal', 'confidential', 'restricted'].includes(String(entity.classification))) fail(`entities.${entity.id}`, 'Unknown schema entity, scope or sensitivity.');
  for (const table of tableIds) if (!entities.some(entity => entity.id === table)) fail(`entities.${table}`, 'Every application table needs a scope and sensitivity classification.');
  const entityIds = new Set(entities.map(entity => entity.id));
  const requirements = catalog(value.requirements, 'requirements', ['id', 'origin', 'acceptanceCriteria']);
  for (const item of requirements) {
    if (!requirementIds.has(item.id as string) || !['explicit', 'inferred'].includes(String(item.origin))) fail(`requirements.${item.id}`, 'Requirement must reference the existing manifest and declare its origin.');
    const criteria = list(item.acceptanceCriteria, `requirements.${item.id}.acceptanceCriteria`, 20);
    if (!criteria.length || criteria.some(criterion => !text(criterion))) fail(`requirements.${item.id}`, 'Define observable acceptance criteria; a page or button alone is not completion.');
  }
  for (const id of requirementIds) if (!requirements.some(item => item.id === id)) fail(`requirements.${id}`, 'Missing requirement acceptance criteria.');
  const requirementById = new Map(requirements.map(item => [String(item.id), item]));
  if (value.acceptanceTests !== undefined) {
    try {
      if (new TextEncoder().encode(JSON.stringify(value.acceptanceTests)).byteLength > 64 * 1024) fail('acceptanceTests', 'Acceptance tests exceed the 64 KiB specification limit.');
    } catch { fail('acceptanceTests', 'Acceptance tests must be bounded JSON data.'); }
  }
  const acceptanceTests = catalog(value.acceptanceTests ?? [], 'acceptanceTests', [
    'id', 'requirementId', 'criterionIndex', 'kind', 'pageId', 'sectionId', 'input', 'expected',
    'tableId', 'transitionId', 'fromState',
    'principal', 'startsAt', 'endsAt', 'operation',
  ]);
  for (const test of acceptanceTests) {
    const at = `acceptanceTests.${test.id}`;
    const requirement = requirementById.get(String(test.requirementId));
    if (!requirementIds.has(test.requirementId as string) || !requirement) fail(at, 'Test must reference a declared requirement.');
    if (!Number.isInteger(test.criterionIndex) || Number(test.criterionIndex) < 0
      || Number(test.criterionIndex) >= (Array.isArray(requirement?.acceptanceCriteria) ? requirement.acceptanceCriteria.length : 0)) {
      fail(at, 'Test must reference an existing acceptance criterion index.');
    }
    if (test.kind === 'form-values' || test.kind === 'record-values') {
      shape(test, ['id', 'requirementId', 'criterionIndex', 'kind', 'pageId', 'sectionId', 'input', 'expected',
        ...(test.kind === 'record-values' ? ['operation'] : [])], at);
      if (!identifier(test.pageId) || !identifier(test.sectionId)) fail(at, 'Invalid form target.');
      if (test.kind === 'record-values' && !['create', 'update'].includes(String(test.operation))) {
        fail(`${at}.operation`, 'Record value tests require create or update.');
      }
      const inputs = list(test.input, `${at}.input`, 46);
      const names = new Set<string>();
      for (const [index, input] of inputs.entries()) {
        const inputPath = `${at}.input[${index}]`;
        if (!shape(input, ['name', 'value'], inputPath)) continue;
        if (!/^[a-z][a-z0-9_]{0,79}$/.test(String(input.name))
          || typeof input.value !== 'string' || input.value.length > 2048 || names.has(String(input.name))) {
          fail(inputPath, 'Form test inputs must have unique bounded field names and string values.');
        } else names.add(input.name as string);
        if (typeof input.value === 'string' && (/(?:password|secret|token|credential|api[_-]?key)/i.test(String(input.name))
          || /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bBearer\s+|\b(?:sk|sb_secret|ghp|github_pat)_[A-Za-z0-9_-]{12,}/i.test(input.value))) {
          fail(inputPath, 'Acceptance fixtures cannot contain credentials or secret-like values.');
        }
      }
      if (!shape(test.expected, ['outcome', 'values'], `${at}.expected`)) continue;
      if (test.expected.outcome === 'accepted') {
        if (!object(test.expected.values) || Object.keys(test.expected.values).length > 45
          || Object.entries(test.expected.values).some(([key, result]) => !/^[a-z][a-z0-9_]{0,79}$/.test(key)
            || !fieldKeys.has(key)
            || !boundedJson(result))) fail(`${at}.expected`, 'Accepted test results must be bounded JSON fields from the application schema.');
      } else if (test.expected.outcome !== 'rejected' || test.expected.values !== undefined) {
        fail(`${at}.expected`, 'Expected result must be accepted with values or rejected without values.');
      }
    } else if (test.kind === 'workflow-transition') {
      shape(test, ['id', 'requirementId', 'criterionIndex', 'kind', 'tableId', 'transitionId', 'fromState', 'expected'], at);
      const table = application.tables.find(item => item.id === test.tableId);
      const transition = table?.workflow?.transitions.find(item => item.id === test.transitionId);
      const stateField = table?.fields.find(field => field.id === table.workflow?.fieldId);
      if (!identifier(test.tableId) || !table || !transition || !identifier(test.transitionId)) {
        fail(at, 'Workflow tests must reference an existing table and declared transition.');
      }
      if (typeof test.fromState !== 'string' || test.fromState.length > 120
        || stateField?.type !== 'enum' || !stateField.options?.includes(test.fromState)) {
        fail(`${at}.fromState`, 'Workflow test state must be a declared value of the workflow enum field.');
      }
      if (!shape(test.expected, ['outcome', 'toState'], `${at}.expected`)) continue;
      const canTransition = !!transition && Array.isArray(transition.from) && transition.from.includes(test.fromState as string);
      if (test.expected.outcome === 'available') {
        if (typeof test.expected.toState !== 'string' || test.expected.toState !== transition?.to
          || !canTransition) fail(`${at}.expected`, 'Expected available result must match the declared transition and source state.');
      } else if (test.expected.outcome !== 'rejected' || test.expected.toState !== undefined || canTransition) {
        fail(`${at}.expected`, 'Expected rejection must omit a destination and use a state outside the transition source.');
      }
    } else if (test.kind === 'booking-schedule') {
      shape(test, ['id', 'requirementId', 'criterionIndex', 'kind', 'tableId', 'startsAt', 'endsAt', 'expected'], at);
      const table = application.tables.find(item => item.id === test.tableId);
      if (!identifier(test.tableId) || !table?.booking?.schedule || !validApplicationBookingSchedule(table.booking.schedule)) {
        fail(at, 'Booking schedule tests must reference a table with a valid declared booking schedule.');
      }
      if (projectAcceptanceInstant(test.startsAt) === null || projectAcceptanceInstant(test.endsAt) === null) {
        fail(at, 'Booking schedule fixtures require canonical UTC instants: YYYY-MM-DDTHH:mm:ss.sssZ.');
      }
      if (shape(test.expected, ['withinSchedule'], `${at}.expected`) && typeof test.expected.withinSchedule !== 'boolean') {
        fail(`${at}.expected`, 'Expected schedule membership must be a boolean.');
      }
    } else if (test.kind === 'page-access') {
      shape(test, ['id', 'requirementId', 'criterionIndex', 'kind', 'pageId', 'principal', 'expected'], at);
      if (!identifier(test.pageId)) fail(at, 'Page access tests must reference a valid page ID.');
      if (shape(test.principal, ['authenticated', 'roleIds'], `${at}.principal`)) {
        if (typeof test.principal.authenticated !== 'boolean') fail(`${at}.principal`, 'Page access tests require an explicit synthetic authentication state.');
        const principalRoles = references(test.principal.roleIds, roleIds, `${at}.principal.roleIds`);
        if (test.principal.authenticated === false && principalRoles.length) fail(`${at}.principal.roleIds`, 'Anonymous test principals cannot carry application roles.');
      }
      if (shape(test.expected, ['accessible'], `${at}.expected`) && typeof test.expected.accessible !== 'boolean') {
        fail(`${at}.expected`, 'Expected page access must be a boolean.');
      }
    } else fail(at, 'Unsupported acceptance test kind.');
  }
  const operations = catalog(value.operations, 'operations', ['id', 'summary', 'actorIds', 'entityIds', 'requirementIds', 'dependsOn', 'execution', 'transactional', 'source']);
  const operationIds = new Set(operations.map(operation => operation.id));
  const covered = new Set<string>();
  const graph = new Map<string, string[]>();
  for (const operation of operations) {
    const at = `operations.${operation.id}`;
    if (!text(operation.summary) || typeof operation.transactional !== 'boolean' || !['native', 'custom'].includes(String(operation.execution))) fail(at, 'Invalid operation contract.');
    references(operation.actorIds, actorIds, `${at}.actorIds`, true);
    references(operation.entityIds, entityIds, `${at}.entityIds`);
    references(operation.requirementIds, requirementIds, `${at}.requirementIds`, true).forEach(id => covered.add(id));
    graph.set(String(operation.id), references(operation.dependsOn, operationIds, `${at}.dependsOn`));
    if (operation.execution === 'custom') {
      if (typeof operation.source !== 'string' || !operation.source.trim()
        || new TextEncoder().encode(operation.source).byteLength > customSourceLimitBytes) {
        fail(at, 'Custom operations need nonempty source within the 64 KiB release artifact limit.');
      }
      if (operation.transactional) fail(at, 'Custom code cannot claim database transaction guarantees.');
    } else if (operation.source !== undefined) fail(at, 'Native operations cannot carry custom source.');
  }
  for (const id of requirementIds) if (!covered.has(String(id))) fail(`requirements.${id}`, 'No implementation operation covers this requirement.');
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { fail(`operations.${id}`, 'Cyclic implementation dependencies.'); return; }
    if (visited.has(id)) return;
    visiting.add(id); for (const dependency of graph.get(id) ?? []) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
  for (const rule of catalog(value.rules, 'rules', ['id', 'summary', 'operationIds'])) {
    if (!text(rule.summary)) fail(`rules.${rule.id}`, 'Describe the business rule.');
    references(rule.operationIds, operationIds, `rules.${rule.id}.operationIds`, true);
  }
  if (shape(value.tenancy, ['mode', 'organizationEntityId', 'branchEntityId'], 'tenancy')) {
    const tenancy = value.tenancy;
    if (!['single', 'organizations', 'branches'].includes(String(tenancy.mode))) fail('tenancy', 'Invalid tenancy mode.');
    if (tenancy.mode !== 'single' && !entityIds.has(tenancy.organizationEntityId)) fail('tenancy', 'Organization projects need an organization entity.');
    if (tenancy.mode === 'branches' && !entityIds.has(tenancy.branchEntityId)) fail('tenancy', 'Branch projects need a branch entity.');
    if (tenancy.mode === 'single' && (tenancy.organizationEntityId !== undefined || tenancy.branchEntityId !== undefined)) fail('tenancy', 'Contradictory tenancy references.');
    // Existing owner/RLS rules do not prove organization/branch membership.
    if (tenancy.mode !== 'single' || entities.some(entity => ['organization', 'branch'].includes(String(entity.scope)))) fail('tenancy', 'Organization/branch isolation needs executable membership policies before delivery.');
  }
  for (const integration of catalog(value.integrations, 'integrations', ['id', 'purpose', 'operationIds', 'scopes', 'activation'])) {
    if (!text(integration.purpose) || integration.activation !== 'deferred') fail(`integrations.${integration.id}`, 'Only deferred, credential-free integration plans belong in a specification.');
    const scopes = list(integration.scopes, `integrations.${integration.id}.scopes`, 30);
    if (!scopes.length || scopes.some(scope => !text(scope, 160))) fail(`integrations.${integration.id}`, 'Declare required permission scopes without credentials.');
    references(integration.operationIds, operationIds, `integrations.${integration.id}.operationIds`, true);
  }
  const privacy = catalog(value.privacy, 'privacy', ['entityId', 'purpose', 'retentionDays'], 'entityId');
  for (const entry of privacy) if (!entityIds.has(entry.entityId) || !text(entry.purpose)
    || (entry.retentionDays !== null && (!Number.isInteger(entry.retentionDays) || Number(entry.retentionDays) < 1 || Number(entry.retentionDays) > 36500))) fail(`privacy.${entry.entityId}`, 'Invalid entity purpose or retention plan.');
  for (const entity of entities) if (['confidential', 'restricted'].includes(String(entity.classification)) && !privacy.some(entry => entry.entityId === entity.id)) fail(`privacy.${entity.id}`, 'Sensitive entities need explicit privacy planning.');
  for (const decision of catalog(value.decisions, 'decisions', ['id', 'kind', 'summary', 'operationIds', 'blocking'])) {
    if (!['missing', 'conflict', 'unsupported'].includes(String(decision.kind)) || !text(decision.summary) || typeof decision.blocking !== 'boolean') fail(`decisions.${decision.id}`, 'Invalid unresolved decision.');
    references(decision.operationIds, operationIds, `decisions.${decision.id}.operationIds`);
    if (decision.blocking === true || decision.kind === 'conflict' || decision.kind === 'unsupported') fail(`decisions.${decision.id}`, `Unresolved project requirement: ${decision.summary}`);
  }
  return issues;
}

function boundedJson(value: unknown, depth = 0, state = { nodes: 0 }): boolean {
  if (++state.nodes > 4096 || depth > 24) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return typeof value !== 'string' || value.length <= 2048;
  if (typeof value === 'number') return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (Array.isArray(value)) return value.length <= 4096 && value.every(item => boundedJson(item, depth + 1, state));
  return object(value) && Object.entries(value).every(([key, item]) => key.length <= 160 && boundedJson(item, depth + 1, state));
}

export function readProjectSpecification(value: unknown, application: ApplicationDefinition): ProjectSpecification {
  const issues = projectSpecificationIssues(value, application);
  if (issues.length) throw Error(`Project specification is incomplete: ${issues.slice(0, 5).join(' ')}`);
  return structuredClone(value) as ProjectSpecification;
}
