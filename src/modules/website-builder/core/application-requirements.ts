import type { ApplicationDefinition } from './application-model';
import { compileApplicationDataView } from './application-data-view';
import { compileApplicationCreateForm } from './application-form-runtime';
import type { WebsitePage } from './website-builder-model';

const capabilityPrefix: Record<string, string> = {
  page: 'page:', auth: 'auth', form: 'form:', records: 'view:',
  booking: 'booking:', counter: 'counter:', transaction: 'transaction:', workflow: 'workflow:', formula: 'formula:', files: 'files:',
};

/** Recompute evidence from the current editable project; saved claims never prove completion by themselves. */
export function applicationRequirementIssues(application: ApplicationDefinition | undefined, pages: WebsitePage[]): string[] {
  if (!application || (!application.auth.enabled && !application.tables.length)) return [];
  const manifest = application.requirements;
  if (!manifest?.items.length) return ['This application has no verified requirements manifest.'];
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
        } catch { /* The existing application/form validation reports the detailed error. */ }
      }
      if (section.applicationDataView) {
        try {
          const view = compileApplicationDataView(application, section.applicationDataView);
          for (const action of view.binding.actions) evidence.add(`view:${view.table.id}:${action}`);
          if (view.table.booking && view.binding.actions.includes('create')) evidence.add(`booking:${view.table.id}`);
          if (view.table.counter && view.binding.actions.includes('adjust')) evidence.add(`counter:${view.table.id}`);
          if (view.table.transaction && view.binding.actions.includes('transact')) evidence.add(`transaction:${view.table.id}`);
          if (view.table.attachments && view.binding.actions.includes('attachments')) evidence.add(`files:${view.table.id}`);
          if (view.table.workflow && view.binding.actions.includes('transition')) evidence.add(`workflow:${view.table.id}`);
          if (view.table.fields.some(field => field.formula && view.binding.columns.includes(field.id))) evidence.add(`formula:${view.table.id}`);
        } catch { /* The existing application/view validation reports the detailed error. */ }
      }
    }
  }
  return manifest.items.flatMap(item => {
    const prefix = capabilityPrefix[item.capability];
    const matching = item.evidence.some(entry => prefix === 'auth' ? entry === 'auth' : entry.startsWith(prefix));
    const missing = item.evidence.filter(entry => !evidence.has(entry));
    return matching && !missing.length ? [] : [`Requirement "${item.summary}" is no longer backed by the current project.`];
  });
}
