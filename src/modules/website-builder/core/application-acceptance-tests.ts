import type { ApplicationDefinition } from './application-model';
import { compileApplicationCreateForm } from './application-form-runtime';
import { ApplicationWorkflowRejected, applicationWorkflowTransition } from './application-workflow';
import type { WebsitePage } from './website-builder-model';
import type { ProjectAcceptanceTest } from './project-specification';

export interface ApplicationAcceptanceTestResult {
  id: string;
  kind: 'acceptance';
  result: 'passed' | 'failed';
  detail: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? '';
}

/** Runs only closed, native form-value and workflow-definition protocols. It
 * never connects to a database, executes generated source, logs fixture values,
 * or claims a record was saved or a transition was persisted. */
export function runApplicationAcceptanceTest(
  application: ApplicationDefinition,
  pages: WebsitePage[],
  test: ProjectAcceptanceTest,
): ApplicationAcceptanceTestResult {
  const id = `acceptance:${test.requirementId}:${test.criterionIndex + 1}:${test.id}`;
  if (test.kind === 'workflow-transition') {
    const table = application.tables.find(item => item.id === test.tableId);
    if (!table) return { id, kind: 'acceptance', result: 'failed', detail: 'The workflow test table no longer exists.' };
    try {
      const transition = applicationWorkflowTransition(table, test.transitionId, test.fromState);
      if (test.expected.outcome !== 'available') return {
        id, kind: 'acceptance', result: 'failed', detail: 'The workflow definition permits a transition the test expected to reject.',
      };
      if (transition.to !== test.expected.toState) return {
        id, kind: 'acceptance', result: 'failed', detail: 'The declared workflow destination differs from the expected state.',
      };
      return { id, kind: 'acceptance', result: 'passed', detail: 'The current workflow definition permits the declared transition from this state; authorization, conditions and persistence are not exercised.' };
    } catch (error) {
      return test.expected.outcome === 'rejected' && error instanceof ApplicationWorkflowRejected
        ? { id, kind: 'acceptance', result: 'passed', detail: 'The current workflow definition rejects this transition from the supplied state before any database write.' }
        : { id, kind: 'acceptance', result: 'failed', detail: 'The current workflow definition rejected a transition expected to be available.' };
    }
  }
  if (test.kind !== 'form-values') return { id, kind: 'acceptance', result: 'failed', detail: 'Unsupported acceptance test kind.' };
  const page = pages.find(item => item.id === test.pageId);
  const section = page?.sections.find(item => item.id === test.sectionId);
  if (!section?.applicationFormBinding) return {
    id, kind: 'acceptance', result: 'failed', detail: 'The test target no longer has a generated application form binding.',
  };
  let compiled: ReturnType<typeof compileApplicationCreateForm>;
  try { compiled = compileApplicationCreateForm(application, section, section.applicationFormBinding); }
  catch {
    return { id, kind: 'acceptance', result: 'failed', detail: 'The current form implementation no longer compiles.' };
  }
  try {
    const values = compiled.values(test.input.map(entry => [entry.name, entry.value] as [string, string]));
    const expected = test.expected;
    if (expected.outcome !== 'accepted') return {
      id, kind: 'acceptance', result: 'failed', detail: 'The input was accepted but the test expected rejection.',
    };
    if (canonical(values) !== canonical(expected.values)) return {
      id, kind: 'acceptance', result: 'failed', detail: 'The accepted form values differ from the expected mapped payload.',
    };
    return { id, kind: 'acceptance', result: 'passed', detail: 'The current form compiler produced the expected mapped payload.' };
  } catch {
    return test.expected.outcome === 'rejected'
      ? { id, kind: 'acceptance', result: 'passed', detail: 'The current form compiler rejected the invalid input before any write.' }
      : { id, kind: 'acceptance', result: 'failed', detail: 'The current form compiler rejected input expected to be accepted.' };
  }
}
