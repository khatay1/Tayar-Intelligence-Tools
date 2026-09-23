import { CVData, TemplateId } from '@/lib/cv-types';
import { CVLocale } from '../i18n/cv-locale';
import { CVLayoutSettings } from '../design/cv-layout';

export type CVExportFormat = 'pdf' | 'docx' | 'txt' | 'print';

export interface CVExportRequest {
  format: CVExportFormat;
  filename: string;
  cv: CVData;
  template: TemplateId;
  locale: CVLocale;
  layout: CVLayoutSettings;
}

export interface CVExportValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function sanitizeCVFilename(value: string): string {
  const clean = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
  return clean || 'resume';
}

export function validateCVExport(request: CVExportRequest): CVExportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!request.cv.personal.fullName.trim()) errors.push('Add your full name before exporting.');
  if (!request.cv.personal.email.trim()) warnings.push('The exported CV has no email address.');
  return { valid: errors.length === 0, errors, warnings };
}

export function buildATSTextExport(cv: CVData): string {
  const lines: string[] = [];
  const push = (...values: Array<string | undefined>) => values.filter(Boolean).forEach(value => lines.push(value!.trim()));
  push(cv.personal.fullName, cv.personal.email, cv.personal.phone, cv.personal.address, cv.personal.portfolio, cv.personal.linkedin);
  if (cv.summary) { lines.push('', 'SUMMARY'); push(cv.summary); }
  if (cv.experience.length) {
    lines.push('', 'EXPERIENCE');
    cv.experience.forEach(item => { push(`${item.jobTitle} — ${item.company}`, [item.startDate, item.current ? 'Present' : item.endDate].filter(Boolean).join(' – '), item.description); });
  }
  if (cv.education.length) {
    lines.push('', 'EDUCATION');
    cv.education.forEach(item => push(`${item.degree} — ${item.institution}`, [item.startDate, item.endDate].filter(Boolean).join(' – '), item.description));
  }
  if (cv.skills.length) { lines.push('', 'SKILLS'); push(cv.skills.map(item => item.name).filter(Boolean).join(', ')); }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}