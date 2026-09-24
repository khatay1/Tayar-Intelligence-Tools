import { CVData } from '@/lib/cv-types';
import { analyzeCVForATS } from '../quality/cv-ats';
import { TemplateId } from '@/lib/cv-types';

export interface CVTailoringOpportunity {
  keyword: string;
  status: 'present' | 'verify';
  evidence: string[];
}

export interface CVTailoringAnalysis {
  opportunities: CVTailoringOpportunity[];
  matchedCount: number;
  totalKeywords: number;
}

function evidenceForKeyword(cv: CVData, keyword: string): string[] {
  const needle = keyword.toLowerCase();
  const evidence: string[] = [];
  if (cv.summary.toLowerCase().includes(needle)) evidence.push('summary');
  cv.experience.forEach(item => {
    if ([item.jobTitle, item.company, item.description].some(value => value.toLowerCase().includes(needle))) evidence.push(`experience:${item.id}`);
  });
  cv.skills.forEach(item => { if (item.name.toLowerCase().includes(needle)) evidence.push(`skill:${item.id}`); });
  cv.projects.forEach(item => { if ([item.name, item.description].some(value => value.toLowerCase().includes(needle))) evidence.push(`project:${item.id}`); });
  return evidence;
}

export function analyzeCVTailoring(cv: CVData, template: TemplateId, jobDescription: string): CVTailoringAnalysis {
  const ats = analyzeCVForATS(cv, template, jobDescription);
  const opportunities = ats.keywords.map(keyword => {
    const evidence = evidenceForKeyword(cv, keyword);
    return { keyword, status: evidence.length ? 'present' as const : 'verify' as const, evidence };
  });
  return { opportunities, matchedCount: ats.matchedKeywords.length, totalKeywords: ats.keywords.length };
}
