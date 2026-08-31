import { PromptTemplate } from '../prompt-types';

export const CREATIVE_PROMPTS: PromptTemplate[] = [
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
