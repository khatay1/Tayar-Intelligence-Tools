export type PromptCategory = 'business' | 'career' | 'writing' | 'social';

export type PromptTemplate = {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  prompt: string;
  tags: string[];
};

export const TAYAR_PROMPTS: PromptTemplate[] = [
  {
    id: 'business-offer',
    title: 'Clarify a Business Offer',
    description: 'Turn a rough offer into a clear value proposition and action plan.',
    category: 'business',
    prompt: 'Act as a practical business strategist. Review this offer: "{{topic}}". The target customer is "{{audience}}" and the main goal is "{{goal}}". Identify the customer problem, promised outcome, strongest differentiators, likely objections, and three concrete improvements. End with a concise revised offer statement.',
    tags: ['strategy', 'offer', 'sales'],
  },
  {
    id: 'competitor-framework',
    title: 'Competitor Review Framework',
    description: 'Create a structured competitor comparison without inventing facts.',
    category: 'business',
    prompt: 'Help me compare competitors for "{{topic}}". My audience is "{{audience}}" and my goal is "{{goal}}". Create a comparison framework covering positioning, customer type, pricing model, strengths, weaknesses, acquisition channels, and product gaps. Clearly mark facts that require external verification and do not invent missing data.',
    tags: ['competitors', 'research', 'market'],
  },
  {
    id: 'sales-plan',
    title: 'Simple Sales Plan',
    description: 'Create a focused sales plan with measurable next actions.',
    category: 'business',
    prompt: 'Create a practical sales plan for "{{topic}}" aimed at "{{audience}}". The goal is "{{goal}}". Include ideal customer profile, outreach channels, a short opening message, qualification questions, follow-up cadence, weekly metrics, and the first five actions to execute.',
    tags: ['sales', 'outreach', 'plan'],
  },
  {
    id: 'process-sop',
    title: 'Turn Notes into an SOP',
    description: 'Convert messy process notes into a clean operating procedure.',
    category: 'business',
    prompt: 'Turn these notes into a concise standard operating procedure: "{{topic}}". The people using it are "{{audience}}". The desired outcome is "{{goal}}". Organize the response into purpose, prerequisites, numbered steps, quality checks, exceptions, and completion criteria. Keep instructions concrete and testable.',
    tags: ['operations', 'sop', 'process'],
  },
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
  {
    id: 'article-outline',
    title: 'Article Outline',
    description: 'Build a useful article structure before drafting.',
    category: 'writing',
    prompt: 'Create a detailed article outline about "{{topic}}" for "{{audience}}". The goal is "{{goal}}". Include a strong angle, reader problem, section headings, evidence or examples needed, common objections, and a conclusion with a useful next step. Avoid filler sections.',
    tags: ['article', 'outline', 'writing'],
  },
  {
    id: 'rewrite-clear',
    title: 'Rewrite for Clarity',
    description: 'Improve clarity without changing meaning or adding unsupported facts.',
    category: 'writing',
    prompt: 'Rewrite this content about "{{topic}}" for "{{audience}}" with the goal "{{goal}}". Preserve the original meaning and factual claims. Make the structure clearer, remove repetition, shorten unnecessary wording, and flag any sentence that is ambiguous rather than guessing what it means.',
    tags: ['rewrite', 'clarity', 'editing'],
  },
  {
    id: 'social-content-plan',
    title: 'Social Content Plan',
    description: 'Turn one topic into a varied social posting plan.',
    category: 'social',
    prompt: 'Create a 14-post content plan around "{{topic}}" for "{{audience}}". The goal is "{{goal}}". Mix educational, proof, story, objection-handling, conversation, and call-to-action posts. For each post include the angle, hook idea, key point, and intended action. Avoid repeating the same format.',
    tags: ['social', 'content', 'marketing'],
  },
  {
    id: 'video-ideas',
    title: 'YouTube / Video Ideas',
    description: 'Generate useful video concepts with distinct angles.',
    category: 'social',
    prompt: 'Generate 15 video ideas about "{{topic}}" for "{{audience}}" with the goal "{{goal}}". For each idea provide a title concept, viewer promise, opening hook, three main beats, and why the idea is meaningfully different from the others. Avoid promises the content cannot deliver.',
    tags: ['youtube', 'video', 'ideas'],
  },
];

function bounded(value: string) {
  return value.trim().slice(0, 500);
}

export function personalizePrompt(template: PromptTemplate, values: { topic: string; audience: string; goal: string }) {
  return template.prompt
    .replace(/\{\{topic\}\}/g, bounded(values.topic) || '[topic]')
    .replace(/\{\{audience\}\}/g, bounded(values.audience) || '[audience]')
    .replace(/\{\{goal\}\}/g, bounded(values.goal) || '[goal]');
}

export function searchPrompts(query: string, category: string) {
  const normalized = query.trim().toLowerCase();
  return TAYAR_PROMPTS.filter((prompt) => {
    if (category !== 'all' && prompt.category !== category) return false;
    if (!normalized) return true;
    return [prompt.title, prompt.description, prompt.category, ...prompt.tags]
      .some((value) => value.toLowerCase().includes(normalized));
  });
}
