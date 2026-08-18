import { CVData, ResumeScore, JobMatchResult } from './cv-types';

const STRONG_ACTION_VERBS = [
  'Led', 'Developed', 'Designed', 'Implemented', 'Managed', 'Created',
  'Optimized', 'Architected', 'Launched', 'Streamlined', 'Spearheaded',
  'Automated', 'Engineered', 'Transformed', 'Accelerated', 'Delivered',
];

const WEAK_PHRASES = [
  'responsible for', 'worked on', 'helped with', 'in charge of',
  'duties included', 'assisted with', 'participated in',
];

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Python', 'SQL', 'Git',
  'AWS', 'Docker', 'Node.js', 'Communication', 'Leadership',
  'Project Management', 'Agile', 'Problem Solving',
];

const ATS_KEYWORDS = [
  'experience', 'team', 'project', 'achievement', 'results',
  'collaboration', 'stakeholder', 'deadline', 'budget', 'strategy',
];

export interface AISuggestion {
  type: 'wording' | 'action-verb' | 'missing-skill' | 'ats';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  fix?: (cv: CVData) => CVData;
}

export function calculateATSScore(cv: CVData): number {
  let score = 0;
  const p = cv.personal;
  const personalFields = [p.fullName, p.email, p.phone, p.address, p.jobTitle];
  const filledPersonal = personalFields.filter(f => f.trim().length > 0).length;
  score += Math.round((filledPersonal / personalFields.length) * 20);
  if (cv.summary.trim().length > 0) {
    score += cv.summary.trim().length > 100 ? 15 : 8;
  }
  if (cv.experience.length > 0) {
    score += Math.min(cv.experience.length * 8, 15);
    const hasDescriptions = cv.experience.filter(e => e.description.trim().length > 50).length;
    score += Math.min(hasDescriptions * 5, 10);
  }
  if (cv.education.length > 0) score += Math.min(cv.education.length * 5, 10);
  if (cv.skills.length >= 5) score += 15;
  else if (cv.skills.length > 0) score += Math.round((cv.skills.length / 5) * 15);
  if (cv.languages.length > 0) score += Math.min(cv.languages.length * 2, 5);
  score += Math.min(cv.certificates.length * 3, 5);
  score += Math.min(cv.projects.length * 3, 5);
  const allText = (cv.summary + ' ' + cv.experience.map(e => e.description).join(' ')).toLowerCase();
  const keywordHits = ATS_KEYWORDS.filter(k => allText.includes(k)).length;
  score += Math.min(keywordHits, 3);
  return Math.min(score, 100);
}

function calculateGrammarScore(cv: CVData): number {
  let score = 100;
  let deductions = 0;
  const allText = [
    cv.summary,
    ...cv.experience.map(e => e.description),
    ...cv.education.map(e => e.description || ''),
    ...cv.projects.map(p => p.description),
  ].join(' ');

  // Check for common grammar issues
  const lowerText = allText.toLowerCase();
  WEAK_PHRASES.forEach(phrase => {
    if (lowerText.includes(phrase)) deductions += 5;
  });

  // Check for excessive capitalization
  const words = allText.split(/\s+/);
  const overCapitalized = words.filter(w => w.length > 3 && w === w.toUpperCase() && !/^[A-Z]+$/.test(w[0])).length;
  deductions += Math.min(overCapitalized * 2, 10);

  // Check for very long sentences
  const sentences = allText.split(/[.!?]+/);
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 35).length;
  deductions += Math.min(longSentences * 3, 15);

  // Check for missing periods
  const expDescriptions = cv.experience.map(e => e.description).filter(d => d.trim().length > 0);
  const missingPeriods = expDescriptions.filter(d => !d.trim().endsWith('.') && !d.trim().endsWith('!') && !d.trim().endsWith(':')).length;
  deductions += Math.min(missingPeriods * 2, 10);

  return Math.max(0, score - deductions);
}

