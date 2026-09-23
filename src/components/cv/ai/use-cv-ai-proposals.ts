import { useCallback, useState } from 'react';
import { CVData } from '@/lib/cv-types';
import { CVProposal, applyVerifiedCVProposal, verifyCVProposal } from './cv-proposals';

function proposalKey(proposal: CVProposal): string {
  return [proposal.kind, proposal.section, proposal.itemId ?? '', proposal.proposed.trim().toLocaleLowerCase()].join(':');
}

export function useCVAIProposals(_cv: CVData, setCV: (next: CVData | ((current: CVData) => CVData)) => void) {
  const [proposals, setProposals] = useState<CVProposal[]>([]);

  const addProposals = useCallback((next: CVProposal[]) => {
    setProposals(current => {
      const seen = new Set(current.map(proposalKey));
      const additions = next.filter(proposal => {
        const key = proposalKey(proposal);
        if (!proposal.proposed.trim() || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return additions.length ? [...current, ...additions] : current;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setProposals(current => current.filter(proposal => proposal.id !== id));
  }, []);

  const verifyAndApply = useCallback((id: string) => {
    let selected: CVProposal | undefined;
    setProposals(current => {
      selected = current.find(item => item.id === id);
      return selected ? current.filter(item => item.id !== id) : current;
    });
    if (selected) setCV(data => applyVerifiedCVProposal(data, verifyCVProposal(selected!)));
  }, [setCV]);

  const clear = useCallback(() => setProposals([]), []);

  return { proposals, addProposals, dismiss, verifyAndApply, clear, count: proposals.length };
}
