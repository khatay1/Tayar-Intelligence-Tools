import { PromptTemplate } from '../prompt-types';

export const BUSINESS_PROMPTS: PromptTemplate[] = [
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
];
