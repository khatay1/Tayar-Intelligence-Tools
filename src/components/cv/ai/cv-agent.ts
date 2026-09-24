import { CVData } from '@/lib/cv-types';

export type CVAgentIntent = 'tailor-job' | 'improve-summary' | 'improve-experience' | 'shorten' | 'proofread' | 'translate';

export interface CVAgentRequest {
  intent: CVAgentIntent;
  cv: CVData;
  jobDescription?: string;
  instruction?: string;
  targetLanguage?: string;
}

export interface CVAgentChange {
  id: string;
  section: string;
  field: string;
  itemId?: string;
  before: string;
  after: string;
  reason: string;
  evidence: string[];
}

export interface CVAgentPlan {
  summary: string;
  changes: CVAgentChange[];
  warnings: string[];
}

export function buildCVAgentGuardrails(request: CVAgentRequest): string[] {
  return [
    'Never invent employers, job titles, dates, degrees, certifications, skills, metrics, achievements, or responsibilities.',
    'Preserve factual meaning unless the user explicitly supplies replacement facts.',
    'Treat the job description as a targeting reference, not evidence that the candidate has a skill or experience.',
    'When a useful keyword is unsupported by the CV, recommend that the user verify it instead of adding it.',
    'Every proposed factual strengthening must cite evidence from the supplied CV content.',
    request.targetLanguage ? `Write proposed text in ${request.targetLanguage}.` : 'Preserve the CV language unless instructed otherwise.',
  ];
}

export function validateCVAgentPlan(plan: CVAgentPlan): CVAgentPlan {
  const changes = plan.changes.filter(change => {
    if (!change.after.trim() || change.after.trim() === change.before.trim()) return false;
    return change.evidence.length > 0 || change.before.trim().length > 0;
  });
  return { ...plan, changes };
}

export function applyCVAgentChange(cv: CVData, change: CVAgentChange): CVData {
  if (change.section === 'summary' && change.field === 'summary') return { ...cv, summary: change.after };
  if (change.section === 'experience' && change.itemId) {
    return {
      ...cv,
      experience: cv.experience.map(item => item.id === change.itemId ? { ...item, [change.field]: change.after } : item),
    };
  }
  return cv;
}

export function applyCVAgentChanges(cv: CVData, changes: CVAgentChange[]): CVData {
  return changes.reduce((current, change) => applyCVAgentChange(current, change), cv);
}
