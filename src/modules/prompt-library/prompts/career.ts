import { PromptTemplate } from '../prompt-types';

export const CAREER_PROMPTS: PromptTemplate[] = [
  {
    id: 'interview-prep',
    title: 'Interview Preparation',
    description: 'Prepare role-specific interview questions and answer structures.',
    category: 'career',
    prompt: 'Act as an interview coach for this role: "{{topic}}". The candidate background is "{{audience}}" and the goal is "{{goal}}". Give 10 likely interview questions, what each question is testing, a strong answer structure, and two mistakes to avoid. Do not invent personal experience for the candidate.',
    tags: ['interview', 'job', 'career'],
  },
  {
    id: 'cv-gap-review',
    title: 'CV Gap Review',
    description: 'Find missing evidence and weak claims before rewriting a CV.',
    category: 'career',
    prompt: 'Review the following CV or career information for a target role "{{topic}}": "{{audience}}". The goal is "{{goal}}". Identify missing evidence, vague claims, ATS keyword gaps, weak achievement framing, and sections that need clarification. Ask for missing facts instead of fabricating metrics or experience.',
    tags: ['cv', 'resume', 'ats'],
  },
  {
    id: 'professional-intro',
    title: 'Professional Introduction',
    description: 'Create a short introduction for meetings, interviews or networking.',
    category: 'career',
    prompt: 'Create three professional self-introductions around "{{topic}}" for "{{audience}}", with the goal "{{goal}}". Make one 20 seconds, one 45 seconds, and one written networking version. Keep claims grounded only in the information I provide and leave placeholders where facts are missing.',
    tags: ['introduction', 'networking', 'career'],
  },
  {
    id: 'skill-development',
    title: 'Skill Development Plan',
    description: 'Turn a career target into a focused learning plan.',
    category: 'career',
    prompt: 'Build a skill-development plan for "{{topic}}" suitable for "{{audience}}". The target outcome is "{{goal}}". Separate must-have skills, useful secondary skills, practice projects, evidence of competence, and a 4-week starting schedule. Prioritize practical proof over certificates.',
    tags: ['skills', 'learning', 'career'],
  },
];
