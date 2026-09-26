import { validateApplicationDefinition, type ApplicationIssue } from './application-validation';
import type { ApplicationDefinition } from './application-model';

/** A model is not a provisioned backend. Never publish a static imitation of protected app routes. */
export function applicationPublishBlockers(value: unknown, pageIds: ReadonlySet<string>): ApplicationIssue[] {
  if (value === undefined) return [];
  const issues = validateApplicationDefinition(value, pageIds);
  if (issues.length) return issues;
  const application = value as ApplicationDefinition;
  if (application.tables.length || application.auth.enabled || application.roles.length || application.pageAccess.some(rule => rule.access !== 'public')) {
    return [{ path: 'application', code: 'backend-not-provisioned', message: 'This application requires an isolated backend and server-enforced access policies. Full-stack publishing is not available until backend provisioning is connected and verified.' }];
  }
  return [];
}