function calculateCompletenessScore(cv: CVData): number {
  const checks: boolean[] = [
    cv.personal.fullName.trim().length > 0,
    cv.personal.email.trim().length > 0,
    cv.personal.phone.trim().length > 0,
    cv.personal.jobTitle.trim().length > 0,
    cv.personal.address.trim().length > 0,
    cv.personal.linkedin.trim().length > 0 || cv.personal.portfolio.trim().length > 0,
    cv.summary.trim().length > 50,
    cv.experience.length >= 1,
    cv.experience.length >= 2,
    cv.experience.some(e => e.description.trim().length > 50),
    cv.education.length >= 1,
    cv.skills.length >= 5,
    cv.skills.length >= 8,
    cv.languages.length >= 1,
    cv.certificates.length >= 1,
    cv.projects.length >= 1,
    cv.awards.length >= 1,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function calculateProfessionalismScore(cv: CVData): number {
  let score = 50;
  const expText = cv.experience.map(e => e.description.toLowerCase()).join(' ');

  if (STRONG_ACTION_VERBS.some(v => expText.toLowerCase().includes(v.toLowerCase()))) score += 15;
  if (/\d+%|\$\d+|\d+x|\d+ (?:people|users|clients|projects|years)/.test(expText)) score += 15;
  if (cv.summary.trim().length >= 100 && cv.summary.trim().length <= 400) score += 10;
  if (cv.skills.length >= 8) score += 5;
  if (cv.personal.linkedin.trim().length > 0) score += 5;

  WEAK_PHRASES.forEach(phrase => {
    if (expText.includes(phrase)) score -= 5;
  });

  return Math.max(0, Math.min(100, score));
}

function calculateReadabilityScore(cv: CVData): number {
  const allText = [cv.summary, ...cv.experience.map(e => e.description), ...cv.projects.map(p => p.description)].filter(t => t.trim().length > 0).join('. ');
  if (allText.trim().length === 0) return 0;
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = allText.split(/\s+/).filter(w => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  const avgWordsPerSentence = words.length / sentences.length;
  const avgWordLength = allText.replace(/\s/g, '').length / words.length;
  let score = 100;
  if (avgWordsPerSentence > 25) score -= (avgWordsPerSentence - 25) * 2;
  if (avgWordsPerSentence > 35) score -= 15;
  if (avgWordLength > 6) score -= (avgWordLength - 6) * 3;
  if (avgWordLength > 8) score -= 10;
  return Math.max(20, Math.min(100, Math.round(score)));
}

export function calculateResumeScore(cv: CVData): ResumeScore {
  const ats = calculateATSScore(cv);
  const grammar = calculateGrammarScore(cv);
  const completeness = calculateCompletenessScore(cv);
  const professionalism = calculateProfessionalismScore(cv);
  const readability = calculateReadabilityScore(cv);
  const overall = Math.round(ats * 0.30 + grammar * 0.15 + completeness * 0.20 + professionalism * 0.20 + readability * 0.15);
  return { ats, grammar, completeness, professionalism, readability, overall };
}

export function generateSuggestions(cv: CVData): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const expText = cv.experience.map(e => e.description.toLowerCase()).join(' ');

  WEAK_PHRASES.forEach(phrase => {
    if (expText.includes(phrase)) {
      suggestions.push({
        type: 'wording',
        title: `Replace "${phrase}"`,
        description: `This phrase is passive. Use strong action verbs like "Led", "Developed", or "Managed" instead.`,
        severity: 'high',
      });
    }
  });

  if (cv.experience.length > 0 && cv.experience.some(e => e.description.trim().length > 0)) {
    const hasStrongVerb = STRONG_ACTION_VERBS.some(v =>
      cv.experience.some(e => e.description.toLowerCase().startsWith(v.toLowerCase()))
    );
    if (!hasStrongVerb) {
      suggestions.push({
        type: 'action-verb',
        title: 'Start bullets with action verbs',
        description: `Begin your experience descriptions with strong verbs like: ${STRONG_ACTION_VERBS.slice(0, 6).join(', ')}.`,
        severity: 'high',
      });
    }
  }

  const existingSkills = cv.skills.map(s => s.name.toLowerCase());
  const recommended = COMMON_SKILLS.filter(s => !existingSkills.includes(s.toLowerCase())).slice(0, 5);
  if (recommended.length > 0 && cv.skills.length < 8) {
    suggestions.push({
      type: 'missing-skill',
      title: 'Add in-demand skills',
      description: `Consider adding: ${recommended.join(', ')}. These are frequently searched by ATS systems.`,
      severity: 'medium',
    });
  }

  if (cv.summary.trim().length === 0) {
    suggestions.push({
      type: 'ats',
      title: 'Add a professional summary',
      description: 'A 2-3 sentence summary at the top helps recruiters and ATS parsers understand your profile quickly.',
      severity: 'high',
    });
  } else if (cv.summary.trim().length < 80) {
    suggestions.push({
      type: 'ats',
      title: 'Expand your summary',
      description: 'Your summary is quite short. Aim for 3-4 sentences highlighting your experience, key skills, and career goals.',
      severity: 'medium',
    });
  }

  const hasNumbers = cv.experience.some(e => /\d+%|\$\d+|\d+x|\d+ (?:people|users|clients|projects)/.test(e.description));
  if (cv.experience.length > 0 && !hasNumbers) {
    suggestions.push({
      type: 'ats',
      title: 'Quantify your achievements',
      description: 'Add numbers to your experience descriptions. For example: "Increased sales by 25%" or "Managed a team of 10".',
      severity: 'medium',
    });
  }

  if (!cv.personal.linkedin && !cv.personal.portfolio) {
    suggestions.push({
      type: 'ats',
      title: 'Add LinkedIn or portfolio link',
      description: 'Including a LinkedIn profile or portfolio URL gives recruiters more context and improves your visibility.',
      severity: 'low',
    });
  }

  if (cv.education.length === 0) {
    suggestions.push({
      type: 'ats',
      title: 'Add your education',
      description: 'Most ATS systems expect at least one education entry. Add your highest degree.',
      severity: 'medium',
    });
  }

  return suggestions;
}

export function matchJobDescription(cv: CVData, jobDescription: string): JobMatchResult {
  const jobLower = jobDescription.toLowerCase();
  const cvLower = (JSON.stringify(cv)).toLowerCase();

  // Extract skills from job description
  const jobSkills = COMMON_SKILLS.filter(s => jobLower.includes(s.toLowerCase()));
  const cvSkills = cv.skills.map(s => s.name.toLowerCase());

  const missingSkills = jobSkills.filter(s => !cvSkills.includes(s.toLowerCase()));
  const matchedKeywords = jobSkills.filter(s => cvSkills.includes(s.toLowerCase()));

  // Extract keywords from job description
  const jobWords = jobLower.split(/\s+/).filter(w => w.length > 4 && !['about', 'above', 'after', 'again', 'below', 'between', 'during', 'having', 'should', 'their', 'there', 'these', 'those', 'which', 'where', 'while', 'would'].includes(w));
  const cvWords = cvLower.split(/\s+/);
  const keywordMatches = jobWords.filter(w => cvWords.includes(w));
  const matchPercentage = jobWords.length > 0 ? Math.round((keywordMatches.length / jobWords.length) * 100) : 0;

  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    suggestions.push(`Add these skills to your resume: ${missingSkills.join(', ')}`);
  }
  if (cv.summary.trim().length < 100) {
    suggestions.push('Expand your professional summary to better match the job description.');
  }
  if (cv.experience.length < 2) {
    suggestions.push('Add more work experience entries to strengthen your application.');
  }
  const jobTitleMatch = jobLower.includes(cv.personal.jobTitle.toLowerCase()) && cv.personal.jobTitle.trim().length > 0;
  if (!jobTitleMatch) {
    suggestions.push('Adjust your job title to match the position you are applying for.');
  }
  if (suggestions.length === 0) {
    suggestions.push('Your resume is well-aligned with this job description. Consider tailoring your summary further.');
  }

  return {
    matchPercentage: Math.min(matchPercentage, 100),
    missingSkills,
    matchedKeywords,
    suggestions,
  };
}

// AI action types for the assistant
export type AIAction =
  | 'rewrite-experience' | 'improve-grammar' | 'shorten-text'
  | 'expand-text' | 'generate-achievements' | 'suggest-skills'
  | 'optimize-ats' | 'match-job' | 'generate-cover-letter';

export interface AIActionConfig {
  id: AIAction;
  label: string;
  icon: string;
  description: string;
}

export const AI_ACTIONS: AIActionConfig[] = [
  { id: 'rewrite-experience', label: 'Rewrite Experience', icon: 'pen', description: 'Rewrite with stronger action verbs and impact' },
  { id: 'improve-grammar', label: 'Improve Grammar', icon: 'check', description: 'Fix grammar and spelling issues' },
  { id: 'shorten-text', label: 'Shorten Text', icon: 'minimize', description: 'Make text more concise' },
  { id: 'expand-text', label: 'Expand Text', icon: 'maximize', description: 'Add more detail and context' },
  { id: 'generate-achievements', label: 'Generate Achievements', icon: 'award', description: 'Create quantified achievement bullets' },
  { id: 'suggest-skills', label: 'Suggest Skills', icon: 'sparkles', description: 'Recommend skills based on your field' },
  { id: 'optimize-ats', label: 'Optimize for ATS', icon: 'target', description: 'Improve ATS keyword matching' },
  { id: 'match-job', label: 'Match Job Description', icon: 'briefcase', description: 'Tailor content to a specific job posting' },
  { id: 'generate-cover-letter', label: 'Generate Cover Letter', icon: 'mail', description: 'Create a cover letter from your resume' },
];

// Local fallback functions (used when AI service is unavailable)
export function improveSummary(currentSummary: string, jobTitle: string): string {
  if (currentSummary.trim().length === 0) {
    return `Results-driven ${jobTitle || 'professional'} with a proven track record of delivering high-impact solutions. Passionate about leveraging technology and best practices to drive efficiency, growth, and innovation. Seeking to contribute strong analytical and leadership skills to a forward-thinking team.`;
  }
  const improved = currentSummary.trim();
  const prefix = improved.startsWith('Results-driven') || improved.startsWith('Experienced') ? '' : 'Results-driven and dedicated professional. ';
  return `${prefix}${improved} Proven ability to collaborate cross-functionally, manage complex projects, and deliver measurable results in fast-paced environments.`;
}

export function improveExperience(description: string, jobTitle: string): string {
  if (description.trim().length === 0) {
    return `Led key initiatives as ${jobTitle || 'a team member'}, delivering measurable improvements in efficiency and output. Collaborated with cross-functional teams to define requirements, implement solutions, and drive projects to successful completion. Managed priorities in a fast-paced environment while maintaining high quality standards.`;
  }
  const verb = STRONG_ACTION_VERBS[Math.floor(Math.random() * STRONG_ACTION_VERBS.length)];
  const cleaned = description.trim();
  return `${verb} and expanded on: ${cleaned} Delivered consistent results through strategic planning, stakeholder collaboration, and continuous process improvement, achieving measurable impact on team productivity and business outcomes.`;
}

export function generateFullSummary(jobTitle: string, skills: string[]): string {
  const topSkills = skills.slice(0, 4).join(', ');
  return `Experienced ${jobTitle || 'professional'}${topSkills ? ` specializing in ${topSkills}` : ''} with a proven track record of delivering high-impact solutions. Adept at leading cross-functional teams, driving process optimization, and achieving measurable results. Passionate about continuous learning and contributing to innovative, growth-focused organizations.`;
}
