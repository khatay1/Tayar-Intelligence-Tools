import { useCallback, useState } from 'react';
import { CVData } from '@/lib/cv-types';
import { AIAction } from '@/lib/cv-ai';
import { AIError, createAIService } from '@/lib/ai/service';
import { createAchievementProposals, createSkillProposals, CVProposal } from './cv-proposals';

interface Options {
  cv: CVData;
  jobDescription: string;
  company: string;
  addProposals: (proposals: CVProposal[]) => void;
  onCoverLetter: (body: string) => void;
  notify: { success: (message: string) => void; error: (message: string) => void };
}

export function useCVAIActionController(options: Options) {
  const [loading, setLoading] = useState<string | null>(null);

  const run = useCallback(async (action: AIAction, targetText?: string) => {
    setLoading(action);
    const ai = createAIService('cv-builder');
    try {
      if (action === 'suggest-skills') {
        const res = await ai.complete({ action, jobTitle: options.cv.personal.jobTitle, skills: options.cv.skills.map(s => s.name), experiences: options.cv.experience });
        const proposals = createSkillProposals(options.cv, res.content.split(',').map(value => value.trim()).filter(Boolean));
        options.addProposals(proposals);
        options.notify.success(`${proposals.length} skill suggestions ready to review`);
        return;
      }
      if (action === 'generate-achievements') {
        const experience = options.cv.experience[0];
        if (!experience) { options.notify.error('Add an experience entry first'); return; }
        const res = await ai.complete({ action, jobTitle: experience.jobTitle || options.cv.personal.jobTitle, company: experience.company, description: experience.description });
        const suggestions = res.content.split('\n').map(value => value.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean);
        const proposals = createAchievementProposals(experience.id, suggestions);
        options.addProposals(proposals);
        options.notify.success(`${proposals.length} achievement suggestions ready to verify`);
        return;
      }
      if (action === 'generate-cover-letter') {
        const res = await ai.complete({ action, cv: options.cv, jobDescription: targetText || options.jobDescription, company: options.company });
        options.onCoverLetter(res.content.trim());
        options.notify.success('Cover letter generated for review');
        return;
      }
      throw new Error(`Unsupported controller action: ${action}`);
    } catch (error) {
      options.notify.error(error instanceof AIError ? error.message : 'AI request failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }, [options]);

  return { loading, run };
}
