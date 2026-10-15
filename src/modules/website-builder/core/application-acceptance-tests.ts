import type { ApplicationDefinition } from './application-model';
import { compileApplicationCreateForm } from './application-form-runtime';
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

/** Runs only the closed, native form-value test protocol. It invokes the same
 * compiler and converter as published forms; it never connects to a database,
 * executes generated source, logs fixture values, or claims a record was saved. */
export function runApplicationAcceptanceTest(
  application: ApplicationDefinition,
  pages: WebsitePage[],
  test: ProjectAcceptanceTest,
): ApplicationAcceptanceTestResult {
  const id = `acceptance:${test.requirementId}:${test.criterionIndex + 1}:${test.id}`;
  if (test.kind !== 'form-values') return {
    id, kind: 'acceptance', result: 'failed', detail: 'Unsupported acceptance test kind.',
  };
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
