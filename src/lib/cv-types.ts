export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedin: string;
  portfolio: string;
  jobTitle: string;
}

export interface WorkExperience {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Skill {
  id: string;
  name: string;
  level: string;
}

export interface Language {
  id: string;
  name: string;
  proficiency: string;
}

export interface Certificate {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  link: string;
}

export interface Award {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface CVData {
  personal: PersonalInfo;
  summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
  certificates: Certificate[];
  projects: Project[];
  awards: Award[];
}

export type TemplateId = 'modern' | 'minimal' | 'executive' | 'creative' | 'professional' | 'ats' | 'corporate' | 'tech' | 'finance' | 'healthcare' | 'academic';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
}

export type SectionType =
  | 'summary' | 'experience' | 'education' | 'skills'
  | 'languages' | 'projects' | 'certificates' | 'awards';

export interface SectionConfig {
  id: SectionType;
  label: string;
  visible: boolean;
}

export type ColorTheme = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

export interface ColorThemeInfo {
  id: ColorTheme;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
}

export interface ResumeScore {
  ats: number;
  grammar: number;
  completeness: number;
  professionalism: number;
  readability: number;
  overall: number;
}

export interface JobMatchResult {
  matchPercentage: number;
  missingSkills: string[];
  matchedKeywords: string[];
  suggestions: string[];
}

export interface ResumeVersion {
  id: string;
  version_label: string;
  data: CVData;
  template: string;
  created_at: string;
}

export const TEMPLATES: TemplateInfo[] = [
  { id: 'modern', name: 'Modern', description: 'Clean sidebar layout with accent colors' },
  { id: 'minimal', name: 'Minimal', description: 'Simple, elegant, lots of whitespace' },
  { id: 'executive', name: 'Executive', description: 'Bold header, structured sections' },
  { id: 'creative', name: 'Creative', description: 'Colorful, personality-driven design' },
  { id: 'professional', name: 'ATS Professional', description: 'Traditional, corporate-ready' },
  { id: 'ats', name: 'ATS Optimized', description: 'Maximum parser compatibility' },
  { id: 'corporate', name: 'Corporate', description: 'Clean two-column professional layout' },
  { id: 'tech', name: 'Tech', description: 'Developer-focused with tech stack emphasis' },
  { id: 'finance', name: 'Finance', description: 'Conservative, data-driven, metrics-first' },
  { id: 'healthcare', name: 'Healthcare', description: 'Clean, compliant, credentials-forward' },
  { id: 'academic', name: 'Academic', description: 'Publications and research focused' },
];

export const COLOR_THEMES: ColorThemeInfo[] = [
  { id: 'violet', name: 'Violet', primary: '#7c3aed', primaryLight: '#a78bfa', primaryDark: '#5b21b6', accent: '#c026d3' },
  { id: 'blue', name: 'Ocean Blue', primary: '#2563eb', primaryLight: '#60a5fa', primaryDark: '#1e40af', accent: '#0ea5e9' },
  { id: 'emerald', name: 'Emerald', primary: '#059669', primaryLight: '#34d399', primaryDark: '#065f46', accent: '#14b8a6' },
  { id: 'amber', name: 'Amber', primary: '#d97706', primaryLight: '#fbbf24', primaryDark: '#92400e', accent: '#f59e0b' },
  { id: 'rose', name: 'Rose', primary: '#e11d48', primaryLight: '#fb7185', primaryDark: '#9f1239', accent: '#f43f5e' },
  { id: 'slate', name: 'Slate', primary: '#475569', primaryLight: '#94a3b8', primaryDark: '#1e293b', accent: '#64748b' },
];

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: 'sans' | 'serif' | 'mono';
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'inter', name: 'Inter', family: "'Inter', sans-serif", category: 'sans' },
  { id: 'geist', name: 'Geist', family: "'Geist', sans-serif", category: 'sans' },
  { id: 'poppins', name: 'Poppins', family: "'Poppins', sans-serif", category: 'sans' },
  { id: 'roboto', name: 'Roboto', family: "'Roboto', sans-serif", category: 'sans' },
  { id: 'opensans', name: 'Open Sans', family: "'Open Sans', sans-serif", category: 'sans' },
  { id: 'lato', name: 'Lato', family: "'Lato', sans-serif", category: 'sans' },
  { id: 'montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif", category: 'sans' },
  { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', serif", category: 'serif' },
  { id: 'merriweather', name: 'Merriweather', family: "'Merriweather', serif", category: 'serif' },
  { id: 'sourceserif', name: 'Source Serif', family: "'Source Serif Pro', serif", category: 'serif' },
  { id: 'ibmmono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace", category: 'mono' },
  { id: 'jetbrains', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace", category: 'mono' },
];

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'summary', label: 'Summary', visible: true },
  { id: 'experience', label: 'Experience', visible: true },
  { id: 'education', label: 'Education', visible: true },
  { id: 'skills', label: 'Skills', visible: true },
  { id: 'languages', label: 'Languages', visible: true },
  { id: 'projects', label: 'Projects', visible: true },
  { id: 'certificates', label: 'Certifications', visible: true },
  { id: 'awards', label: 'Awards', visible: true },
];

export function createEmptyCV(): CVData {
  return {
    personal: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      linkedin: '',
      portfolio: '',
      jobTitle: '',
    },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certificates: [],
    projects: [],
    awards: [],
  };
}

export function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}
