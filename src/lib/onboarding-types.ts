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
  { id: 'student', label: 'Student', labelAr: 'طالب', labelSv: 'Student', icon: 'GraduationCap', description: 'Study smarter with AI-powered tools' },
  { id: 'job-seeker', label: 'Job Seeker', labelAr: 'باحث عن عمل', labelSv: 'Jobbsökande', icon: 'Briefcase', description: 'Create standout CVs and cover letters' },
  { id: 'professional', label: 'Professional', labelAr: 'محترف', labelSv: 'Professionell', icon: 'User', description: 'Boost productivity with AI automation' },
  { id: 'business-owner', label: 'Business Owner', labelAr: 'صاحب عمل', labelSv: 'Företagare', icon: 'Building2', description: 'Scale your business with AI solutions' },
  { id: 'freelancer', label: 'Freelancer', labelAr: 'مستقل', labelSv: 'Freelancer', icon: 'Laptop', description: 'Deliver more for clients, faster' },
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
  { id: 'create-cv', label: 'Create a professional CV', icon: 'FileText' },
  { id: 'write-content', label: 'Write articles and content', icon: 'PenLine' },
  { id: 'translate-docs', label: 'Translate documents', icon: 'Languages' },
  { id: 'study-better', label: 'Study more effectively', icon: 'GraduationCap' },
  { id: 'analyze-documents', label: 'Analyze and summarize documents', icon: 'BookOpen' },
  { id: 'grow-business', label: 'Grow my business', icon: 'TrendingUp' },
  { id: 'chat-with-ai', label: 'Chat with an AI assistant', icon: 'MessageSquare' },
  { id: 'cover-letters', label: 'Write cover letters', icon: 'Mail' },
] as const;

// Tool recommendations based on user type
export function getRecommendedTools(userType: UserType, goal: string): string[] {
  const base: Record<UserType, string[]> = {
    'student': ['study-assistant', 'cv-builder', 'translator', 'ai-writer', 'document-ai'],
    'job-seeker': ['cv-builder', 'cover-letter', 'document-ai', 'ai-writer', 'translator'],
    'professional': ['document-ai', 'ai-writer', 'translator', 'cv-builder', 'cover-letter'],
    'business-owner': ['ai-writer', 'document-ai', 'translator', 'cover-letter', 'cv-builder'],
    'freelancer': ['cv-builder', 'cover-letter', 'ai-writer', 'translator', 'document-ai'],
  };
  const tools = [...base[userType]];
  // Adjust based on goal
  if (goal === 'create-cv' && !tools.includes('cv-builder')) tools.unshift('cv-builder');
  if (goal === 'write-content' && !tools.includes('ai-writer')) tools.unshift('ai-writer');
  if (goal === 'translate-docs' && !tools.includes('translator')) tools.unshift('translator');
  if (goal === 'study-better' && !tools.includes('study-assistant')) tools.unshift('study-assistant');
  if (goal === 'analyze-documents' && !tools.includes('document-ai')) tools.unshift('document-ai');
  if (goal === 'cover-letters' && !tools.includes('cover-letter')) tools.unshift('cover-letter');
  return tools.slice(0, 5);
}

export const TOUR_STEPS = [
  { id: 'dashboard', title: 'Dashboard', description: 'Your command center. Browse all AI tools, see recommendations, and track your activity.', target: '[data-tour="dashboard"]' },
  { id: 'workspace', title: 'AI Workspace', description: 'Your personal workspace where all your tools and projects live.', target: '[data-tour="workspace"]' },
  { id: 'files', title: 'My Files', description: 'All your documents, resumes, and exports are saved here automatically.', target: '[data-tour="files"]' },
  { id: 'ai-chat', title: 'AI Chat', description: 'Chat with your AI assistant anytime. Ask questions, get suggestions, and more.', target: '[data-tour="ai-chat"]' },
  { id: 'cv-builder', title: 'CV Builder', description: 'Create ATS-friendly resumes with AI-powered writing assistance.', target: '[data-tour="cv-builder"]' },
] as const;
