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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasDuplicateIds(items: Array<{ id?: string }>): boolean {
  const ids = items.map(item => item.id?.trim()).filter((id): id is string => !!id);
  return new Set(ids).size !== ids.length;
}

export function analyzeCVQuality(cv: CVData): CVQualityIssue[] {
  const issues: CVQualityIssue[] = [];
  const add = (issue: CVQualityIssue) => issues.push(issue);

  const email = cv.personal.email.trim();
  if (!cv.personal.fullName.trim()) add({ id: 'missing-name', category: 'completeness', severity: 'error', message: 'Full name is missing.', section: 'personal' });
  if (!email) add({ id: 'missing-email', category: 'completeness', severity: 'error', message: 'Email is missing.', section: 'personal' });
  else if (!EMAIL_PATTERN.test(email)) add({ id: 'invalid-email', category: 'consistency', severity: 'error', message: 'Email address format appears invalid.', section: 'personal', fix: 'Check the email address before exporting or applying.' });
  if (!cv.summary.trim()) add({ id: 'missing-summary', category: 'completeness', severity: 'warning', message: 'Professional summary is missing.', section: 'summary' });
  if (cv.summary.trim().split(/\s+/).filter(Boolean).length > 120) add({ id: 'long-summary', category: 'length', severity: 'warning', message: 'Professional summary is longer than 120 words.', section: 'summary', fix: 'Condense the summary to the most relevant value proposition.' });
  if (cv.experience.length === 0) add({ id: 'missing-experience', category: 'completeness', severity: 'warning', message: 'No work experience is listed.', section: 'experience' });
  if (cv.skills.length === 0) add({ id: 'missing-skills', category: 'completeness', severity: 'warning', message: 'No skills are listed.', section: 'skills' });

  cv.experience.forEach((experience, index) => {
    const prefix = `experience-${experience.id || index}`;
    if (!experience.jobTitle.trim() || !experience.company.trim()) add({ id: `${prefix}-identity`, category: 'completeness', severity: 'error', message: 'Experience entry is missing a job title or company.', section: 'experience' });
    if (!experience.current && experience.startDate && experience.endDate && experience.endDate < experience.startDate) add({ id: `${prefix}-dates`, category: 'consistency', severity: 'error', message: 'Experience end date is before its start date.', section: 'experience' });
    const lower = experience.description.toLocaleLowerCase();
    if (WORDY_PHRASES.some(phrase => lower.includes(phrase))) add({ id: `${prefix}-weak-language`, category: 'clarity', severity: 'info', message: 'Experience description contains weak or generic wording.', section: 'experience', fix: 'Lead with a specific action and outcome where supported by your real experience.' });
  });

  cv.education.forEach((education, index) => {
    const prefix = `education-${education.id || index}`;
    if (!education.degree.trim() || !education.institution.trim()) add({ id: `${prefix}-identity`, category: 'completeness', severity: 'warning', message: 'Education entry is missing a degree or institution.', section: 'education' });
    if (education.startDate && education.endDate && education.endDate < education.startDate) add({ id: `${prefix}-dates`, category: 'consistency', severity: 'error', message: 'Education end date is before its start date.', section: 'education' });
  });

  const normalizedSkills = cv.skills.map(skill => skill.name.trim().toLocaleLowerCase()).filter(Boolean);
  if (new Set(normalizedSkills).size !== normalizedSkills.length) add({ id: 'duplicate-skills', category: 'consistency', severity: 'warning', message: 'Duplicate skills were found.', section: 'skills', fix: 'Remove duplicate skill entries.' });

  const collections = [cv.experience, cv.education, cv.skills, cv.languages, cv.projects, cv.certificates, cv.awards];
  if (collections.some(hasDuplicateIds)) add({ id: 'duplicate-item-ids', category: 'consistency', severity: 'error', message: 'Duplicate internal item identifiers were found.', fix: 'Recreate the duplicated entry before continuing to avoid editing the wrong item.' });

  return issues;
}

export function summarizeCVQuality(issues: CVQualityIssue[]) {
  return {
    errors: issues.filter(issue => issue.severity === 'error').length,
    warnings: issues.filter(issue => issue.severity === 'warning').length,
    info: issues.filter(issue => issue.severity === 'info').length,
  };
}
