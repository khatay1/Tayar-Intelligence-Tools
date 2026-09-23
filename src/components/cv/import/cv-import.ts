import { CVData, createEmptyCV, uid } from '@/lib/cv-types';

export interface CVImportCandidate {
  data: CVData;
  warnings: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface CVImportedProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  summary?: string;
  skills?: string[];
}

export function mapImportedProfile(profile: CVImportedProfile): CVImportCandidate {
  const data = createEmptyCV();
  data.personal = {
    ...data.personal,
    fullName: profile.fullName?.trim() ?? '',
    email: profile.email?.trim() ?? '',
    phone: profile.phone?.trim() ?? '',
    address: profile.location?.trim() ?? '',
    portfolio: profile.website?.trim() ?? '',
    linkedin: profile.linkedin?.trim() ?? '',
  };
  data.summary = profile.summary?.trim() ?? '';
  data.skills = (profile.skills ?? []).filter(Boolean).map(name => ({ id: uid(), name: name.trim(), level: 'Intermediate' }));

  const warnings: string[] = [];
  if (!data.personal.fullName) warnings.push('Name could not be identified automatically.');
  if (!data.personal.email) warnings.push('Email could not be identified automatically.');
  return { data, warnings, confidence: warnings.length ? 'medium' : 'high' };
}

export function mergeImportedCV(current: CVData, imported: CVData): CVData {
  return {
    ...current,
    personal: { ...current.personal, ...Object.fromEntries(Object.entries(imported.personal).filter(([, value]) => Boolean(value))) },
    summary: imported.summary || current.summary,
    experience: imported.experience.length ? imported.experience : current.experience,
    education: imported.education.length ? imported.education : current.education,
    skills: imported.skills.length ? imported.skills : current.skills,
    languages: imported.languages.length ? imported.languages : current.languages,
    projects: imported.projects.length ? imported.projects : current.projects,
    certificates: imported.certificates.length ? imported.certificates : current.certificates,
    awards: imported.awards.length ? imported.awards : current.awards,
  };
}