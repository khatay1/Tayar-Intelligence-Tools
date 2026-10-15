import type { ApplicationDefinition } from './application-model';
import { compileApplicationDataView } from './application-data-view';
import { compileApplicationCreateForm } from './application-form-runtime';
import { parseApplicationCustomOperationAction } from './application-custom-operation-actions';
import type { WebsitePage } from './website-builder-model';

const capabilityPrefix: Record<string, string> = {
  page: 'page:', auth: 'auth', form: 'form:', records: 'view:',
  booking: 'booking:', counter: 'counter:', transaction: 'transaction:', workflow: 'workflow:', formula: 'formula:', files: 'files:',
  payment: 'payment:', email: 'email:', reports: 'reports:',
};

export interface ApplicationRequirementCoverageRow {
  requirementId: string;
  requirement: string;
  /** Observable intent from the validated ProjectSpecification. These strings
   * are shown for traceability; they are not themselves treated as test proof. */
  acceptanceCriteria: string[];
  implementation: string[];
  tests: Array<{ id: string; kind: 'contract'; result: 'passed' | 'failed'; detail: string }>;
  deliveryStatus: 'blocked' | 'contract-verified';
}

function currentImplementationEvidence(application: ApplicationDefinition, pages: WebsitePage[]): Set<string> {
  const evidence = new Set<string>();
  if (application.auth.enabled) evidence.add('auth');
  for (const page of pages) {
    evidence.add(`page:${page.id}`);
    for (const section of page.sections) {
      if (section.applicationFormBinding) {
        try {
          compileApplicationCreateForm(application, section, section.applicationFormBinding);
          evidence.add(`form:${section.applicationFormBinding.tableId}`);
          if (application.tables.find(table => table.id === section.applicationFormBinding!.tableId)?.booking) evidence.add(`booking:${section.applicationFormBinding.tableId}`);
        } catch { /* A failed compiler contract is intentionally absent from coverage. */ }
      }
      if (section.applicationDataView) {
        try {
          const view = compileApplicationDataView(application, section.applicationDataView);
          evidence.add(`view:${view.table.id}:read`);
          for (const action of view.binding.actions) evidence.add(`view:${view.table.id}:${action}`);
          if (view.table.booking && view.binding.actions.includes('create')) evidence.add(`booking:${view.table.id}`);
          if (view.table.counter && view.binding.actions.includes('adjust')) evidence.add(`counter:${view.table.id}`);
          if (view.table.transaction && view.binding.actions.includes('transact')) evidence.add(`transaction:${view.table.id}`);
          if (view.table.attachments && view.binding.actions.includes('attachments')) evidence.add(`files:${view.table.id}`);
          if (view.table.workflow && view.binding.actions.includes('transition')) evidence.add(`workflow:${view.table.id}`);
          if (view.table.fields.some(field => field.formula && view.binding.columns.includes(field.id))) evidence.add(`formula:${view.table.id}`);
          if (view.table.payment && view.binding.actions.some(action => action === 'pay' || action === 'refund')) evidence.add(`payment:${view.table.id}`);
          if (view.table.reports?.length) evidence.add(`reports:${view.table.id}`);
        } catch { /* A failed compiler contract is intentionally absent from coverage. */ }
      }
    }
  }
  for (const table of application.tables) if (table.notifications?.length) evidence.add(`email:${table.id}`);
  return evidence;
}

/** Requirement → implementation → executable contract check → result → delivery status.
 * Contract verification proves the current generated definition compiles against
 * the current pages. It deliberately does not claim deployment or live-provider success. */
