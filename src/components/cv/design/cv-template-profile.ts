import { TemplateId } from '@/lib/cv-types';
import { CVColumnLayout, CVSpacingDensity } from './cv-layout';

export interface CVTemplateProfile {
  id: TemplateId;
  atsSafe: boolean;
  preferredColumns: CVColumnLayout;
  density: CVSpacingDensity;
  supportsPhoto: boolean;
  supportsSidebar: boolean;
  printOptimized: boolean;
}

const DEFAULT_PROFILE: Omit<CVTemplateProfile, 'id'> = {
  atsSafe: true,
  preferredColumns: 'single',
  density: 'comfortable',
  supportsPhoto: true,
  supportsSidebar: false,
  printOptimized: true,
};

const PROFILE_OVERRIDES: Partial<Record<TemplateId, Partial<CVTemplateProfile>>> = {
  modern: { preferredColumns: 'sidebar-left', supportsSidebar: true },
  executive: { density: 'spacious' },
  minimal: { density: 'compact', supportsPhoto: false },
  creative: { atsSafe: false, preferredColumns: 'sidebar-left', supportsSidebar: true },
};

export function getCVTemplateProfile(id: TemplateId): CVTemplateProfile {
  return { id, ...DEFAULT_PROFILE, ...(PROFILE_OVERRIDES[id] ?? {}) };
}

export function isATSPreferredTemplate(id: TemplateId): boolean {
  return getCVTemplateProfile(id).atsSafe;
}
