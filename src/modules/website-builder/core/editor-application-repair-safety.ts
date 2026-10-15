import type { ApplicationAccess, ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { compileApplicationCreateForm } from './application-form-runtime';
import { compileApplicationDataView } from './application-data-view';
import { buildApplicationRequirementCoverage } from './application-requirements';
import type { ApplicationContractPage } from './website-builder-model';

type Audience = { access: ApplicationAccess; roleId?: string };

// Permissions for one operation are ORed by the SQL compiler. Owner and role
// audiences are incomparable: having a role does not imply owning every row.
function coversAudience(before: Audience, after: Audience): boolean {
  return before.access === 'public'
    || (before.access === 'authenticated' && after.access !== 'public')
    || (before.access === after.access && (before.access !== 'role' || before.roleId === after.roleId));
}

function sameContract(before: unknown, after: unknown): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
      : value;
  return JSON.stringify(canonical(before)) === JSON.stringify(canonical(after));
}

function contractRepairIssues(before: ApplicationDefinition, after: ApplicationDefinition, pages: ApplicationContractPage[]): string[] {
  const issues: string[] = [];
  if (before.auth.enabled && (!after.auth.enabled
    || (!before.auth.signUpEnabled && after.auth.signUpEnabled)
    || (before.auth.emailVerificationRequired && !after.auth.emailVerificationRequired))) {
    issues.push('AI repair cannot weaken authentication or enable registration; use reviewed manual configuration.');
  }
  for (const page of pages) {
    const previous = before.pageAccess.find(rule => rule.pageId === page.id) ?? { access: 'public' as const };
    const current = after.pageAccess.find(rule => rule.pageId === page.id) ?? { access: 'public' as const };
    if (!coversAudience(previous, current)) issues.push(`AI repair cannot widen page access for ${page.id}; use reviewed manual configuration.`);
  }
  for (const table of before.tables) {
    const current = after.tables.find(candidate => candidate.id === table.id);
    if (!current || current.key !== table.key) {
      issues.push(`AI repair must preserve stored table ${table.id}; use a reviewed manual data migration.`);
      continue;
    }
    for (const field of table.fields) {
      const updated = current.fields.find(candidate => candidate.id === field.id);
      // Display labels and ordinary indexes may change; storage identities,
      // constraints, defaults, references and formulas require a data review.
      const storage = (input: typeof field) => ({ ...input, name: undefined, indexed: undefined, unique: input.unique === true });
      if (!updated || !sameContract(storage(field), storage(updated))) {
        issues.push(`AI repair must preserve stored field ${field.id}; use a reviewed manual data migration.`);
      }
    }
    for (const rule of current.permissions) {
      if (!table.permissions.some(previous => previous.operation === rule.operation && coversAudience(previous, rule))) {
        issues.push(`AI repair cannot widen ${rule.operation} access for ${table.id}; use reviewed manual configuration.`);
      }
    }
    for (const transition of current.workflow?.transitions ?? []) {
      const previous = table.workflow?.transitions.find(candidate => candidate.id === transition.id);
      if (previous && !coversAudience(previous, transition)) issues.push(`AI repair cannot widen workflow access for ${transition.id}; use reviewed manual configuration.`);
    }
    if (table.payment && current.payment && table.payment.refundRoleId !== current.payment.refundRoleId) {
      issues.push(`AI repair cannot change refund authorization for ${table.id}; use reviewed manual configuration.`);
    }
    for (const key of ['booking', 'counter', 'transaction', 'payment', 'workflow', 'attachments', 'notifications', 'reports'] as const) {
      if (table[key] !== undefined && !sameContract(table[key], current[key])) {
        issues.push(`AI repair must preserve the existing ${key} contract for ${table.id}; use reviewed manual configuration.`);
      }
    }
  }
  return issues.slice(0, 10);
}

/** Validate proposed page/configuration repairs before preview or editor mutation. A
 * previously untested criterion may stay untested; a passing check cannot regress.
 * These are current application contracts, not live database/provider evidence. */
export function applicationRepairSafetyIssues(
  application: ApplicationDefinition | undefined,
  baselinePages: ApplicationContractPage[],
  candidatePages: ApplicationContractPage[],
  candidateApplication: ApplicationDefinition | undefined = application,
): string[] {
  if (!application && !candidateApplication) return [];
  if (!candidateApplication) return ['Application repair must preserve the application definition.'];
  try {
    const validated = readApplicationDefinition(candidateApplication, new Set(candidatePages.map(page => page.id)));
    if (application) {
      const accessIssues = contractRepairIssues(readApplicationDefinition(application), validated, baselinePages);
      if (accessIssues.length) return accessIssues;
    }
    for (const page of candidatePages) for (const section of page.sections) {
      if (section.type === 'contact' && !section.applicationFormBinding) throw new Error();
      if (section.applicationFormBinding) compileApplicationCreateForm(candidateApplication, section, section.applicationFormBinding);
      if (section.applicationDataView) compileApplicationDataView(candidateApplication, section.applicationDataView);
    }
    const baseline = buildApplicationRequirementCoverage(application, baselinePages);
    const candidate = new Map(buildApplicationRequirementCoverage(candidateApplication, candidatePages).map(row => [row.requirementId, row]));
    const issues: string[] = [];
    for (const row of baseline) {
      const current = new Map(candidate.get(row.requirementId)?.tests.map(test => [test.id, test.result]));
      for (const test of row.tests) if (test.result === 'passed' && current.get(test.id) !== 'passed') {
        issues.push(`Application repair would invalidate ${test.id}.`);
        if (issues.length === 10) return issues;
      }
    }
    return issues;
  } catch {
    return ['Application repair must preserve valid page access, form mappings and data-view bindings.'];
  }
}
