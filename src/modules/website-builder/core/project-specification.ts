import type { ApplicationDefinition } from './application-model';

/** Domain-neutral planning metadata. References the existing application's
 * requirements/schema; descriptions are never evidence of executed code/tests. */
export interface ProjectSpecification {
  version: 1;
  intent: string;
  actors: Array<{ id: string; name: string; roleId?: string }>;
  entities: Array<{ id: string; scope: 'global' | 'owner' | 'organization' | 'branch'; classification: 'public' | 'internal' | 'confidential' | 'restricted' }>;
  requirements: Array<{ id: string; origin: 'explicit' | 'inferred'; acceptanceCriteria: string[] }>;
  operations: Array<{ id: string; summary: string; actorIds: string[]; entityIds: string[]; requirementIds: string[]; dependsOn: string[]; execution: 'native' | 'custom'; transactional: boolean }>;
  rules: Array<{ id: string; summary: string; operationIds: string[] }>;
  tenancy: { mode: 'single' | 'organizations' | 'branches'; organizationEntityId?: string; branchEntityId?: string };
  integrations: Array<{ id: string; purpose: string; operationIds: string[]; scopes: string[]; activation: 'deferred' }>;
  privacy: Array<{ entityId: string; purpose: string; retentionDays: number | null }>;
  decisions: Array<{ id: string; kind: 'missing' | 'conflict' | 'unsupported'; summary: string; operationIds: string[]; blocking: boolean }>;
}

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const text = (value: unknown, limit = 800): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit;

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
  if (!shape(value, ['version', 'intent', 'actors', 'entities', 'requirements', 'operations', 'rules', 'tenancy', 'integrations', 'privacy', 'decisions'], 'specification')) return issues;
  if (value.version !== 1 || !text(value.intent, 2000)) fail('specification', 'Version 1 and a nonempty project intent are required.');
  const tableIds = new Set((Array.isArray(application.tables) ? application.tables : []).filter(object).map(table => table.id));
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
  const operations = catalog(value.operations, 'operations', ['id', 'summary', 'actorIds', 'entityIds', 'requirementIds', 'dependsOn', 'execution', 'transactional']);
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
    if (operation.execution === 'custom') fail(at, 'Custom code requires an isolated execution adapter before generation can apply this project.');
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

export function readProjectSpecification(value: unknown, application: ApplicationDefinition): ProjectSpecification {
  const issues = projectSpecificationIssues(value, application);
  if (issues.length) throw Error(`Project specification is incomplete: ${issues.slice(0, 5).join(' ')}`);
  return structuredClone(value) as ProjectSpecification;
}
