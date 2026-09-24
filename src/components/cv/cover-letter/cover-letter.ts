import { CVData } from '@/lib/cv-types';

export interface CoverLetterDocument {
  id: string;
  cvId: string | null;
  jobTitle: string;
  company: string;
  recipient: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterContext {
  cv: CVData;
  jobDescription: string;
  jobTitle?: string;
  company?: string;
}

export function buildCoverLetterEvidence(context: CoverLetterContext): string[] {
  const evidence: string[] = [];
  if (context.cv.summary.trim()) evidence.push(`Summary: ${context.cv.summary.trim()}`);
  context.cv.experience.slice(0, 5).forEach(item => {
    const parts = [item.jobTitle, item.company, item.description].filter(Boolean).join(' | ');
    if (parts) evidence.push(`Experience: ${parts}`);
  });
  context.cv.skills.slice(0, 20).forEach(item => { if (item.name.trim()) evidence.push(`Skill: ${item.name.trim()}`); });
  return evidence;
}

export function coverLetterGuardrails(): string[] {
  return [
    'Use only candidate facts supported by the CV evidence.',
    'Do not invent achievements, metrics, employers, education, certifications, or skills.',
    'Use the job description only to choose emphasis and terminology.',
    'Keep claims specific, professional, and verifiable by the candidate.',
  ];
}
