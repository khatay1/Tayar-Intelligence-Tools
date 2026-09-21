import type {
  AIWebsiteAgentPlanStep,
  AIWebsitePatchOperation,
} from './editor-ai-patch-review';

export interface AIWebsitePlanCoverage {
  coveredStepIds: string[];
  uncoveredStepIds: string[];
  unknownStepIds: string[];
  unassignedOperationCount: number;
  percent: number;
  warnings: string[];
}

export function evaluateAIWebsitePlanCoverage(
  steps: AIWebsiteAgentPlanStep[],
  operations: AIWebsitePatchOperation[],
): AIWebsitePlanCoverage {
  const known = new Set(steps.map((step) => step.id));
  const assigned = operations
    .map((operation) => operation.planStepId?.trim() || '')
    .filter(Boolean);
  const covered = new Set(assigned.filter((id) => known.has(id)));
  const unknown = [...new Set(assigned.filter((id) => !known.has(id)))];
  const uncovered = steps.map((step) => step.id).filter((id) => !covered.has(id));
  const unassignedOperationCount = operations.filter((operation) => !operation.planStepId?.trim()).length;
  const percent = steps.length ? Math.round((covered.size / steps.length) * 100) : 100;
  const warnings = [
    ...(uncovered.length ? [`Plan coverage ${percent}%: ${uncovered.length} planned step${uncovered.length === 1 ? '' : 's'} have no proposed operation.`] : []),
    ...(unknown.length ? [`${unknown.length} operation step reference${unknown.length === 1 ? '' : 's'} do not match the approved plan.`] : []),
    ...(unassignedOperationCount ? [`${unassignedOperationCount} proposed operation${unassignedOperationCount === 1 ? '' : 's'} are not linked to an approved plan step.`] : []),
  ];
  return {
    coveredStepIds: [...covered],
    uncoveredStepIds: uncovered,
    unknownStepIds: unknown,
    unassignedOperationCount,
    percent,
    warnings,
  };
}

