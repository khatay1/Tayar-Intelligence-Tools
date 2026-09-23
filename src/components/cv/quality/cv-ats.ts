import { CVData, TemplateId } from '@/lib/cv-types';
import { isATSPreferredTemplate } from '../design/cv-template-profile';
import { CVQualityIssue } from './cv-quality';

export interface CVATSReport {
  issues: CVQualityIssue[];
  keywords: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
}

const STOP_WORDS = new Set(['and','the','with','for','from','that','this','you','your','our','are','will','have','has','job','role','work','team']);

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [];
  const counts = new Map<string, number>();
  words.forEach(word => { if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([word]) => word);
}

function cvSearchText(cv: CVData): string {
  return [
    cv.summary,
    ...cv.experience.flatMap(item => [item.jobTitle, item.company, item.description]),
    ...cv.education.flatMap(item => [item.degree, item.institution, item.description]),
    ...cv.skills.map(item => item.name),
    ...cv.projects.flatMap(item => [item.name, item.description]),
    ...cv.certificates.flatMap(item => [item.name, item.issuer]),
  ].join(' ').toLowerCase();
}

export function analyzeCVForATS(cv: CVData, template: TemplateId, jobDescription = ''): CVATSReport {
  const issues: CVQualityIssue[] = [];
  if (!isATSPreferredTemplate(template)) issues.push({ id: 'ats-template', category: 'ats', severity: 'warning', message: 'This template prioritizes visual design over ATS parsing.', fix: 'Use an ATS-preferred template for automated applications.' });
  if (!cv.personal.email.trim()) issues.push({ id: 'ats-email', category: 'ats', severity: 'error', message: 'ATS contact parsing requires an email address.', section: 'personal' });
  if (!cv.personal.phone.trim()) issues.push({ id: 'ats-phone', category: 'ats', severity: 'warning', message: 'Phone number is missing from contact information.', section: 'personal' });

  const keywords = jobDescription.trim() ? extractKeywords(jobDescription) : [];
  const haystack = cvSearchText(cv);
  const matchedKeywords = keywords.filter(keyword => haystack.includes(keyword));
  const missingKeywords = keywords.filter(keyword => !haystack.includes(keyword));

  if (keywords.length && missingKeywords.length) issues.push({ id: 'ats-keywords', category: 'ats', severity: 'info', message: `${missingKeywords.length} relevant job-description keywords are not present in the CV.`, fix: 'Review missing keywords and add only those that truthfully match your experience.' });
  return { issues, keywords, matchedKeywords, missingKeywords };
}
