import type { ApplicationTable, ApplicationWorkflowTransition } from './application-model';

export class ApplicationWorkflowRejected extends Error {
  constructor() { super('Application workflow transition unavailable'); this.name = 'ApplicationWorkflowRejected'; }
}

export function applicationWorkflowTransition(table: ApplicationTable, transitionId: unknown, currentState?: unknown): ApplicationWorkflowTransition {
  if (!table.workflow || typeof transitionId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(transitionId)) {
    throw new ApplicationWorkflowRejected();
  }
  const transition = table.workflow.transitions.find(item => item.id === transitionId);
  if (!transition || (currentState !== undefined && (typeof currentState !== 'string' || !transition.from.includes(currentState)))) {
    throw new ApplicationWorkflowRejected();
  }
  return transition;
}

export function availableApplicationWorkflowTransitions(table: ApplicationTable, currentState: unknown): ApplicationWorkflowTransition[] {
  if (!table.workflow || typeof currentState !== 'string') return [];
  return table.workflow.transitions.filter(transition => transition.from.includes(currentState));
}
