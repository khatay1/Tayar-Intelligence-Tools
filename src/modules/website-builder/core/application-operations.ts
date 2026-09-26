import { createEditorCommand, type EditorCommand } from './editor-command';
import type { EditorChangeSource } from './editor-transaction';
import type { ApplicationDefinition, ApplicationPageAccess, ApplicationRole, ApplicationTable } from './application-model';
import { readApplicationDefinition } from './application-validation';

export type ApplicationOperation =
  | { type: 'put_table'; table: ApplicationTable }
  | { type: 'remove_table'; tableId: string }
  | { type: 'put_role'; role: ApplicationRole }
  | { type: 'remove_role'; roleId: string }
  | { type: 'set_auth'; auth: ApplicationDefinition['auth'] }
  | { type: 'set_page_access'; rules: ApplicationPageAccess[] };

export interface ApplicationProject {
  cloudProjectId?: string | null;
  pages: Array<{ id: string }>;
  application?: ApplicationDefinition;
}
export interface ApplicationOperationReview {
  projectId: string | null;
  fingerprint: string;
  reviewed: boolean;
}

export function applicationFingerprint(project: ApplicationProject): string {
  return JSON.stringify({ application: readApplicationDefinition(project.application), pageIds: project.pages.map(page => page.id) });
}

/** One command for visual editors and reviewed AI plans, with the existing transaction/history engine. */
export function createApplicationCommand<P extends ApplicationProject>(operations: ApplicationOperation[], review: ApplicationOperationReview, source: EditorChangeSource): EditorCommand<P> {
  const plan = structuredClone(operations);
  const approval = structuredClone(review);
  return createEditorCommand<P>({
    label: 'Update application configuration', source,
    mutate(project) {
      if (!Array.isArray(plan) || plan.length < 1 || plan.length > 100) throw new Error('An application plan must contain 1–100 operations.');
      if ((project.cloudProjectId ?? null) !== approval.projectId || applicationFingerprint(project) !== approval.fingerprint) throw new Error('The application changed or another project is open. Review the plan again.');
      if (!approval.reviewed) throw new Error('Review application schema and permission changes before applying them.');
      const application = readApplicationDefinition(project.application);
      for (const operation of plan) {
        switch (operation.type) {
          case 'put_table': {
            const index = application.tables.findIndex(item => item.id === operation.table.id);
            if (index < 0) application.tables.push(structuredClone(operation.table));
            else application.tables[index] = structuredClone(operation.table);
            break;
          }
          case 'remove_table':
            if (!application.tables.some(item => item.id === operation.tableId)) throw new Error('The table no longer exists.');
            application.tables = application.tables.filter(item => item.id !== operation.tableId);
            break;
          case 'put_role': {
            const index = application.roles.findIndex(item => item.id === operation.role.id);
            if (index < 0) application.roles.push(structuredClone(operation.role));
            else application.roles[index] = structuredClone(operation.role);
            break;
          }
          case 'remove_role':
            if (!application.roles.some(item => item.id === operation.roleId)) throw new Error('The role no longer exists.');
            application.roles = application.roles.filter(item => item.id !== operation.roleId);
            break;
          case 'set_auth': application.auth = structuredClone(operation.auth); break;
          case 'set_page_access': application.pageAccess = structuredClone(operation.rules); break;
          default: throw new Error('Unsupported application operation.');
        }
      }
      project.application = readApplicationDefinition(application, new Set(project.pages.map(page => page.id)));
    },
  });
}
