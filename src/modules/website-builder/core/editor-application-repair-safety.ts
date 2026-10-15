import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { compileApplicationCreateForm } from './application-form-runtime';
import { compileApplicationDataView } from './application-data-view';
import { buildApplicationRequirementCoverage } from './application-requirements';
import type { ApplicationContractPage } from './website-builder-model';

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
    readApplicationDefinition(candidateApplication, new Set(candidatePages.map(page => page.id)));
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
