export type UserType = 'student' | 'job-seeker' | 'professional' | 'business-owner' | 'freelancer';
export type Language = 'en' | 'ar' | 'sv';

export interface OnboardingState {
  user_type: UserType | '';
  full_name: string;
  country: string;
  profession: string;
  main_goal: string;
  language: Language;
  recommended_tools: string[];
  tour_completed: boolean;
  tour_skipped: boolean;
  tour_steps_seen: string[];
  wizard_completed: boolean;
  achievements: Record<string, string>;
  progress: number;
  sample_content_seeded: boolean;
}

export const DEFAULT_ONBOARDING: OnboardingState = {
  user_type: '',
  full_name: '',
  country: '',
  profession: '',
  main_goal: '',
  language: 'en',
  recommended_tools: [],
  tour_completed: false,
  tour_skipped: false,
  tour_steps_seen: [],
  wizard_completed: false,
  achievements: {},
  progress: 0,
  sample_content_seeded: false,
};

export const ACHIEVEMENTS = [
  { id: 'first_login', label: 'First Login', icon: 'LogIn', description: 'Welcome to Tayar Intelligence!' },
  { id: 'first_ai_request', label: 'First AI Request', icon: 'Sparkles', description: 'You made your first AI-powered request.' },
  { id: 'first_resume', label: 'First Resume', icon: 'FileText', description: 'You created your first resume.' },
  { id: 'first_export', label: 'First Export', icon: 'Download', description: 'You exported your first document.' },
] as const;

export const USER_TYPES: { id: UserType; label: string; labelAr: string; labelSv: string; icon: string; description: string }[] = [
  { id: 'student', label: 'Student', labelAr: 'طالب', labelSv: 'Student', icon: 'GraduationCap', description: 'Study, write and organize work with focused tools' },
  { id: 'job-seeker', label: 'Job Seeker', labelAr: 'باحث عن عمل', labelSv: 'Jobbsökande', icon: 'Briefcase', description: 'Build CVs, cover letters and job-ready documents' },
  { id: 'professional', label: 'Professional', labelAr: 'محترف', labelSv: 'Professionell', icon: 'User', description: 'Create documents and everyday work from one workspace' },
  { id: 'business-owner', label: 'Business Owner', labelAr: 'صاحب عمل', labelSv: 'Företagare', icon: 'Building2', description: 'Build your web presence and manage business workflows' },
  { id: 'freelancer', label: 'Freelancer', labelAr: 'مستقل', labelSv: 'Freelancer', icon: 'Laptop', description: 'Build, write and deliver client work from one workspace' },
];

export const LANGUAGES: { code: Language; label: string; labelNative: string; flag: string }[] = [
  { code: 'en', label: 'English', labelNative: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'Arabic', labelNative: 'العربية', flag: '🇸🇦' },
  { code: 'sv', label: 'Swedish', labelNative: 'Svenska', flag: '🇸🇪' },
];

export const COUNTRIES = [
  'Sweden', 'Saudi Arabia', 'United Arab Emirates', 'Egypt', 'Jordan', 'Kuwait', 'Qatar', 'Bahrain', 'Oman',
  'Lebanon', 'Iraq', 'Syria', 'Palestine', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Sudan', 'Yemen',
  'United Kingdom', 'United States', 'Germany', 'France', 'Netherlands', 'Norway', 'Denmark', 'Finland',
  'Spain', 'Italy', 'Turkey', 'India', 'Pakistan', 'Bangladesh', 'Indonesia', 'Malaysia', 'Other',
];

export const GOALS = [
  { id: 'build-website', label: 'Build and publish a website', icon: 'Rocket' },
  { id: 'create-cv', label: 'Create a professional CV', icon: 'FileText' },
  { id: 'write-content', label: 'Write articles and content', icon: 'PenLine' },
  { id: 'translate-docs', label: 'Translate documents', icon: 'Languages' },
  { id: 'study-better', label: 'Study more effectively', icon: 'GraduationCap' },
  { id: 'analyze-documents', label: 'Analyze and summarize documents', icon: 'BookOpen' },
  { id: 'grow-business', label: 'Grow my business', icon: 'TrendingUp' },
  { id: 'chat-with-ai', label: 'Chat with an AI assistant', icon: 'MessageSquare' },
  { id: 'cover-letters', label: 'Write cover letters', icon: 'Mail' },
] as const;

// Tool recommendations based on user type and primary goal.
export function getRecommendedTools(userType: UserType, goal: string): string[] {
  const base: Record<UserType, string[]> = {
    'student': ['study-assistant', 'translator', 'document-ai', 'ai-writer', 'cv-builder'],
    'job-seeker': ['cv-builder', 'cover-letter', 'document-ai', 'ai-writer', 'translator'],
    'professional': ['document-ai', 'website-builder', 'ai-writer', 'translator', 'cv-builder'],
    'business-owner': ['website-builder', 'ai-writer', 'document-ai', 'translator', 'invoice-generator'],
    'freelancer': ['website-builder', 'cv-builder', 'cover-letter', 'ai-writer', 'translator'],
  };
  const tools = [...base[userType]];

  const prioritize = (toolId: string) => {
    const index = tools.indexOf(toolId);
    if (index >= 0) tools.splice(index, 1);
    tools.unshift(toolId);
  };

  if (goal === 'build-website' || goal === 'grow-business') prioritize('website-builder');
  if (goal === 'create-cv') prioritize('cv-builder');
  if (goal === 'write-content') prioritize('ai-writer');
  if (goal === 'translate-docs') prioritize('translator');
  if (goal === 'study-better') prioritize('study-assistant');
  if (goal === 'analyze-documents') prioritize('document-ai');
  if (goal === 'cover-letters') prioritize('cover-letter');

  return tools.slice(0, 5);
}

export const TOUR_STEPS = [
  { id: 'dashboard', title: 'Dashboard', description: 'Browse your tools, recommendations and recent activity from one place.', target: '[data-tour="dashboard"]' },
  { id: 'workspace', title: 'My Workspace', description: 'Your projects, files and everyday work stay together here.', target: '[data-tour="my-workspace"]' },
  { id: 'website-builder', title: 'Website Builder', description: 'Build and publish a responsive website with manual controls and guided workflows.', target: '[data-tour="website-builder"]' },
  { id: 'files', title: 'My Files', description: 'Find saved documents, exports and project files without hunting across tools.', target: '[data-tour="my-files"]' },
  { id: 'subscription', title: 'Subscription', description: 'See your current plan, included limits and billing options in one place.', target: '[data-tour="subscription"]' },
] as const;
