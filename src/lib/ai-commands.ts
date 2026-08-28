import { Sparkles, FileText, Mail, Languages, PenLine, GraduationCap, FileSearch, Wand2 } from 'lucide-react';
import { ViewId } from '@/components/workspace/workspace-config';

export interface AICommand {
  id: string;
  label: string;
  description: string;
  icon: typeof Sparkles;
  view: ViewId;
  keywords: string[];
  category: 'create' | 'analyze' | 'improve' | 'translate' | 'write' | 'study';
}

export const AI_COMMANDS: AICommand[] = [
  {
    id: 'create-cv',
    label: 'Create a CV',
    description: 'Build a professional resume with AI assistance',
    icon: FileText,
    view: 'cv-builder',
    keywords: ['cv', 'resume', 'create cv', 'make resume', 'build cv', 'new resume'],
    category: 'create',
  },
  {
    id: 'cover-letter',
    label: 'Write a Cover Letter',
    description: 'Generate a tailored cover letter for any job',
    icon: Mail,
    view: 'cover-letter',
    keywords: ['cover letter', 'letter', 'application letter', 'write cover letter'],
    category: 'write',
  },
  {
    id: 'analyze-pdf',
    label: 'Analyze a PDF',
    description: 'Upload and analyze any document with AI',
    icon: FileSearch,
    view: 'document-ai',
    keywords: ['analyze pdf', 'analyze document', 'pdf', 'upload document', 'read pdf', 'summarize document', 'summarize pdf'],
    category: 'analyze',
  },
  {
    id: 'translate',
    label: 'Translate Text',
    description: 'Translate between any languages',
    icon: Languages,
    view: 'translator',
    keywords: ['translate', 'translation', 'translate text', 'language', 'convert language'],
    category: 'translate',
  },
  {
    id: 'ai-writer',
    label: 'Write with AI',
    description: 'Generate any written content with AI',
    icon: PenLine,
    view: 'ai-writer',
    keywords: ['write', 'writer', 'content', 'article', 'blog', 'essay', 'write text', 'ai writer'],
    category: 'write',
  },
  {
    id: 'study-assistant',
    label: 'Study Assistant',
    description: 'Get help with study materials and notes',
    icon: GraduationCap,
    view: 'study-assistant',
    keywords: ['study', 'notes', 'flashcards', 'quiz', 'learn', 'study assistant', 'homework'],
    category: 'study',
  },
  {
    id: 'improve-resume',
    label: 'Improve My Resume',
    description: 'Optimize your CV for ATS and recruiters',
    icon: Wand2,
    view: 'cv-builder',
    keywords: ['improve resume', 'improve cv', 'optimize cv', 'ats', 'enhance resume', 'fix resume', 'better cv'],
    category: 'improve',
  },
  {
    id: 'summarize',
    label: 'Summarize My Document',
    description: 'Get a concise summary of any document',
    icon: FileSearch,
    view: 'document-ai',
    keywords: ['summarize', 'summary', 'summarize document', 'summarize text', 'shorten', 'tldr'],
    category: 'analyze',
  },
];

export function matchCommand(query: string): AICommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const scored: { cmd: AICommand; score: number }[] = [];
  for (const cmd of AI_COMMANDS) {
    let score = 0;
    for (const kw of cmd.keywords) {
      if (q === kw) { score = 100; break; }
      if (q.includes(kw)) score = Math.max(score, 80);
      if (kw.includes(q) && q.length > 2) score = Math.max(score, 60);
    }
    if (cmd.label.toLowerCase().includes(q)) score = Math.max(score, 70);
    if (cmd.description.toLowerCase().includes(q)) score = Math.max(score, 30);
    if (score > 0) scored.push({ cmd, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.cmd);
}