export function buildApplicationRequirementCoverage(
  application: ApplicationDefinition | undefined,
  pages: WebsitePage[],
): ApplicationRequirementCoverageRow[] {
  const manifest = application?.requirements;
  if (!application || !manifest?.items.length) return [];
  const current = currentImplementationEvidence(application, pages);
  const operations = manifest.specification?.operations ?? [];
  const acceptanceCriteria = new Map((manifest.specification?.requirements ?? [])
    .map(requirement => [requirement.id, requirement.acceptanceCriteria] as const));
  const customOperationIds = new Set(operations.filter(operation => operation.execution === 'custom').map(operation => operation.id));
  return manifest.items.map(item => {
    const prefix = capabilityPrefix[item.capability];
    const matching = item.evidence.some(entry => prefix === 'auth' ? entry === 'auth' : entry.startsWith(prefix));
    const tests = item.evidence.map(reference => ({
      id: `contract:${reference}`,
      kind: 'contract' as const,
      result: current.has(reference) ? 'passed' as const : 'failed' as const,
      detail: current.has(reference)
        ? `Current project compiles implementation reference ${reference}.`
        : `Current project does not compile implementation reference ${reference}.`,
    }));
    const linkedOperations = operations.filter(operation => operation.requirementIds.includes(item.id));
    const operationIds = linkedOperations.map(operation => `operation:${operation.id}`);
    for (const operation of linkedOperations.filter(operation => operation.execution === 'custom')) {
      const actionBound = pages.some(page => page.sections.some(section => (section.elements ?? []).some(element =>
        element.type === 'button' && element.action === 'custom-operation' && element.customOperationId === operation.id
        && !!parseApplicationCustomOperationAction(element.customOperationId, element.customOperationInputJson ?? '{}', customOperationIds,
          element.customOperationBindFormValues === true)
        && (!element.customOperationBindFormValues || (section.type === 'contact' && !!section.applicationFormBinding)))));
      tests.push({
        id: `contract:operation-action:${operation.id}`,
        kind: 'contract' as const,
        result: actionBound ? 'passed' as const : 'failed' as const,
        detail: actionBound ? `A generated page action targets custom operation ${operation.id}.`
          : `No valid generated page action targets custom operation ${operation.id}.`,
      });
      tests.push({
        id: `contract:operation:${operation.id}`,
        kind: 'contract' as const,
        result: 'failed' as const,
        detail: 'Custom source is stored as an inert draft until authorization, sandbox execution and runtime verification are enabled.',
      });
    }
    const passed = matching && tests.length > 0 && tests.every(test => test.result === 'passed');
    return {
      requirementId: item.id,
      requirement: item.summary,
      acceptanceCriteria: [...(acceptanceCriteria.get(item.id) ?? [])],
      implementation: [...item.evidence, ...operationIds],
      tests,
      deliveryStatus: passed ? 'contract-verified' : 'blocked',
    };
  });
}

export function formatApplicationRequirementCoverage(rows: ApplicationRequirementCoverageRow[]): string[] {
  return rows.flatMap(row => [
    `Requirement: ${row.requirementId} — ${row.requirement}`,
    ...(row.acceptanceCriteria.length
      ? [`  Acceptance criteria: ${row.acceptanceCriteria.join(' | ')}`]
      : ['  Acceptance criteria: Missing from structured project specification']),
    `  Implementation: ${row.implementation.join(', ') || 'Missing'}`,
    `  Test: ${row.tests.map(test => test.id).join(', ') || 'Missing'}`,
    `  Result: ${row.tests.length && row.tests.every(test => test.result === 'passed') ? 'passed' : 'failed'}`,
    `  Delivery status: ${row.deliveryStatus}`,
  ]);
}

/** Recompute evidence from the current editable project; saved claims never prove completion by themselves. */
export function applicationRequirementIssues(application: ApplicationDefinition | undefined, pages: WebsitePage[]): string[] {
  if (!application || (!application.auth.enabled && !application.tables.length)) return [];
  const manifest = application.requirements;
  if (!manifest?.items.length) return ['This application has no verified requirements manifest.'];
  return buildApplicationRequirementCoverage(application, pages).flatMap(row => row.deliveryStatus === 'contract-verified'
    ? [] : [`Requirement "${row.requirement}" is no longer backed by a passing current-project contract test.`]);
}
