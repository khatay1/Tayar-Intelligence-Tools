import { CVData, uid } from '@/lib/cv-types';

export type CVProposalKind = 'text-rewrite' | 'skill' | 'achievement';

export interface CVProposal {
  id: string;
  kind: CVProposalKind;
  section: 'summary' | 'experience' | 'skills';
  itemId?: string;
  before?: string;
  proposed: string;
  reason: string;
  requiresVerification: boolean;
}

export function createSkillProposals(cv: CVData, suggestions: string[]): CVProposal[] {
  const existing = new Set(cv.skills.map(skill => skill.name.trim().toLowerCase()).filter(Boolean));
  return suggestions
    .map(value => value.trim())
    .filter(value => value && !existing.has(value.toLowerCase()))
    .slice(0, 12)
    .map(value => ({
      id: uid(),
      kind: 'skill' as const,
      section: 'skills' as const,
      proposed: value,
      reason: 'Suggested from the target role or CV context. Confirm that you genuinely have this skill before adding it.',
      requiresVerification: true,
    }));
}

export function createAchievementProposals(experienceId: string, suggestions: string[]): CVProposal[] {
  return suggestions.map(value => value.trim()).filter(Boolean).slice(0, 8).map(value => ({
    id: uid(),
    kind: 'achievement' as const,
    section: 'experience' as const,
    itemId: experienceId,
    proposed: value,
    reason: 'AI-generated achievement wording must be verified against your actual work before it is added.',
    requiresVerification: true,
  }));
}

export function applyVerifiedCVProposal(cv: CVData, proposal: CVProposal): CVData {
  if (proposal.requiresVerification) return cv;
  if (proposal.kind === 'skill') {
    return { ...cv, skills: [...cv.skills, { id: uid(), name: proposal.proposed, level: 'Intermediate' }] };
  }
  if (proposal.section === 'summary') return { ...cv, summary: proposal.proposed };
  if (proposal.section === 'experience' && proposal.itemId) {
    return {
      ...cv,
      experience: cv.experience.map(item => item.id === proposal.itemId
        ? { ...item, description: [item.description.trim(), proposal.proposed].filter(Boolean).join('\n') }
        : item),
    };
  }
  return cv;
}

export function verifyCVProposal(proposal: CVProposal): CVProposal {
  return { ...proposal, requiresVerification: false };
}
