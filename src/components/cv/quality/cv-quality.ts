import { CVData } from '@/lib/cv-types';

export type CVQualitySeverity = 'info' | 'warning' | 'error';
export type CVQualityCategory = 'completeness' | 'clarity' | 'consistency' | 'length' | 'ats';

export interface CVQualityIssue {
  id: string;
  category: CVQualityCategory;
  severity: CVQualitySeverity;
  message: string;
  section?: string;
  fix?: string;
}

const WORDY_PHRASES = ['responsible for', 'worked on', 'helped with', 'various duties'];

export function analyzeCVQuality(cv: CVData): CVQualityIssue[] {
  const issues: CVQualityIssue[] = [];
  const add = (issue: CVQualityIssue) => issues.push(issue);

  if (!cv.personal.fullName.trim()) add({ id: 'missing-name', category: 'completeness', severity: 'error', message: 'Full name is missing.', section: 'personal' });
  if (!cv.personal.email.trim()) add({ id: 'missing-email', category: 'completeness', severity: 'error', message: 'Email is missing.', section: 'personal' });
  if (!cv.summary.trim()) add({ id: 'missing-summary', category: 'completeness', severity: 'warning', message: 'Professional summary is missing.', section: 'summary' });
  if (cv.summary.trim().split(/\s+/).length > 120) add({ id: 'long-summary', category: 'length', severity: 'warning', message: 'Professional summary is longer than 120 words.', section: 'summary', fix: 'Condense the summary to the most relevant value proposition.' });
  if (cv.experience.length === 0) add({ id: 'missing-experience', category: 'completeness', severity: 'warning', message: 'No work experience is listed.', section: 'experience' });
  if (cv.skills.length === 0) add({ id: 'missing-skills', category: 'completeness', severity: 'warning', message: 'No skills are listed.', section: 'skills' });

  cv.experience.forEach((experience, index) => {
    const prefix = `experience-${experience.id || index}`;
    if (!experience.jobTitle.trim() || !experience.company.trim()) add({ id: `${prefix}-identity`, category: 'completeness', severity: 'error', message: 'Experience entry is missing a job title or company.', section: 'experience' });
    if (!experience.current && experience.startDate && experience.endDate && experience.endDate < experience.startDate) add({ id: `${prefix}-dates`, category: 'consistency', severity: 'error', message: 'Experience end date is before its start date.', section: 'experience' });
    const lower = experience.description.toLowerCase();
    if (WORDY_PHRASES.some(phrase => lower.includes(phrase))) add({ id: `${prefix}-weak-language`, category: 'clarity', severity: 'info', message: 'Experience description contains weak or generic wording.', section: 'experience', fix: 'Lead with a specific action and outcome where supported by your real experience.' });
  });

  const normalizedSkills = cv.skills.map(skill => skill.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(normalizedSkills).size !== normalizedSkills.length) add({ id: 'duplicate-skills', category: 'consistency', severity: 'warning', message: 'Duplicate skills were found.', section: 'skills', fix: 'Remove duplicate skill entries.' });

  return issues;
}

export function summarizeCVQuality(issues: CVQualityIssue[]) {
  return {
    errors: issues.filter(issue => issue.severity === 'error').length,
    warnings: issues.filter(issue => issue.severity === 'warning').length,
    info: issues.filter(issue => issue.severity === 'info').length,
  };
}
