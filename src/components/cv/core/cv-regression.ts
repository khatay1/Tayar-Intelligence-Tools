import { CVData, SectionConfig } from '@/lib/cv-types';

export interface CVRegressionCheck { id: string; passed: boolean; message: string; }

export function runCVStateRegressionChecks(cv: CVData, sections: SectionConfig[]): CVRegressionCheck[] {
  const ids = [
    ...cv.experience.map(item => item.id), ...cv.education.map(item => item.id), ...cv.skills.map(item => item.id),
    ...cv.languages.map(item => item.id), ...cv.projects.map(item => item.id), ...cv.certificates.map(item => item.id), ...cv.awards.map(item => item.id),
  ].filter(Boolean);
  const sectionIds = sections.map(section => section.id);
  return [
    { id: 'unique-item-ids', passed: new Set(ids).size === ids.length, message: 'All CV collection item IDs must be unique.' },
    { id: 'unique-sections', passed: new Set(sectionIds).size === sectionIds.length, message: 'CV sections must not be duplicated.' },
    { id: 'personal-object', passed: Boolean(cv.personal && typeof cv.personal === 'object'), message: 'Personal data must remain available.' },
    { id: 'collections', passed: [cv.experience, cv.education, cv.skills, cv.languages, cv.projects, cv.certificates, cv.awards].every(Array.isArray), message: 'All CV collections must remain arrays.' },
  ];
}

export function assertCVStateSafe(cv: CVData, sections: SectionConfig[]): void {
  const failed = runCVStateRegressionChecks(cv, sections).filter(check => !check.passed);
  if (failed.length) throw new Error(`CV regression guard failed: ${failed.map(check => check.id).join(', ')}`);
}
