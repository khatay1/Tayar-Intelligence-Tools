import { useMemo } from 'react';
import { CVData, TemplateId } from '@/lib/cv-types';
import { analyzeCVForATS } from './cv-ats';
import { analyzeCVQuality, summarizeCVQuality } from './cv-quality';

export function useCVQuality(cv: CVData, template: TemplateId, jobDescription = '') {
  return useMemo(() => {
    const qualityIssues = analyzeCVQuality(cv);
    const ats = analyzeCVForATS(cv, template, jobDescription);
    const issues = [...qualityIssues, ...ats.issues];
    return {
      issues,
      summary: summarizeCVQuality(issues),
      ats,
      hasBlockingIssues: issues.some(issue => issue.severity === 'error'),
    };
  }, [cv, template, jobDescription]);
}
